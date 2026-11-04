<?php

namespace App\Enums;

/**
 * Who may read a work once it's approved (docs/decisions/0002): everyone, or signed-in members of
 * its school (plus its authors and adviser wherever they are).
 */
enum WorkVisibility: string
{
    case Public = 'public';
    case School = 'school';
}
