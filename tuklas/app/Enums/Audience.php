<?php

namespace App\Enums;

/** Who sees an opportunity or event (docs/decisions/0002): the posting school, or every school. */
enum Audience: string
{
    case School = 'school';
    case All = 'all';
}
