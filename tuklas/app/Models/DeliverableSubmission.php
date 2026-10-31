<?php

namespace App\Models;

use App\Enums\SubmissionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student's (or a group's) work handed in against a group deadline. `file` is the random stored
 * name on the private disk. The note and the reviewer's feedback are encrypted at rest.
 */
#[Fillable(['student_id', 'file', 'name', 'type', 'size', 'note', 'version', 'status', 'feedback', 'reviewed_by_id', 'reviewed_at', 'submitted_at'])]
class DeliverableSubmission extends Model
{
    public $timestamps = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['version' => 1, 'status' => 'submitted', 'note' => null, 'feedback' => null, 'reviewed_by_id' => null, 'reviewed_at' => null];

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

    public function deadline(): BelongsTo
    {
        return $this->belongsTo(GroupDeadline::class, 'group_deadline_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }

    /** Handed in after the deadline. */
    public function isLate(): bool
    {
        return $this->submitted_at->gt($this->deadline->due_at);
    }
}
