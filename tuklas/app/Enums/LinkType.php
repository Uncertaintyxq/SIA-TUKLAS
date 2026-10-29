<?php

namespace App\Enums;

/** Academic profile links. */
enum LinkType: string
{
    case Scholar = 'scholar';
    case Orcid = 'orcid';
    case Researchgate = 'researchgate';
    case Linkedin = 'linkedin';
    case Faculty = 'faculty';
    case Other = 'other';
}
