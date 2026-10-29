<?php

namespace App\Enums;

/** system: everyone (admins only). department: one department. group: one research group. */
enum AnnouncementScope: string
{
    case System = 'system';
    case Department = 'department';
    case Group = 'group';
}
