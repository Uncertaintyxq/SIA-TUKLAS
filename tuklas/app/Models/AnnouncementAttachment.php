<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'file', 'type', 'size'])]
class AnnouncementAttachment extends Model
{
    public const UPDATED_AT = null;

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }
}
