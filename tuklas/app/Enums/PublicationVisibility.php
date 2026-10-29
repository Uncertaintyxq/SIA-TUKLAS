<?php

namespace App\Enums;

/** Educator research: drafts are the authors' alone, internal is for signed-in users, public is for everyone. */
enum PublicationVisibility: string
{
    case Draft = 'draft';
    case Internal = 'internal';
    case Public = 'public';
}
