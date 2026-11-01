<?php

namespace App\Enums;

/** Why something was reported. The client shows a sentence for each (lib/labels.ts). */
enum ReportReason: string
{
    case Spam = 'spam';
    case Harassment = 'harassment';
    case Inappropriate = 'inappropriate';
    case Plagiarism = 'plagiarism';
    case Privacy = 'privacy';
    case Other = 'other';
}
