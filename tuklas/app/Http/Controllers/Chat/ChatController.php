<?php

namespace App\Http\Controllers\Chat;

use App\Enums\ConversationKind;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\MessageReaction;
use App\Models\User;
use App\Support\Cards;
use App\Support\Chat;
use App\Support\Groups;
use App\Support\Mentions;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Communication: 1-on-1 messages between students and educators, and research groups' text
 * channels. /api/chat/…  New messages reach open tabs through Reverb (App\Support\Realtime).
 * Message text is encrypted at rest, so it isn't searched in SQL (docs/CONVERSION.md D7).
 */
class ChatController extends Controller
{
    private const PAGE = 40;

    private const NOT_FOUND = 'That conversation doesn’t exist or you’re not in it.';

    /** GET /api/chat/conversations — my direct chats and group channels, most recent first */
    public function conversations(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $unread = Chat::unreadByConversation($me->id);
        $list = Conversation::whereHas('members', fn ($q) => $q->where('user_id', $me->id))
            ->with('group.members')
            ->get()
            // A channel stays listed only while its group still has the person in it.
            ->filter(fn (Conversation $c) => $c->kind === ConversationKind::Direct || ($c->group && Gate::allows('open', $c->group)))
            ->map(fn (Conversation $c) => $this->summary($c, $me, $unread[$c->id] ?? 0))
            ->sortByDesc('lastMessageAt')
            ->values();

        return response()->json($list);
    }

    /** GET /api/chat/unread — unread messages across every conversation, for the nav badge */
    public function unread(Request $request): JsonResponse
    {
        return response()->json(['messages' => Chat::unreadByConversation($request->user()->id)->sum()]);
    }

    /** POST /api/chat/direct {userId} — opens (or creates) the 1-on-1 chat with someone */
    public function direct(Request $request): JsonResponse
    {
        $userId = (int) $request->validate(['userId' => ['required', 'integer', 'min:1']])['userId'];
        /** @var User $me */
        $me = $request->user();
        if ($userId === $me->id) {
            throw new HttpException(400, 'You can’t message yourself.');
        }
        $other = User::find($userId);
        $chatRoles = [Role::Student, Role::Educator];
        if ($other === null || ! in_array($other->role, $chatRoles, true) || ! in_array($me->role, $chatRoles, true)) {
            throw new HttpException(400, 'Direct messages are between students and educators.');
        }

        $conversation = DB::transaction(function () use ($me, $userId) {
            $c = Conversation::firstOrCreate(['direct_key' => Conversation::directKey($me->id, $userId)], ['kind' => ConversationKind::Direct]);
            foreach ([$me->id, $userId] as $id) {
                ConversationMember::firstOrCreate(['conversation_id' => $c->id, 'user_id' => $id]);
            }

            return $c;
        });

        return response()->json(['id' => $conversation->id]);
    }

    /** GET /api/chat/conversations/{id}?before=<messageId> — the header and the latest top-level messages */
    public function show(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $c = $this->open($id, $me);
        $rows = $this->withMessageData(Message::where('conversation_id', $c->id)->whereNull('parent_id'))
            ->when($request->integer('before'), fn ($q, $before) => $q->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        return response()->json([
            'conversation' => $this->summary($c, $me),
            'messages' => $rows->take(self::PAGE)->reverse()->values()->map(fn (Message $m) => $this->view($m, $this->mayDelete($c, $m, $me), $me->id)),
            'hasMore' => $rows->count() > self::PAGE,
            // How far everyone else has read, for "Seen by" under my latest message
            'readers' => ConversationMember::with('user:id,name')->where('conversation_id', $c->id)->where('user_id', '!=', $me->id)->get()
                ->filter(fn ($r) => $r->user !== null)
                ->map(fn ($r) => ['id' => $r->user_id, 'name' => $r->user->name, 'readAt' => $r->last_read_at->toISOString()])->values(),
        ]);
    }

    /** POST /api/chat/conversations/{id}/read — moves my read marker to now */
    public function markRead(Request $request, int $id): Response
    {
        $me = $request->user();
        $c = $this->open($id, $me);
        $marker = ConversationMember::where('conversation_id', $c->id)->where('user_id', $me->id);
        $before = $marker->value('last_read_at');
        $marker->update(['last_read_at' => now()]);

        // The others' "Seen by" changes only when there was something new to read. Telling them on every
        // call would loop: their tab refetches, marks read, and tells me back.
        $hadUnread = Message::where('conversation_id', $c->id)->where('sender_id', '!=', $me->id)
            ->when($before, fn ($q) => $q->where('created_at', '>', $before))->exists();
        if ($hadUnread) {
            Chat::announceRead($c->id, $me->id);
        }

        return response()->noContent();
    }

    /** POST /api/chat/conversations/{id}/messages {text, parentId?} */
    public function send(Request $request, int $id): JsonResponse
    {
        $input = $request->validate(
            ['text' => ['required', 'string', 'min:1', 'max:4000'], 'parentId' => ['nullable', 'integer', 'min:1']],
            ['text.max' => 'Keep a message under 4,000 characters', 'text.*' => 'Write a message first'],
        );
        $me = $request->user();
        $c = $this->open($id, $me);
        $parentId = $input['parentId'] ?? null;
        if ($parentId !== null && ! Message::whereKey($parentId)->where('conversation_id', $c->id)->whereNull('parent_id')->whereNull('deleted_at')->exists()) {
            throw new HttpException(400, 'The message you’re replying to was removed.');
        }

        $m = $this->deliver($c, $me, ['parent_id' => $parentId, 'text' => $input['text']]);
        $this->mention($c, $m, $me);

        return response()->json($this->view($m, true, $me->id), 201);
    }

    /**
     * POST /api/chat/conversations/{id}/files?text=<caption> — the file itself is the body. In a channel
     * the file joins the group's shared repository, so it also appears under the group's files.
     */
    public function sendFile(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $c = $this->open($id, $me);
        $upload = Uploads::store($request, 'any');
        $caption = mb_substr(trim((string) $request->query('text', '')), 0, 4000);
        $fields = ['text' => $caption, 'file_name' => $upload['name'], 'file_type' => $upload['type'], 'file_size' => $upload['size']];

        if ($c->group) {
            $shared = $c->group->files()->create(['uploaded_by_id' => $me->id, 'name' => $upload['name'], 'file' => $upload['file'], 'type' => $upload['type'], 'size' => $upload['size']]);
            Groups::log($c->group, $me->id, 'file_shared', "{$me->name} shared {$upload['name']} in #{$c->name}");
            $fields['group_file_id'] = $shared->id;
        } else {
            $fields['file'] = $upload['file'];
        }

        $m = $this->deliver($c, $me, $fields);
        $this->mention($c, $m, $me);

        return response()->json($this->view($m, true, $me->id), 201);
    }

    /** GET /api/chat/messages/{id}/replies — a thread: the message and its replies, oldest first */
    public function thread(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $parent = $this->withMessageData(Message::query())->find($id);
        if ($parent === null || $parent->parent_id !== null) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $c = $this->open($parent->conversation_id, $me);
        $replies = $this->withMessageData(Message::where('parent_id', $parent->id))->orderBy('id')->get();

        return response()->json([
            'parent' => $this->view($parent, $this->mayDelete($c, $parent, $me), $me->id),
            'replies' => $replies->map(fn (Message $m) => $this->view($m, $this->mayDelete($c, $m, $me), $me->id)),
        ]);
    }

    /** PATCH /api/chat/messages/{id} {text} — the sender changes their message; it shows "edited" */
    public function update(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $m = Message::whereNull('deleted_at')->find($id) ?? throw new HttpException(404, self::NOT_FOUND);
        $c = $this->open($m->conversation_id, $me);
        if ($m->sender_id !== $me->id) {
            throw new HttpException(403, 'Only the sender can edit a message.');
        }
        // A file's caption may be emptied; a text message needs text
        $request->validate(
            ['text' => [$m->file_name ? 'nullable' : 'required', 'string', 'max:4000']],
            ['text.max' => 'Keep a message under 4,000 characters', 'text.required' => 'Write a message first'],
        );
        $text = trim((string) $request->input('text', ''));
        if ($text !== $m->text) {
            $before = $m->text;
            $m->forceFill(['text' => $text, 'edited_at' => now()])->save();
            Chat::announceChange($m->conversation_id, $m->id);
            // Only people this edit newly mentions hear about it
            $this->mention($c, $m, $me, $before);
        }

        return response()->json($this->view($this->withMessageData(Message::query())->findOrFail($m->id), true, $me->id));
    }

    /** POST /api/chat/messages/{id}/reactions {emoji} — adds my reaction, or takes it back if it's there */
    public function react(Request $request, int $id): JsonResponse
    {
        $me = $request->user();
        $emoji = $request->validate(['emoji' => ['required', Rule::in(MessageReaction::EMOJI)]], ['emoji.*' => 'Pick one of the reactions.'])['emoji'];
        $m = Message::whereNull('deleted_at')->find($id) ?? throw new HttpException(404, self::NOT_FOUND);
        $c = $this->open($m->conversation_id, $me);

        $mine = MessageReaction::where(['message_id' => $m->id, 'user_id' => $me->id, 'emoji' => $emoji]);
        $mine->exists() ? $mine->delete() : MessageReaction::create(['message_id' => $m->id, 'user_id' => $me->id, 'emoji' => $emoji]);
        Chat::announceChange($m->conversation_id, $m->id);

        return response()->json($this->view($this->withMessageData(Message::query())->findOrFail($m->id), $this->mayDelete($c, $m, $me), $me->id));
    }

    /** GET /api/chat/messages/{id}/file — PDFs and images open inline; everything else downloads */
    public function file(Request $request, int $id): StreamedResponse
    {
        $m = Message::with('groupFile')->find($id);
        if ($m === null || $m->deleted_at !== null) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $this->open($m->conversation_id, $request->user());
        $type = $m->groupFile->type ?? $m->file_type ?? 'application/octet-stream';
        $viewable = $type === 'application/pdf' || str_starts_with($type, 'image/');

        return Uploads::serve($m->groupFile->file ?? $m->file, $type, $m->file_name ?? 'file', $request->query('download') === '1' || ! $viewable);
    }

    /** DELETE /api/chat/messages/{id} — removes it for everyone. A direct-chat file goes with it; a channel file stays in the group's files. */
    public function destroy(Request $request, int $id): Response
    {
        $me = $request->user();
        $m = Message::find($id);
        if ($m === null || $m->deleted_at !== null) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $c = $this->open($m->conversation_id, $me);
        if (! $this->mayDelete($c, $m, $me)) {
            throw new HttpException(403, 'Only the sender or a group moderator can remove this message.');
        }
        $file = $m->file;
        $m->forceFill(['deleted_at' => now(), 'text' => '', 'file' => null, 'file_name' => null, 'file_type' => null, 'file_size' => null, 'group_file_id' => null])->save();
        Uploads::delete($file);
        Chat::announce($c->id, $m->id, $m->parent_id, deleted: true);

        return response()->noContent();
    }

    /**
     * GET /api/chat/search?q= — finds my conversations by the other person's name, the channel or the
     * group, newest first, with each one's latest message. Message text is encrypted, so it isn't searched.
     */
    public function search(Request $request): JsonResponse
    {
        $q = mb_strtolower(trim((string) $request->query('q', '')));
        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }
        /** @var User $me */
        $me = $request->user();
        $hits = Conversation::whereHas('members', fn ($m) => $m->where('user_id', $me->id))
            ->with(['group.members', 'members.user'])
            ->get()
            ->filter(fn (Conversation $c) => $c->kind === ConversationKind::Direct || ($c->group && Gate::allows('open', $c->group)))
            // Direct chats match the other person's name; channels match the channel or group name.
            ->filter(fn (Conversation $c) => collect($c->kind === ConversationKind::Direct ? [$this->nameOf($c, $me)] : [$c->name, $c->group?->name])
                ->contains(fn ($s) => $s !== null && str_contains(mb_strtolower($s), $q)))
            ->sortByDesc('last_message_at')
            ->take(30)
            ->map(function (Conversation $c) use ($me) {
                $last = $this->withMessageData(Message::where('conversation_id', $c->id)->whereNull('deleted_at'))->latest('id')->first();

                return $last === null ? null : [
                    'message' => $this->view($last, false, $me->id),
                    'conversation' => [
                        'id' => $c->id, 'kind' => $c->kind->value, 'name' => $this->nameOf($c, $me),
                        'group' => $c->group?->only(['id', 'name']),
                    ],
                ];
            })
            ->filter()
            ->values();

        return response()->json($hits);
    }

    /**
     * A conversation the person may open. Direct chats need a member row; channels follow group
     * membership, and an admin or a participant without a read marker yet gets one here.
     */
    private function open(int $id, User $me): Conversation
    {
        $c = Conversation::with('group.members')->find($id);
        if ($c === null) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $isMember = ConversationMember::where('conversation_id', $id)->where('user_id', $me->id)->exists();
        if ($c->kind === ConversationKind::Direct) {
            if (! $isMember) {
                throw new HttpException(404, self::NOT_FOUND);
            }

            return $c;
        }
        if ($c->group === null || Gate::denies('open', $c->group)) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        if (! $isMember) {
            ConversationMember::create(['conversation_id' => $id, 'user_id' => $me->id]);
        }

        return $c;
    }

    /** Saves a message, bumps the conversation, moves my read marker and tells everyone's open tabs. */
    private function deliver(Conversation $c, User $me, array $fields): Message
    {
        $m = Chat::post($c, $me->id, $fields);

        return $this->withMessageData(Message::query())->findOrFail($m->id);
    }

    /**
     * Notifies people @mentioned in a message who can read the conversation: the two people in a
     * direct chat, or the group's members in a channel. The link opens the conversation at the
     * message (a reply opens at the message it answers).
     */
    private function mention(Conversation $c, Message $m, User $me, string $previous = ''): void
    {
        $direct = $c->kind === ConversationKind::Direct;
        $text = (string) $m->text;
        $members = $direct ? ConversationMember::where('conversation_id', $c->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all() : [];
        $where = $direct ? 'in a message' : "in #{$c->name}".($c->group ? " ({$c->group->name})" : '');
        $link = "/messages/{$c->id}?m=".($m->parent_id ?? $m->id);

        // "@everyone" / "@all": the whole group, newly in this text, from someone who organizes it
        $everyone = [];
        if ($this->mayMentionEveryone($c, $me) && Mentions::mentionsEveryone($text) && ! Mentions::mentionsEveryone($previous)) {
            $everyone = array_values(array_diff($c->group->participantIds(), [$me->id]));
            Mentions::notifyEveryone($everyone, $me, $where, $link);
        }

        Mentions::notify($text, $me,
            fn (User $u) => $direct ? in_array($u->id, $members, true) : $c->group !== null && Gate::forUser($u)->allows('open', $c->group),
            $where, $link, $previous, alreadyTold: $everyone);
    }

    /**
     * "@everyone" in a group channel: the people who organize the group (its adviser, mentors with the
     * moderation right, the student leader, admins), so a big group isn't pinged by every member.
     * Never in a direct chat, where there's only one other person.
     */
    private function mayMentionEveryone(Conversation $c, User $me): bool
    {
        return $c->kind === ConversationKind::Channel && $c->group !== null && Gate::forUser($me)->allows('organize', $c->group);
    }

    /** The sender can always remove their message; in a channel, so can the group's moderators. */
    private function mayDelete(Conversation $c, Message $m, User $me): bool
    {
        return $m->sender_id === $me->id || $me->isAdmin() || ($c->group !== null && Gate::allows('moderate', $c->group));
    }

    private function withMessageData($query)
    {
        return $query->with([...Cards::user('sender'), 'reactions.user:id,name'])->withCount(['replies' => fn ($q) => $q->whereNull('deleted_at')]);
    }

    /** @return array<string, mixed> */
    private function view(Message $m, bool $canDelete, int $meId): array
    {
        $deleted = $m->deleted_at !== null;
        $stored = $m->file !== null || $m->group_file_id !== null;

        return [
            'id' => $m->id,
            'conversationId' => $m->conversation_id,
            'parentId' => $m->parent_id,
            'sender' => new UserCardResource($m->sender),
            'text' => $deleted ? '' : $m->text,
            'deleted' => $deleted,
            'file' => ! $deleted && $stored && $m->file_name
                ? ['name' => $m->file_name, 'size' => $m->file_size ?? 0, 'type' => $m->file_type ?? 'application/octet-stream', 'url' => "/api/chat/messages/{$m->id}/file"]
                : null,
            // A file that was shared here and has since been deleted
            'removedFile' => ! $deleted && ! $stored && $m->file_name ? $m->file_name : null,
            'replyCount' => (int) $m->replies_count,
            'createdAt' => $m->created_at->toISOString(),
            'editedAt' => $deleted ? null : $m->edited_at?->toISOString(),
            // Grouped by emoji, in the picker's order, with who reacted (names only)
            'reactions' => $deleted ? [] : collect(MessageReaction::EMOJI)
                ->map(fn ($e) => [$e, $m->reactions->where('emoji', $e)])
                ->filter(fn ($pair) => $pair[1]->isNotEmpty())
                ->map(fn ($pair) => [
                    'emoji' => $pair[0],
                    'count' => $pair[1]->count(),
                    'mine' => $pair[1]->contains('user_id', $meId),
                    'people' => $pair[1]->map(fn ($r) => $r->user->name ?? 'Former member')->values(),
                ])->values(),
            'canDelete' => ! $deleted && $canDelete,
            'canEdit' => ! $deleted && $m->sender_id === $meId,
        ];
    }

    /** @return array<string, mixed> */
    private function summary(Conversation $c, User $me, int $unread = 0): array
    {
        $other = $c->kind === ConversationKind::Direct
            ? User::with('profile')->whereIn('id', ConversationMember::where('conversation_id', $c->id)->where('user_id', '!=', $me->id)->select('user_id'))->first()
            : null;
        $last = Message::with('sender:id,name')->where('conversation_id', $c->id)->whereNull('deleted_at')->latest('id')->first();
        $online = Chat::isOnline($other?->last_seen_at);

        return [
            'id' => $c->id,
            'kind' => $c->kind->value,
            'name' => $c->kind === ConversationKind::Direct ? ($other->name ?? 'Former member') : $c->name,
            'group' => $c->group?->only(['id', 'name']),
            // The composer offers "@everyone" only to those it would notify for
            'canMentionAll' => $this->mayMentionEveryone($c, $me),
            'other' => $other ? [...(new UserCardResource($other))->resolve(), 'online' => $online, 'lastSeenAt' => $online ? null : $other->last_seen_at?->toISOString()] : null,
            'lastMessage' => $last ? ['text' => $last->text, 'senderName' => $last->sender->name, 'createdAt' => $last->created_at->toISOString(), 'hasFile' => $last->file_name !== null] : null,
            'lastMessageAt' => $c->last_message_at->toISOString(),
            'unread' => $unread,
        ];
    }

    private function nameOf(Conversation $c, User $me): string
    {
        return $c->kind === ConversationKind::Direct
            ? ($c->members->firstWhere('user_id', '!=', $me->id)?->user->name ?? 'Former member')
            : $c->name;
    }
}
