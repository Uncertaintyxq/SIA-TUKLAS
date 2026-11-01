<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A chat message. The text is encrypted at rest, so it can't be searched in SQL (docs/CONVERSION.md D7).
 * A removed message keeps its row with deleted_at set, so threads still make sense. An edited one has
 * edited_at set; its earlier text isn't kept.
 */
#[Fillable(['sender_id', 'parent_id', 'text', 'file', 'file_name', 'file_type', 'file_size', 'group_file_id'])]
class Message extends Model
{
    public const UPDATED_AT = null;

    protected $casts = [
        'text' => 'encrypted',
        'deleted_at' => 'datetime',
        'edited_at' => 'datetime',
    ];

    /** @return HasMany<MessageReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /** @return BelongsTo<Message, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_id');
    }

    /** @return HasMany<Message, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_id');
    }

    /** @return BelongsTo<GroupFile, $this> */
    public function groupFile(): BelongsTo
    {
        return $this->belongsTo(GroupFile::class);
    }
}
