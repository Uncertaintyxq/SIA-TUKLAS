<?php

namespace App\Enums;

/** Shared by events and ads: both need an admin before they go public. */
enum ApprovalStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
