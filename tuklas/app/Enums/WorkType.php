<?php

namespace App\Enums;

/** Kind of student work. */
enum WorkType: string
{
    case Research = 'research';
    case Literary = 'literary';
    case Innovation = 'innovation';
}
