<?php

namespace App\Enums;

/** One reaction per reader per work. */
enum ReactionKind: string
{
    case Insightful = 'insightful';
    case Useful = 'useful';
    case Inspiring = 'inspiring';
}
