<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One person's emoji on a chat message. */
#[Fillable(['message_id', 'user_id', 'emoji'])]
class MessageReaction extends Model
{
    public const UPDATED_AT = null;

    /** The emoji people can react with, in the order the picker shows them */
    public const EMOJI = ['👍', '❤️', '😂', '🎉', '🤔', '🙏'];

    public $incrementing = false;

    protected $primaryKey = null;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
