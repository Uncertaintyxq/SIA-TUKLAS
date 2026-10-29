<?php

namespace App\Actions\Works;

use App\Enums\DefenseStageKind;
use App\Enums\ReviewDecision;
use App\Enums\Verdict;
use App\Models\RevisionItem;
use App\Models\User;
use App\Models\Work;
use App\Support\Audit;
use App\Support\Notifier;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * An adviser's or admin's decision on a work (PLAN.md rule 2). Call after WorkPolicy::review passes.
 * Approving needs every revision checklist item confirmed first.
 */
class DecideOnWork
{
    /** @param list<string> $items */
    public function handle(Work $work, User $me, ReviewDecision $decision, string $comment, array $items): void
    {
        if ($work->removed_at !== null || ! in_array($decision, $work->status->allowedDecisions(), true)) {
            throw new HttpException(409, 'A work that is '.str_replace('_', ' ', $work->status->value).' can’t be changed that way.');
        }
        if ($decision === ReviewDecision::Revise && $comment === '' && $items === []) {
            throw new HttpException(400, 'Tell the author what to revise: add a comment or checklist items.');
        }
        if ($decision === ReviewDecision::Approve) {
            $open = RevisionItem::whereHas('review', fn ($q) => $q->where('work_id', $work->id))->where('confirmed_by_adviser', false)->count();
            if ($open > 0) {
                throw new HttpException(409, "Confirm the {$open} open revision checklist item".($open > 1 ? 's' : '').' before approving.');
            }
        }

        DB::transaction(function () use ($work, $me, $decision, $comment, $items) {
            $review = $work->reviews()->create([
                'reviewer_id' => $me->id,
                'decision' => $decision,
                'comment' => $comment === '' ? null : $comment,
                'version' => (int) $work->versions()->max('version') ?: 1,
            ]);
            if ($decision === ReviewDecision::Revise) {
                foreach ($items as $text) {
                    $review->revisionItems()->create(['text' => $text]);
                }
            }

            $work->status = $decision->statusAfter();
            if ($decision === ReviewDecision::Approve) {
                $work->forceFill(['approved_at' => now(), 'approved_by_id' => $me->id]);
                // Approval is the journey's last stop: "published" joins the defense tracker.
                $work->defenseStages()->create([
                    'stage' => DefenseStageKind::Published, 'date' => now(), 'verdict' => Verdict::Passed,
                    'panel' => $me->name, 'notes' => 'Approved and published on Tuklas.',
                ]);
            }
            $work->save();
        });

        Audit::log('work_'.$decision->value, $me, $work);

        [$type, $message] = match ($decision) {
            ReviewDecision::StartReview => ['work_under_review', "{$me->name} started reviewing “{$work->title}”."],
            ReviewDecision::Revise => ['work_revision', "{$me->name} returned “{$work->title}” with comments. Revise and resubmit."],
            ReviewDecision::Approve => ['work_approved', "“{$work->title}” was approved by {$me->name}. It’s now public."],
            ReviewDecision::Reject => ['work_rejected', "{$me->name} marked “{$work->title}” as not approved."],
        };
        Notifier::notify($work->authorIds(), $type, $message, "/works/{$work->id}", $me->id);
    }
}
