<?php

namespace App\Enums;

/** What an educator can post as an opportunity. */
enum OpportunityKind: string
{
    case Mentorship = 'mentorship';
    case Grant = 'grant';
    case Call = 'call';
}
