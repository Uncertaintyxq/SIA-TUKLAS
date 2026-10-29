<?php

namespace App\Enums;

/** direct: a 1-on-1 chat. channel: a text channel inside a research group. */
enum ConversationKind: string
{
    case Direct = 'direct';
    case Channel = 'channel';
}
