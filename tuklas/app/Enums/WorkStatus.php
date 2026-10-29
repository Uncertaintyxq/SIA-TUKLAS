<?php

namespace App\Enums;

/** draft → submitted → under_review → revision | approved | rejected. Only approved works (not removed) are public. */
enum WorkStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case Revision = 'revision';
    case Approved = 'approved';
    case Rejected = 'rejected';

    /**
     * Decisions a reviewer may take from this status. `approved` and `rejected` are final.
     *
     * @return list<ReviewDecision>
     */
    public function allowedDecisions(): array
    {
        return match ($this) {
            self::Submitted => [ReviewDecision::StartReview, ReviewDecision::Revise, ReviewDecision::Approve, ReviewDecision::Reject],
            self::UnderReview => [ReviewDecision::Revise, ReviewDecision::Approve, ReviewDecision::Reject],
            self::Revision => [ReviewDecision::Approve, ReviewDecision::Reject],
            self::Draft, self::Approved, self::Rejected => [],
        };
    }

    public function isFinal(): bool
    {
        return $this === self::Approved || $this === self::Rejected;
    }

    /** While the author and adviser talk in the private review thread. */
    public function inReview(): bool
    {
        return in_array($this, [self::Submitted, self::UnderReview, self::Revision], true);
    }
}
