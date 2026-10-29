<?php

namespace App\Http\Controllers\Chat;

use App\Enums\ConversationKind;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\User;
use App\Support\Cards;
use App\Support\Chat;
use App\Support\Groups;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
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
            'messages' => $rows->take(self::PAGE)->reverse()->values()->map(fn (Message $m) => $this->view($m, $this->mayDelete($c, $m, $me))),
            'hasMore' => $rows->count() > self::PAGE,
        ]);
    }

    /** POST /api/chat/conversations/{id}/read — moves my read marker to now */
    public function markRead(Request $request, int $id): Response
    {
        $c = $this->open($id, $request->user());
        ConversationMember::where('conversation_id', $c->id)->where('user_id', $request->user()->id)->update(['last_read_at' => now()]);

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

        return response()->json($this->view($m, true), 201);
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

        return response()->json($this->view($this->deliver($c, $me, $fields), true), 201);
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
            'parent' => $this->view($parent, $this->mayDelete($c, $parent, $me)),
            'replies' => $replies->map(fn (Message $m) => $this->view($m, $this->mayDelete($c, $m, $me))),
        ]);
    }

    /** GET /api/chat/messages/{id}/file — PDFs and images open inline; everything else downloads */
    public function file(Request $request, int $id): StreamedResponse
    {
        $m = Message::with('groupFile')->find($id);
        if ($m === null || $m->deleted_at !== null) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $this->open($m->conversation_id, $request->user());
        $type = $m->groupFile?->type ?? $m->file_type ?? 'application/octet-stream';
        $viewable = $type === 'application/pdf' || str_starts_with($type, 'image/');

        return Uploads::serve($m->groupFile?->file ?? $m->file, $type, $m->file_name ?? 'file', $request->query('download') === '1' || ! $viewable);
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
                    'message' => $this->view($last, false),
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
        $m = DB::transaction(function () use ($c, $me, $fields) {
            $m = new Message($fields + ['sender_id' => $me->id]);
            $m->conversation()->associate($c)->save();
            $c->forceFill(['last_message_at' => now()])->save();
            ConversationMember::where('conversation_id', $c->id)->where('user_id', $me->id)->update(['last_read_at' => now()]);

            return $m;
        });
        Chat::announce($c->id, $m->id, $m->parent_id);

        return $this->withMessageData(Message::query())->findOrFail($m->id);
    }

    /** The sender can always remove their message; in a channel, so can the group's moderators. */
    private function mayDelete(Conversation $c, Message $m, User $me): bool
    {
        return $m->sender_id === $me->id || $me->isAdmin() || ($c->group !== null && Gate::allows('moderate', $c->group));
    }

    private function withMessageData($query)
    {
        return $query->with(Cards::user('sender'))->withCount(['replies' => fn ($q) => $q->whereNull('deleted_at')]);
    }

    /** @return array<string, mixed> */
    private function view(Message $m, bool $canDelete): array
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
            'canDelete' => ! $deleted && $canDelete,
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
            'name' => $c->kind === ConversationKind::Direct ? ($other?->name ?? 'Former member') : $c->name,
            'group' => $c->group?->only(['id', 'name']),
            'other' => $other ? [...(new UserCardResource($other))->resolve(), 'online' => $online, 'lastSeenAt' => $online ? null : $other->last_seen_at?->toISOString()] : null,
            'lastMessage' => $last ? ['text' => $last->text, 'senderName' => $last->sender->name, 'createdAt' => $last->created_at->toISOString(), 'hasFile' => $last->file_name !== null] : null,
            'lastMessageAt' => $c->last_message_at->toISOString(),
            'unread' => $unread,
        ];
    }

    private function nameOf(Conversation $c, User $me): string
    {
        return $c->kind === ConversationKind::Direct
            ? ($c->members->firstWhere('user_id', '!=', $me->id)?->user?->name ?? 'Former member')
            : $c->name;
    }
}
