<?php

namespace App\Enums;

/**
 * Educator research: drafts are the authors' alone, internal is School only (signed-in members of
 * the research's school, docs/decisions/0002; the stored value kept its old name), public is for everyone.
 */
enum PublicationVisibility: string
{
    case Draft = 'draft';
    case Internal = 'internal';
    case Public = 'public';
}
