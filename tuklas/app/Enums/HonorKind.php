<?php

namespace App\Enums;

/** Kinds of honors on a portfolio. */
enum HonorKind: string
{
    case Award = 'award';
    case Grant = 'grant';
    case Certification = 'certification';
}
