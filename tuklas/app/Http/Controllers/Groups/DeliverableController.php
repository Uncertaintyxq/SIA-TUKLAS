<?php

namespace App\Http\Controllers\Groups;

use App\Enums\GroupRole;
use App\Enums\SubmissionMode;
use App\Enums\SubmissionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\DeliverableSubmission;
use App\Models\DeliverableVersion;
use App\Models\GroupDeadline;
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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Deliverables: students hand in work against a group deadline, one submission each or one for the
 * group; the adviser and mentors accept it or ask for a revision. /api/groups/{id}/deadlines/{deadlineId}/…
 * Students see only their own submission (or their group's); reviewers see everyone's. Earlier
 * versions are kept with their feedback. Each hand-in is also posted in the group's #general
 * (title and version only, never the file or note, so classmates can't see each other's work).
 */
class DeliverableController extends Controller
{
    private const NOT_FOUND = 'That deliverable doesn’t exist or you can’t see it.';

    private const STATUS_TEXT = ['accepted' => 'accepted', 'needs_revision' => 'asked for a revision of'];

    /** GET /api/groups/{id}/deadlines/{deadlineId} */
    public function show(Request $request, int $id, int $deadlineId): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        [$group, $deadline] = $this->load($id, $deadlineId);
        $deadline->load([
            'deliverables' => fn ($q) => $q->latest('submitted_at'), ...Cards::user('deliverables.student'), ...Cards::user('deliverables.reviewedBy'),
            'deliverables.versions', ...Cards::user('deliverables.versions.student'), ...Cards::user('deliverables.versions.reviewedBy'),
        ]);
        $review = Gate::allows('review', $group);
        $submit = Gate::allows('submit', $group) && $deadline->collectsWork();
        $mine = $submit ? $this->mine($deadline, $me) : null;

        $data = [
            ...$this->deadline($deadline),
            'can' => ['submit' => $submit && $mine?->status !== SubmissionStatus::Accepted, 'review' => $review],
            // A student's own submission, or their group's
            'mine' => $this->submission($mine, $deadline, $request),
        ];
        if ($review && $deadline->collectsWork()) {
            $students = $this->students($group);
            $data['submissions'] = $deadline->deliverables
                ->filter(fn (DeliverableSubmission $s) => $students->contains('id', $s->student_id) || $deadline->submission_mode === SubmissionMode::Group)
                ->values()->map(fn (DeliverableSubmission $s) => $this->submission($s, $deadline, $request));
            // Each: students with nothing handed in. Group: nobody is missing once the group has submitted.
            $data['missing'] = match (true) {
                $deadline->submission_mode === SubmissionMode::Group => $deadline->deliverables->isEmpty() ? UserCardResource::collection($students)->resolve($request) : [],
                default => UserCardResource::collection($students->reject(fn (User $u) => $deadline->deliverables->contains('student_id', $u->id))->values())->resolve($request),
            };
        }

        return response()->json($data);
    }

    /**
     * PUT /api/groups/{id}/deadlines/{deadlineId}/submission — the file is the body (X-File-Name).
     * Handing in again keeps the earlier version (with its review), counts a new one and resets the
     * status. Late is allowed, and marked.
     */
    public function submit(Request $request, int $id, int $deadlineId): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        [$group, $deadline] = $this->load($id, $deadlineId, 'submit');
        if (! $deadline->collectsWork()) {
            throw new HttpException(409, 'This deadline doesn’t collect submissions.');
        }
        $existing = $this->mine($deadline, $me);
        if ($existing?->status === SubmissionStatus::Accepted) {
            throw new HttpException(409, 'This deliverable was already accepted. Ask your adviser if you need to change it.');
        }

        $upload = Uploads::store($request, 'any');
        $submission = DB::transaction(function () use ($existing, $deadline, $me, $upload) {
            $fields = [
                'student_id' => $me->id, 'file' => $upload['file'], 'name' => $upload['name'], 'type' => $upload['type'], 'size' => $upload['size'],
                'note' => null, 'status' => SubmissionStatus::Submitted, 'feedback' => null, 'reviewed_by_id' => null, 'reviewed_at' => null, 'submitted_at' => now(),
            ];
            if ($existing === null) {
                return $deadline->deliverables()->create($fields);
            }
            $existing->versions()->create($existing->only([
                'version', 'student_id', 'file', 'name', 'type', 'size', 'note', 'status', 'feedback', 'reviewed_by_id', 'reviewed_at', 'submitted_at',
            ]));
            $existing->update([...$fields, 'version' => $existing->version + 1]);

            return $existing;
        });
        $submission->setRelation('deadline', $deadline);
        $late = $submission->isLate() ? ' (late)' : '';
        $again = $submission->version > 1 ? " again (version {$submission->version})" : '';
        Groups::log($group, $me->id, 'deliverable_submitted', "{$me->name} handed in “{$deadline->title}”{$again}{$late}.");
        $this->tellTheGroup($group, $me, "Handed in “{$deadline->title}”{$again}{$late}.");
        Notifier::notify($this->reviewerIds($group), 'group_deliverable', "{$me->name} handed in “{$deadline->title}” in “{$group->name}”{$late}.", $this->link($group, $deadline), $me->id);

        return response()->json($this->submission($submission->fresh(['student.profile', 'reviewedBy.profile']), $deadline, $request), $existing === null ? 201 : 200);
    }

    /** PATCH /api/groups/{id}/deadlines/{deadlineId}/submission {note} — a note to the reviewers, until it's accepted */
    public function note(Request $request, int $id, int $deadlineId): JsonResponse
    {
        $note = trim((string) $request->validate(['note' => ['nullable', 'string', 'max:2000']])['note']);
        /** @var User $me */
        $me = $request->user();
        [$group, $deadline] = $this->load($id, $deadlineId, 'submit');
        $submission = $this->mine($deadline, $me) ?? throw new HttpException(404, 'Hand in your file first.');
        if ($submission->status === SubmissionStatus::Accepted) {
            throw new HttpException(409, 'This deliverable was already accepted.');
        }
        $submission->update(['note' => $note === '' ? null : $note]);

        return response()->json($this->submission($submission->fresh(['student.profile', 'reviewedBy.profile']), $deadline, $request));
    }

    /** GET /api/groups/{id}/deadlines/{deadlineId}/submissions/{submissionId}/file — PDFs open inline */
    public function file(Request $request, int $id, int $deadlineId, int $submissionId): StreamedResponse
    {
        $s = $this->visibleSubmission($request, $id, $deadlineId, $submissionId);

        return Uploads::serve($s->file, $s->type, $s->name, $request->query('download') === '1' || $s->type !== 'application/pdf');
    }

    /** GET …/submissions/{submissionId}/versions/{version}/file — an earlier version, same access as the submission */
    public function versionFile(Request $request, int $id, int $deadlineId, int $submissionId, int $version): StreamedResponse
    {
        $v = $this->visibleSubmission($request, $id, $deadlineId, $submissionId)->versions()->where('version', $version)->first()
            ?? throw new HttpException(404, self::NOT_FOUND);

        return Uploads::serve($v->file, $v->type, $v->name, $request->query('download') === '1' || $v->type !== 'application/pdf');
    }

    /** POST /api/groups/{id}/deadlines/{deadlineId}/submissions/{submissionId}/review {status, feedback} */
    public function review(Request $request, int $id, int $deadlineId, int $submissionId): JsonResponse
    {
        $input = $request->validate([
            'status' => ['required', Rule::enum(SubmissionStatus::class)->only([SubmissionStatus::Accepted, SubmissionStatus::NeedsRevision])],
            'feedback' => ['nullable', 'string', 'max:4000', 'required_if:status,needs_revision'],
        ], ['feedback.required_if' => 'Say what needs to change.', 'status.*' => 'Accept it or ask for a revision.']);
        /** @var User $me */
        $me = $request->user();
        [$group, $deadline] = $this->load($id, $deadlineId, 'review');
        $submission = $deadline->deliverables()->find($submissionId) ?? throw new HttpException(404, self::NOT_FOUND);
        $status = SubmissionStatus::from($input['status']);
        $feedback = trim((string) ($input['feedback'] ?? ''));
        $submission->update(['status' => $status, 'feedback' => $feedback === '' ? null : $feedback, 'reviewed_by_id' => $me->id, 'reviewed_at' => now()]);

        $students = $deadline->submission_mode === SubmissionMode::Group ? $this->students($group)->pluck('id')->all() : [$submission->student_id];
        $verb = self::STATUS_TEXT[$status->value];
        $whose = $deadline->submission_mode === SubmissionMode::Group ? 'the group’s' : User::whereKey($submission->student_id)->value('name').'’s';
        Groups::log($group, $me->id, 'deliverable_reviewed', "{$me->name} {$verb} {$whose} “{$deadline->title}”.");
        Notifier::notify($students, 'group_deliverable', "{$me->name} {$verb} your “{$deadline->title}” in “{$group->name}”.", $this->link($group, $deadline), $me->id);

        return response()->json($this->submission($submission->fresh(['student.profile', 'reviewedBy.profile']), $deadline, $request));
    }

    /** @return array{0: ResearchGroup, 1: GroupDeadline} A deadline in a group the viewer may open; otherwise 404. */
    private function load(int $id, int $deadlineId, string $ability = 'open'): array
    {
        $group = GroupController::load($id, $ability);
        $deadline = $group->deadlines()->find($deadlineId) ?? throw new HttpException(404, self::NOT_FOUND);
        $deadline->setRelation('group', $group);

        return [$group, $deadline];
    }

    /** The viewer's own submission; for a group deliverable, the group's single one. */
    private function mine(GroupDeadline $deadline, User $me): ?DeliverableSubmission
    {
        $query = $deadline->deliverables();

        return $deadline->submission_mode === SubmissionMode::Group ? $query->first() : $query->where('student_id', $me->id)->first();
    }

    /** A submission the viewer may see: reviewers see all; a student sees their own, or their group's. */
    private function visibleSubmission(Request $request, int $id, int $deadlineId, int $submissionId): DeliverableSubmission
    {
        /** @var User $me */
        $me = $request->user();
        [$group, $deadline] = $this->load($id, $deadlineId);
        $s = $deadline->deliverables()->find($submissionId);
        $mine = $s !== null && Gate::allows('submit', $group) && ($deadline->submission_mode === SubmissionMode::Group || $s->student_id === $me->id);
        if ($s === null || ! ($mine || Gate::allows('review', $group))) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $s;
    }

    /** @return Collection<int, User> The group's students, leader first. */
    private function students(ResearchGroup $group): Collection
    {
        $ids = $group->members->filter(fn (GroupMember $m) => $m->role !== GroupRole::Mentor)->sortBy(fn (GroupMember $m) => $m->role === GroupRole::Leader ? 0 : 1)->pluck('user_id');

        return User::with('profile')->whereIn('id', $ids)->get()->sortBy(fn (User $u) => $ids->search($u->id))->values();
    }

    /** A line in the group's #general from the student, so the group sees the work coming in. */
    private function tellTheGroup(ResearchGroup $group, User $me, string $text): void
    {
        Groups::ensureGeneralChannel($group);
        $general = $group->channels()->where('name', 'general')->first();
        if ($general !== null) {
            Chat::post($general, $me->id, ['text' => $text]);
        }
    }

    /** @return list<int> */
    private function reviewerIds(ResearchGroup $group): array
    {
        return [$group->adviser_id, ...$group->members->where('role', GroupRole::Mentor)->pluck('user_id')->all()];
    }

    private function link(ResearchGroup $group, GroupDeadline $deadline): string
    {
        return "/groups/{$group->id}?tab=deadlines&deadline={$deadline->id}";
    }

    /** @return array<string, mixed> */
    private function deadline(GroupDeadline $d): array
    {
        return ['id' => $d->id, 'title' => $d->title, 'dueAt' => $d->due_at->toISOString(), 'submissionMode' => $d->submission_mode->value, 'instructions' => $d->instructions];
    }

    /** @return array<string, mixed>|null */
    private function submission(?DeliverableSubmission $s, GroupDeadline $deadline, Request $request): ?array
    {
        if ($s === null) {
            return null;
        }
        $s->setRelation('deadline', $deadline)->loadMissing([...Cards::user('student'), ...Cards::user('reviewedBy'), 'versions', ...Cards::user('versions.student'), ...Cards::user('versions.reviewedBy')]);
        $fileUrl = "/api/groups/{$deadline->research_group_id}/deadlines/{$deadline->id}/submissions/{$s->id}/file";
        $card = fn (?User $u) => $u ? (new UserCardResource($u))->resolve($request) : null;

        return [
            'id' => $s->id,
            'name' => $s->name,
            'size' => $s->size,
            'type' => $s->type,
            'fileUrl' => $fileUrl,
            'note' => $s->note,
            'version' => $s->version,
            'status' => $s->status->value,
            'late' => $s->isLate(),
            'submittedAt' => $s->submitted_at->toISOString(),
            'submittedBy' => $card($s->student),
            'feedback' => $s->feedback,
            'reviewedBy' => $card($s->reviewedBy),
            'reviewedAt' => $s->reviewed_at?->toISOString(),
            // Earlier versions, newest first, each with the review it got
            'history' => $s->versions->map(fn (DeliverableVersion $v) => [
                'version' => $v->version,
                'name' => $v->name,
                'size' => $v->size,
                'fileUrl' => str_replace('/file', "/versions/{$v->version}/file", $fileUrl),
                'note' => $v->note,
                'status' => $v->status->value,
                'late' => $v->submitted_at->gt($deadline->due_at),
                'submittedAt' => $v->submitted_at->toISOString(),
                'submittedBy' => $card($v->student),
                'feedback' => $v->feedback,
                'reviewedBy' => $card($v->reviewedBy),
                'reviewedAt' => $v->reviewed_at?->toISOString(),
            ])->all(),
        ];
    }
}
