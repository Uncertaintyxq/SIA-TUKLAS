<?php

namespace App\Enums;

/** What a group deadline collects: nothing (a reminder), one submission per student, or one for the group. */
enum SubmissionMode: string
{
    case None = 'none';
    case Each = 'each';
    case Group = 'group';
}
