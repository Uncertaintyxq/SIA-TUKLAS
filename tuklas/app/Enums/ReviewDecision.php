<?php

namespace App\Enums;

/** What an adviser or admin decides on a work. */
enum ReviewDecision: string
{
    case StartReview = 'start_review';
    case Revise = 'revise';
    case Approve = 'approve';
    case Reject = 'reject';

    /** The status a work moves to after this decision. */
    public function statusAfter(): WorkStatus
    {
        return match ($this) {
            self::StartReview => WorkStatus::UnderReview,
            self::Revise => WorkStatus::Revision,
            self::Approve => WorkStatus::Approved,
            self::Reject => WorkStatus::Rejected,
        };
    }
}
