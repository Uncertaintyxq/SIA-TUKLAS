<?php

namespace App\Models;

use App\Enums\SubmissionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An earlier version of a deliverable submission, with the review it got. Read-only once written. */
#[Fillable(['version', 'student_id', 'file', 'name', 'type', 'size', 'note', 'status', 'feedback', 'reviewed_by_id', 'reviewed_at', 'submitted_at'])]
class DeliverableVersion extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'note' => 'encrypted',
            'feedback' => 'encrypted',
            'status' => SubmissionStatus::class,
            'reviewed_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(DeliverableSubmission::class, 'deliverable_submission_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }
}
