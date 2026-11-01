<?php

namespace App\Enums;

/** Open until an admin looks at it; then dismissed (nothing wrong) or actioned (removed or warned). */
enum ReportStatus: string
{
    case Open = 'open';
    case Dismissed = 'dismissed';
    case Actioned = 'actioned';
}
