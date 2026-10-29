<?php

namespace App\Models;

use App\Enums\LinkType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['type', 'url', 'label'])]
class AcademicLink extends Model
{
    public $timestamps = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['label' => ''];

    protected function casts(): array
    {
        return ['type' => LinkType::class];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
