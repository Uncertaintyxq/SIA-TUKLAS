<?php

namespace App\Enums;

/** Advertising is limited to academic events. */
enum EventCategory: string
{
    case Colloquium = 'colloquium';
    case Defense = 'defense';
    case Fair = 'fair';
    case Innovation = 'innovation';
    case Cpgarcia = 'cpgarcia';
}
