<?php

namespace App\Models;

use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTarget;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Someone flagging a work, comment, message, event or person for an admin to look at. */
#[Fillable(['reporter_id', 'target_type', 'target_id', 'target_owner_id', 'reason', 'details', 'snapshot'])]
class Report extends Model
{
    protected $attributes = ['status' => 'open'];

    protected function casts(): array
    {
        return [
            'target_type' => ReportTarget::class,
            'reason' => ReportReason::class,
            'status' => ReportStatus::class,
            // What was reported can be a private message: encrypted at rest, like the message itself
            'details' => 'encrypted',
            'snapshot' => 'encrypted',
            'resolved_at' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_owner_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }
}
