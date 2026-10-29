<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A chat message. The text is encrypted at rest, so it can't be searched in SQL (docs/CONVERSION.md D7).
 * A removed message keeps its row with deleted_at set, so threads still make sense.
 */
#[Fillable(['sender_id', 'parent_id', 'text', 'file', 'file_name', 'file_type', 'file_size', 'group_file_id'])]
class Message extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'text' => 'encrypted',
            'deleted_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_id');
    }

    public function groupFile(): BelongsTo
    {
        return $this->belongsTo(GroupFile::class);
    }
}
