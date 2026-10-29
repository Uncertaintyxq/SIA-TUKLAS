<?php

namespace App\Http\Controllers\Works;

use App\Actions\Works\DecideOnWork;
use App\Actions\Works\SubmitWork;
use App\Enums\CommentScope;
use App\Enums\ReviewDecision;
use App\Http\Controllers\Controller;
use App\Http\Requests\Works\DecisionRequest;
use App\Models\RevisionItem;
use App\Models\User;
use App\Support\Notifier;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Submission, the adviser's decisions, the private review thread and the revision checklist. */
class ReviewController extends Controller
{
    /** POST /api/works/{id}/submit {note?} */
    public function submit(Request $request, SubmitWork $submit, int $id): Response
    {
        $note = $request->validate(['note' => ['nullable', 'string', 'max:500']])['note'] ?? '';
        $work = WorkController::visible($id);
        if (Gate::denies('edit', $work)) {
            throw new HttpException(409, 'Only the main author can submit, and only a draft or a work sent back for revision.');
        }
        $submit->handle($work, $request->user(), $note);

        return response()->noContent();
    }

    /** POST /api/works/{id}/decision {decision, comment?, items?} */
    public function decide(DecisionRequest $request, DecideOnWork $decide, int $id): Response
    {
        /** @var User $me */
        $me = $request->user();
        $work = WorkController::visible($id);
        if (Gate::denies('review', $work)) {
            throw new HttpException(403, $me->isEducator() && ! $me->verified
                ? 'An admin needs to verify your educator account before you can review work.'
                : 'Only the assigned adviser or an admin can decide on this work, and never on their own.');
        }
        $decide->handle($work, $me, ReviewDecision::from($request->validated('decision')), $request->string('comment')->toString(), array_values($request->validated('items', [])));

        return response()->noContent();
    }

    /** POST /api/works/{id}/comments {text} — the private thread between the authors and the adviser. */
    public function comment(Request $request, int $id): Response
    {
        $text = $request->validate(['text' => ['required', 'string', 'min:1', 'max:4000']], ['text.*' => 'Write something first'])['text'];
        /** @var User $me */
        $me = $request->user();
        $work = WorkController::visible($id);
        if (Gate::denies('insider', $work)) {
            throw new HttpException(404, WorkController::NOT_FOUND);
        }
        if (! $work->status->inReview()) {
            throw new HttpException(409, 'The review thread is closed for this work.');
        }

        $work->comments()->create(['author_id' => $me->id, 'text' => $text, 'scope' => CommentScope::Review]);
        $to = $work->isAuthor($me) ? [$work->adviser_id, ...$work->authorIds()] : $work->authorIds();
        Notifier::notify($to, 'work_comment', "{$me->name} commented on “{$work->title}”.", "/works/{$work->id}", $me->id);

        return response()->noContent(201);
    }

    /** PATCH /api/works/{id}/items/{itemId} {done?, confirmed?} — authors tick their fixes; the reviewer confirms each one. */
    public function item(Request $request, int $id, int $itemId): Response
    {
        $patch = $request->validate(['done' => ['sometimes', 'boolean'], 'confirmed' => ['sometimes', 'boolean']]);
        $work = WorkController::visible($id);
        $item = RevisionItem::whereKey($itemId)->whereHas('review', fn ($q) => $q->where('work_id', $work->id))->first()
            ?? throw new HttpException(404, 'Not found');
        if ($work->status->isFinal()) {
            throw new HttpException(409, 'This work is final; its checklist can’t change.');
        }

        if (array_key_exists('done', $patch)) {
            if (! $work->isAuthor($request->user())) {
                throw new HttpException(403, 'Only the authors tick off their fixes.');
            }
            if ($item->confirmed_by_adviser) {
                throw new HttpException(409, 'Your adviser already confirmed this fix.');
            }
            $item->done_by_student = (bool) $patch['done'];
        }
        if (array_key_exists('confirmed', $patch)) {
            if (Gate::denies('review', $work)) {
                throw new HttpException(403, 'Only the reviewer confirms fixes.');
            }
            if ($patch['confirmed'] && ! $item->done_by_student) {
                throw new HttpException(409, 'The author hasn’t marked this fix as done yet.');
            }
            $item->confirmed_by_adviser = (bool) $patch['confirmed'];
        }
        $item->save();

        return response()->noContent();
    }
}
