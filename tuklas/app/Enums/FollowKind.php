<?php

namespace App\Enums;

/** What someone can follow: a person, a department or a keyword. */
enum FollowKind: string
{
    case Person = 'person';
    case Department = 'department';
    case Tag = 'tag';
}
