<?php

namespace App\Enums;

/** Panel verdict for a defense stage. */
enum Verdict: string
{
    case Pending = 'pending';
    case Passed = 'passed';
    case PassedWithRevisions = 'passed_with_revisions';
    case Failed = 'failed';
}
