<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Who is in a conversation, and how far they have read. Keyed by (conversation_id, user_id). */
#[Fillable(['conversation_id', 'user_id', 'last_read_at'])]
class ConversationMember extends Model
{
    public $timestamps = false;

    protected $primaryKey = null;

    public $incrementing = false;

    protected $casts = ['last_read_at' => 'datetime'];

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
