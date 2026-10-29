<?php

namespace App\Http\Controllers\Groups;

use App\Enums\GroupRole;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\GroupMember;
use App\Models\ResearchGroup;
use App\Models\User;
use App\Support\Cards;
use App\Support\Chat;
use App\Support\Groups;
use App\Support\Notifier;
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
 * Research groups: an adviser, students (one may lead), educator mentors, shared files, deadlines,
 * text channels and an activity log. /api/groups/…  The rules are in ResearchGroupPolicy.
 */
class GroupController extends Controller
{
    private const NOT_FOUND = 'That group doesn’t exist or you’re not in it.';

    private const ROLE_NAME = ['leader' => 'group leader', 'member' => 'member', 'mentor' => 'mentor'];

    /** A group the viewer may open, with its members; otherwise 404. Pass an ability to require more. */
    public static function load(int $id, string $ability = 'open'): ResearchGroup
    {
        $group = ResearchGroup::with('members')->find($id);
        if ($group === null || Gate::denies('open', $group) || Gate::denies($ability, $group)) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $group;
    }

    /** GET /api/groups — mine; admins see every group */
    public function index(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $groups = $this->summaryQuery()
            ->when(! $me->isAdmin(), fn ($q) => $q->where(fn ($w) => $w->where('adviser_id', $me->id)->orWhereHas('members', fn ($m) => $m->where('user_id', $me->id))))
            ->latest('created_at')
            ->get();

        return response()->json($groups->map(fn (ResearchGroup $g) => $this->summary($g, $me)));
    }

    /** POST /api/groups — verified educators holding the moderation right; they become the adviser. */
    public function store(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        if ($me->role !== Role::Educator) {
            throw new HttpException(403, 'You don’t have access to this.');
        }
        if (! $me->hasRight('moderateGroups')) {
            throw new HttpException(403, $me->verified ? 'An admin has turned off your group moderation right.' : 'An admin needs to verify your educator account first.');
        }
        $input = $this->validateGroup($request);

        $group = DB::transaction(function () use ($input, $me) {
            $group = new ResearchGroup($input);
            $group->adviser()->associate($me)->save();
            Groups::createChannel($group, 'general', [$me->id]);
            Groups::log($group, $me->id, 'group_created', "{$me->name} started the group.");

            return $group;
        });

        return response()->json(['id' => $group->id], 201);
    }

    /** GET /api/groups/{id} */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $access = self::load($id);
        Groups::ensureGeneralChannel($access);

        $group = $this->summaryQuery()->with([
            'members' => fn ($q) => $q->orderBy('added_at'),
            ...Cards::user('members.user'),
            'files' => fn ($q) => $q->latest('created_at'),
            ...Cards::user('files.uploadedBy'),
            'channels' => fn ($q) => $q->orderBy('created_at')->orderBy('id'),
            'activities' => fn ($q) => $q->limit(40),
            ...Cards::user('activities.actor'),
        ])->findOrFail($id);
        $unread = Chat::unreadByConversation($me->id);
        $moderate = Gate::allows('moderate', $access);

        return response()->json([
            ...$this->summary($group, $me, $access),
            // groupRole is their place in the group; role stays their account role
            'members' => $group->members->map(fn (GroupMember $m) => [
                ...(new UserCardResource($m->user))->resolve($request), 'addedAt' => $m->added_at->toISOString(), 'groupRole' => $m->role->value,
            ]),
            'files' => $group->files->map(fn ($f) => [
                'id' => $f->id, 'name' => $f->name, 'size' => $f->size, 'type' => $f->type,
                'uploadedBy' => new UserCardResource($f->uploadedBy), 'createdAt' => $f->created_at->toISOString(),
                'canDelete' => $f->uploaded_by_id === $me->id || $moderate,
            ]),
            'deadlines' => $group->deadlines->map(fn ($d) => ['id' => $d->id, 'title' => $d->title, 'dueAt' => $d->due_at->toISOString()]),
            // #general first, then the rest in the order they were opened
            'channels' => $group->channels->sortByDesc(fn ($c) => $c->name === 'general')->values()->map(fn ($c) => [
                'id' => $c->id, 'name' => $c->name, 'unread' => $unread[$c->id] ?? 0, 'lastMessageAt' => $c->last_message_at->toISOString(),
            ]),
            'activity' => $group->activities->map(fn ($a) => [
                'id' => $a->id, 'action' => $a->action, 'detail' => $a->detail, 'actor' => new UserCardResource($a->actor), 'createdAt' => $a->created_at->toISOString(),
            ]),
            'can' => [
                'manage' => Gate::allows('manage', $access),
                'moderate' => $moderate,
                'organize' => Gate::allows('organize', $access),
                'announce' => Gate::allows('announce', $access),
            ],
        ]);
    }

    /** PATCH /api/groups/{id} {name, description} */
    public function update(Request $request, int $id): Response
    {
        $group = self::load($id, 'manage');
        $group->update($this->validateGroup($request));

        return response()->noContent();
    }

    /** DELETE /api/groups/{id} — removes its channels, files and announcements too */
    public function destroy(int $id): Response
    {
        $group = self::load($id, 'manage');
        $files = $group->files()->pluck('file');
        $group->delete();
        $files->each(fn ($f) => Uploads::delete($f));

        return response()->noContent();
    }

    /** POST /api/groups/{id}/members {userId} — students join as members; verified educators as mentors. */
    public function addMember(Request $request, int $id): Response
    {
        $userId = $request->validate(['userId' => ['required', 'integer', 'min:1']])['userId'];
        /** @var User $me */
        $me = $request->user();
        $group = self::load($id, 'manage');
        $user = User::find($userId);
        if ($user === null || $user->id === $group->adviser_id || ! ($user->isStudent() || ($user->isEducator() && $user->verified))) {
            throw new HttpException(400, 'Add students as members, or verified educators as mentors.');
        }
        $role = $user->isEducator() ? GroupRole::Mentor : GroupRole::Member;
        GroupMember::firstOrCreate(['research_group_id' => $group->id, 'user_id' => $user->id], ['role' => $role]);
        Groups::joinChannels($group, $user->id);
        Groups::log($group, $me->id, 'member_added', "{$me->name} added {$user->name} as ".self::ROLE_NAME[$role->value].'.');
        Notifier::notify($user->id, 'group_added', "{$me->name} added you to the research group “{$group->name}” as ".self::ROLE_NAME[$role->value].'.', "/groups/{$group->id}", $me->id);

        return response()->noContent(201);
    }

    /** PATCH /api/groups/{id}/members/{userId} {role} — one leader per group; educators stay mentors. */
    public function setRole(Request $request, int $id, int $userId): Response
    {
        $role = GroupRole::from($request->validate(['role' => ['required', Rule::enum(GroupRole::class)]])['role']);
        /** @var User $me */
        $me = $request->user();
        $group = self::load($id, 'manage');
        $member = $group->members->firstWhere('user_id', $userId) ?? throw new HttpException(404, self::NOT_FOUND);
        if (($member->role === GroupRole::Mentor) !== ($role === GroupRole::Mentor)) {
            throw new HttpException(400, 'Educators join as mentors; students are members or the group leader.');
        }

        DB::transaction(function () use ($group, $userId, $role) {
            if ($role === GroupRole::Leader) {
                GroupMember::where('research_group_id', $group->id)->where('role', GroupRole::Leader)->update(['role' => GroupRole::Member]);
            }
            GroupMember::where('research_group_id', $group->id)->where('user_id', $userId)->update(['role' => $role]);
        });

        $name = User::whereKey($userId)->value('name');
        $label = $role === GroupRole::Leader ? 'the group leader' : 'a '.self::ROLE_NAME[$role->value];
        Groups::log($group, $me->id, 'role_changed', "{$me->name} made {$name} {$label}.");
        Notifier::notify($userId, 'group_role', "You’re now {$label} in “{$group->name}”.", "/groups/{$group->id}", $me->id);

        return response()->noContent();
    }

    /** DELETE /api/groups/{id}/members/{userId} — a manager removes a member, or a member leaves. */
    public function removeMember(Request $request, int $id, int $userId): Response
    {
        /** @var User $me */
        $me = $request->user();
        $group = self::load($id);
        if (! (Gate::allows('manage', $group) || $userId === $me->id)) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $removed = GroupMember::where('research_group_id', $group->id)->where('user_id', $userId)->delete();
        if ($removed > 0) {
            Groups::leaveChannels($group, $userId);
            $name = User::whereKey($userId)->value('name');
            $userId === $me->id
                ? Groups::log($group, $me->id, 'member_left', "{$name} left the group.")
                : Groups::log($group, $me->id, 'member_removed', "{$me->name} removed {$name}.");
        }

        return response()->noContent();
    }

    /** POST /api/groups/{id}/channels {name} */
    public function addChannel(Request $request, int $id): JsonResponse
    {
        $name = Groups::channelName($request->input('name'));
        $me = $request->user();
        $group = self::load($id, 'organize');
        if ($group->channels()->where('name', $name)->exists()) {
            throw new HttpException(409, "There’s already a #{$name} channel.");
        }
        $channel = Groups::createChannel($group, $name, $group->participantIds());
        Groups::log($group, $me->id, 'channel_created', "{$me->name} opened #{$name}.");

        return response()->json(['id' => $channel->id], 201);
    }

    /** DELETE /api/groups/{id}/channels/{channelId} — its messages go; files shared in it stay. #general stays. */
    public function deleteChannel(Request $request, int $id, int $channelId): Response
    {
        $me = $request->user();
        $group = self::load($id, 'manage');
        $channel = $group->channels()->find($channelId) ?? throw new HttpException(404, self::NOT_FOUND);
        if ($channel->name === 'general') {
            throw new HttpException(409, '#general can’t be deleted.');
        }
        $channel->delete();
        Groups::log($group, $me->id, 'channel_deleted', "{$me->name} deleted #{$channel->name}.");

        return response()->noContent();
    }

    /** POST /api/groups/{id}/files — the file itself is the body; anyone in the group can share. */
    public function addFile(Request $request, int $id): Response
    {
        $me = $request->user();
        $group = self::load($id);
        $upload = Uploads::store($request, 'any');
        $group->files()->create(['uploaded_by_id' => $me->id, 'name' => $upload['name'], 'file' => $upload['file'], 'type' => $upload['type'], 'size' => $upload['size']]);
        Groups::log($group, $me->id, 'file_shared', "{$me->name} shared {$upload['name']}.");

        return response()->noContent(201);
    }

    /** GET /api/groups/{id}/files/{fileId} — PDFs open inline; everything else downloads. */
    public function file(Request $request, int $id, int $fileId): StreamedResponse
    {
        $f = self::load($id)->files()->find($fileId) ?? throw new HttpException(404, self::NOT_FOUND);

        return Uploads::serve($f->file, $f->type, $f->name, $request->query('download') === '1' || $f->type !== 'application/pdf');
    }

    /** DELETE /api/groups/{id}/files/{fileId} — its uploader, or a moderator */
    public function deleteFile(Request $request, int $id, int $fileId): Response
    {
        $me = $request->user();
        $group = self::load($id);
        $f = $group->files()->find($fileId);
        if ($f === null || ! ($f->uploaded_by_id === $me->id || Gate::allows('moderate', $group))) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $f->delete();
        Uploads::delete($f->file);
        Groups::log($group, $me->id, 'file_deleted', "{$me->name} deleted {$f->name}.");

        return response()->noContent();
    }

    /** POST /api/groups/{id}/deadlines {title, dueAt} */
    public function addDeadline(Request $request, int $id): Response
    {
        $input = $request->validate(['title' => ['required', 'string', 'min:3', 'max:160'], 'dueAt' => ['required', 'date']], ['title.*' => 'Describe the deadline', 'dueAt.*' => 'Enter the due date']);
        $me = $request->user();
        $group = self::load($id, 'organize');
        $group->deadlines()->create(['title' => $input['title'], 'due_at' => $request->date('dueAt')]);
        Groups::log($group, $me->id, 'deadline_added', "{$me->name} added the deadline “{$input['title']}”.");
        Notifier::notify($group->participantIds(), 'group_deadline', "New deadline in “{$group->name}”: {$input['title']}.", "/groups/{$group->id}", $me->id);

        return response()->noContent(201);
    }

    /** DELETE /api/groups/{id}/deadlines/{deadlineId} */
    public function deleteDeadline(int $id, int $deadlineId): Response
    {
        self::load($id, 'organize')->deadlines()->whereKey($deadlineId)->delete();

        return response()->noContent();
    }

    /** @return array{name: string, description: string} */
    private function validateGroup(Request $request): array
    {
        $input = $request->validate(['name' => ['required', 'string', 'min:3', 'max:120'], 'description' => ['nullable', 'string', 'max:1000']], ['name.*' => 'Name the group (3+ characters)']);

        return ['name' => $input['name'], 'description' => $input['description'] ?? ''];
    }

    private function summaryQuery()
    {
        return ResearchGroup::with([...Cards::user('adviser'), 'members', 'deadlines'])->withCount(['members', 'files']);
    }

    /** @return array<string, mixed> */
    private function summary(ResearchGroup $g, User $me, ?ResearchGroup $access = null): array
    {
        $next = $g->deadlines->first(fn ($d) => $d->due_at->gte(now()));

        return [
            'id' => $g->id,
            'name' => $g->name,
            'description' => $g->description,
            'adviser' => new UserCardResource($g->adviser),
            'memberCount' => (int) $g->members_count,
            'fileCount' => (int) $g->files_count,
            'nextDeadline' => $next ? ['title' => $next->title, 'dueAt' => $next->due_at->toISOString()] : null,
            'isAdviser' => $g->adviser_id === $me->id,
            // null when an admin looks in without being part of it
            'mySeat' => ($access ?? $g)->seatOf($me),
        ];
    }
}
