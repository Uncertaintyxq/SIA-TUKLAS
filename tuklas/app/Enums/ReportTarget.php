<?php

namespace App\Enums;

/** What a report is about. */
enum ReportTarget: string
{
    case Work = 'work';
    case Comment = 'comment';
    case Message = 'message';
    case Event = 'event';
    case User = 'user';
}
