<?php

namespace App\Enums;

/**
 * system: every school (super-admins). school: one school (its admins). department: one department.
 * group: one research group.
 */
enum AnnouncementScope: string
{
    case System = 'system';
    case School = 'school';
    case Department = 'department';
    case Group = 'group';
}
