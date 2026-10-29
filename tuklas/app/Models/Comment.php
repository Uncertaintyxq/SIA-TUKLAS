<?php

namespace App\Models;

use App\Enums\CommentScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * `review` comments are the private thread between authors and adviser; `public` ones are feed discussion.
 * The text is encrypted at rest.
 */
#[Fillable(['author_id', 'scope', 'text'])]
class Comment extends Model
{
    public const UPDATED_AT = null;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['scope' => 'review'];

    protected function casts(): array
    {
        return [
            'scope' => CommentScope::class,
            'text' => 'encrypted',
        ];
    }

    public function work(): BelongsTo
    {
        return $this->belongsTo(Work::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
