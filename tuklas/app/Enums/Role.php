<?php

namespace App\Enums;

/** Account role. Admins are issued by the Office of Research, never self-created. */
enum Role: string
{
    case Student = 'student';
    case Educator = 'educator';
    case Admin = 'admin';
}
