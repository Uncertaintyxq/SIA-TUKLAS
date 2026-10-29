<?php

namespace App\Http\Controllers\Announcements;

use App\Enums\AnnouncementScope;
use App\Enums\GroupRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Announcement;
use App\Models\AnnouncementAttachment;
use App\Models\Profile;
use App\Models\ResearchGroup;
use App\Models\User;
use App\Notifications\AnnouncementPosted;
use App\Support\Cards;
use App\Support\Groups;
use App\Support\Notifier;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Announcements: system-wide (admins), one department, or one research group (educators with the
 * broadcast right, and admins). Posting sends an in-app notification and an email; readers leave a
 * read receipt. /api/announcements/…
 */
class AnnouncementController extends Controller
{
    private const MAX_ATTACHMENTS = 5;

    private const NOT_FOUND = 'That announcement doesn’t exist or isn’t for you.';

    /** GET /api/announcements?scope=&groupId= */
    public function index(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user()->load('profile');
        $scope = AnnouncementScope::tryFrom((string) $request->query('scope'));
        $rows = Announcement::visibleTo($me)
            ->when($scope, fn ($q) => $q->where('scope', $scope))
            ->when($request->integer('groupId'), fn ($q, $id) => $q->where('research_group_id', $id))
            ->with([...Cards::user('author'), 'group:id,name', 'attachments' => fn ($q) => $q->orderBy('id')])
            ->withExists(['readers as read_by_me' => fn ($q) => $q->where('users.id', $me->id)])
            ->orderByDesc('pinned')
            ->latest('created_at')
            ->limit(100)
            ->get();

        // Receipts only for what I wrote (or anything, for admins). Audiences repeat, so look each up once.
        $audiences = [];
        $items = $rows->map(function (Announcement $a) use ($me, &$audiences) {
            $receipts = null;
            if ($this->canEdit($a, $me)) {
                $key = "{$a->scope->value}:{$a->department}:{$a->research_group_id}";
                $ids = array_values(array_diff($audiences[$key] ??= $a->audienceIds(), [$a->author_id]));
                $receipts = ['read' => DB::table('announcement_reads')->where('announcement_id', $a->id)->whereIn('user_id', $ids)->count(), 'total' => count($ids)];
            }

            return [
                'id' => $a->id,
                'scope' => $a->scope->value,
                'audience' => $a->audienceLabel(),
                'group' => $a->group?->only(['id', 'name']),
                'title' => $a->title,
                'body' => $a->body,
                'pinned' => $a->pinned,
                'createdAt' => $a->created_at->toISOString(),
                'updatedAt' => $a->updated_at->toISOString(),
                'author' => new UserCardResource($a->author),
                'attachments' => $a->attachments->map->only(['id', 'name', 'size', 'type']),
                'read' => $a->author_id === $me->id || (bool) $a->read_by_me,
                'receipts' => $receipts,
                'can' => ['edit' => $this->canEdit($a, $me), 'delete' => $this->canEdit($a, $me)],
            ];
        });

        return response()->json(['items' => $items, 'unread' => $this->unreadCount($me), 'audiences' => $this->audiencesFor($me)]);
    }

    /** GET /api/announcements/unread — the nav badge */
    public function unread(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->unreadCount($request->user()->load('profile'))]);
    }

    /** POST /api/announcements/{id}/read — the read receipt, once it has been on the reader's screen */
    public function markRead(Request $request, int $id): Response
    {
        $a = $this->visible($request, $id);
        $a->readers()->syncWithoutDetaching([$request->user()->id => ['read_at' => now()]]);

        return response()->noContent();
    }

    /** GET /api/announcements/{id}/receipts — who has and hasn't read it: for the author and admins */
    public function receipts(Request $request, int $id): JsonResponse
    {
        $a = $this->editable($request, $id);
        $ids = array_values(array_diff($a->audienceIds(), [$a->author_id]));
        $people = User::with('profile')->whereIn('id', $ids)->orderBy('name')->get();
        $readAt = DB::table('announcement_reads')->where('announcement_id', $a->id)->pluck('read_at', 'user_id');

        return response()->json([
            'read' => $people->filter(fn ($p) => isset($readAt[$p->id]))
                ->map(fn ($p) => [...(new UserCardResource($p))->resolve($request), 'readAt' => Carbon::parse($readAt[$p->id])->toISOString()])
                ->sortByDesc('readAt')->values(),
            'unread' => UserCardResource::collection($people->reject(fn ($p) => isset($readAt[$p->id]))->values()),
        ]);
    }

    /** POST /api/announcements {scope, department?, groupId?, title, body, pinned?} */
    public function store(Request $request): JsonResponse
    {
        $input = $request->validate([
            'scope' => ['required', Rule::enum(AnnouncementScope::class)],
            'department' => ['nullable', 'string', 'max:160'],
            'groupId' => ['nullable', 'integer', 'min:1'],
            ...$this->fieldRules(),
        ], $this->fieldMessages());
        /** @var User $me */
        $me = $request->user()->load('profile');
        $scope = AnnouncementScope::from($input['scope']);
        $department = null;
        $group = null;

        if ($scope === AnnouncementScope::System && ! $me->isAdmin()) {
            throw new HttpException(403, 'Only admins can post to everyone.');
        }
        if ($scope === AnnouncementScope::Department) {
            if (! $me->hasRight('broadcast')) {
                throw new HttpException(403, 'An admin has to give you the announcement right first.');
            }
            $department = $me->isAdmin() ? trim((string) ($input['department'] ?? '')) : trim((string) $me->profile?->department);
            if ($department === '') {
                throw new HttpException(400, $me->isAdmin() ? 'Choose a department.' : 'Add your department to your portfolio first.');
            }
        }
        if ($scope === AnnouncementScope::Group) {
            $group = ResearchGroup::with('members')->find($input['groupId'] ?? 0);
            if ($group === null || Gate::denies('announce', $group)) {
                throw new HttpException(403, 'You can only announce to groups you advise or mentor.');
            }
        }

        $a = new Announcement([
            'scope' => $scope, 'department' => $department, 'research_group_id' => $group?->id,
            'title' => $input['title'], 'body' => $input['body'], 'pinned' => (bool) ($input['pinned'] ?? false),
        ]);
        $a->author()->associate($me)->save();
        $a->load('group:id,name');
        if ($group) {
            Groups::log($group, $me->id, 'announcement_posted', "{$me->name} posted “{$a->title}”.");
        }

        // In-app notification (pushed to open tabs) and one email per person in the audience.
        $ids = array_values(array_diff($a->audienceIds(), [$me->id]));
        Notifier::notify($ids, 'announcement', "{$me->name} posted an announcement: “{$a->title}”", "/announcements#a-{$a->id}", $me->id);
        Notification::send(User::whereIn('id', $ids)->get(), new AnnouncementPosted($a, $me->name, $a->audienceLabel()));

        return response()->json(['id' => $a->id], 201);
    }

    /** PATCH /api/announcements/{id} {title?, body?, pinned?} */
    public function update(Request $request, int $id): Response
    {
        $patch = $request->validate(array_map(fn ($rules) => ['sometimes', ...array_diff($rules, ['required'])], $this->fieldRules()), $this->fieldMessages());
        $this->editable($request, $id)->update($patch);

        return response()->noContent();
    }

    /** DELETE /api/announcements/{id} */
    public function destroy(Request $request, int $id): Response
    {
        $a = $this->editable($request, $id);
        $files = $a->attachments->pluck('file');
        $a->delete();
        $files->each(fn ($f) => Uploads::delete($f));

        return response()->noContent();
    }

    /** POST /api/announcements/{id}/attachments — the file itself is the body; up to 5 */
    public function addAttachment(Request $request, int $id): Response
    {
        $a = $this->editable($request, $id);
        if ($a->attachments->count() >= self::MAX_ATTACHMENTS) {
            throw new HttpException(409, 'An announcement can have up to '.self::MAX_ATTACHMENTS.' attachments.');
        }
        $upload = Uploads::store($request, 'any');
        $a->attachments()->create(['name' => $upload['name'], 'file' => $upload['file'], 'type' => $upload['type'], 'size' => $upload['size']]);

        return response()->noContent(201);
    }

    /** GET /api/announcements/{id}/attachments/{attachmentId} */
    public function attachment(Request $request, int $id, int $attachmentId): StreamedResponse
    {
        $f = $this->visible($request, $id)->attachments->firstWhere('id', $attachmentId) ?? throw new HttpException(404, self::NOT_FOUND);

        return Uploads::serve($f->file, $f->type, $f->name, $request->query('download') === '1' || $f->type !== 'application/pdf');
    }

    /** DELETE /api/announcements/{id}/attachments/{attachmentId} */
    public function deleteAttachment(Request $request, int $id, int $attachmentId): Response
    {
        /** @var AnnouncementAttachment $f */
        $f = $this->editable($request, $id)->attachments->firstWhere('id', $attachmentId) ?? throw new HttpException(404, self::NOT_FOUND);
        $f->delete();
        Uploads::delete($f->file);

        return response()->noContent();
    }

    private function visible(Request $request, int $id): Announcement
    {
        return Announcement::visibleTo($request->user()->load('profile'))->with(['attachments', 'group:id,name'])->find($id)
            ?? throw new HttpException(404, self::NOT_FOUND);
    }

    private function editable(Request $request, int $id): Announcement
    {
        $a = $this->visible($request, $id);
        if (! $this->canEdit($a, $request->user())) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $a;
    }

    private function canEdit(Announcement $a, User $me): bool
    {
        return $a->author_id === $me->id || $me->isAdmin();
    }

    private function unreadCount(User $me): int
    {
        return Announcement::visibleTo($me)->where('author_id', '!=', $me->id)->whereDoesntHave('readers', fn ($q) => $q->where('users.id', $me->id))->count();
    }

    /** @return array{system: bool, departments: list<string>, groups: list<array{id: int, name: string}>} */
    private function audiencesFor(User $me): array
    {
        if ($me->isAdmin()) {
            return [
                'system' => true,
                'departments' => Profile::where('department', '!=', '')->distinct()->orderBy('department')->pluck('department')->all(),
                'groups' => ResearchGroup::orderBy('name')->get(['id', 'name'])->map->only(['id', 'name'])->all(),
            ];
        }
        if (! $me->hasRight('broadcast')) {
            return ['system' => false, 'departments' => [], 'groups' => []];
        }
        $department = trim((string) $me->profile?->department);
        $groups = ResearchGroup::where('adviser_id', $me->id)
            ->orWhereHas('members', fn ($m) => $m->where('user_id', $me->id)->where('role', GroupRole::Mentor))
            ->orderBy('name')->get(['id', 'name'])->map->only(['id', 'name'])->all();

        return ['system' => false, 'departments' => $department === '' ? [] : [$department], 'groups' => $groups];
    }

    /** @return array<string, list<string>> */
    private function fieldRules(): array
    {
        // Light markup: **bold**, _italic_, "## " headings, "- " and "1. " lists, [text](https://…) links
        return [
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'body' => ['required', 'string', 'min:1', 'max:10000'],
            'pinned' => ['boolean'],
        ];
    }

    /** @return array<string, string> */
    private function fieldMessages(): array
    {
        return ['title.*' => 'Give the announcement a title', 'body.max' => 'Keep it under 10,000 characters', 'body.*' => 'Write the announcement'];
    }
}
