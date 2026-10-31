<?php

namespace App\Enums;

/** Where a deliverable submission stands with its reviewers. Handing it in again resets it to Submitted. */
enum SubmissionStatus: string
{
    case Submitted = 'submitted';
    case NeedsRevision = 'needs_revision';
    case Accepted = 'accepted';
}
