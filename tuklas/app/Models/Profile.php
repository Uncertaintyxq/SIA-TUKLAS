<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Portfolio details beyond the basics on users (name, program = position, headline = short bio). */
#[Fillable(['titles', 'department', 'bio_long'])]
class Profile extends Model
{
    public const CREATED_AT = null;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['titles' => '', 'department' => ''];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
