<?php

namespace App\Enums;

/** review comments are the private author–adviser thread; public ones are feed discussion. */
enum CommentScope: string
{
    case Review = 'review';
    case Public = 'public';
}
