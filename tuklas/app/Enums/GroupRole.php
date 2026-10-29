<?php

namespace App\Enums;

/** Seat inside a research group: students are members or the leader, educators join as mentors. */
enum GroupRole: string
{
    case Leader = 'leader';
    case Member = 'member';
    case Mentor = 'mentor';
}
