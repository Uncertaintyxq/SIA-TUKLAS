<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A snapshot taken at every submission, so each resubmission is kept. */
#[Fillable(['version', 'title', 'abstract', 'tags', 'pdf_file', 'pdf_name', 'note', 'submitted_at'])]
class WorkVersion extends Model
{
    public $timestamps = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['note' => ''];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'submitted_at' => 'datetime',
        ];
    }

    public function work(): BelongsTo
    {
        return $this->belongsTo(Work::class);
    }
}
