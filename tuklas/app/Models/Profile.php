<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Portfolio details beyond the basics on users (name, program = position, headline = short bio). */
#[Fillable(['titles', 'department_id', 'bio_long'])]
class Profile extends Model
{
    public const CREATED_AT = null;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    /** Column defaults, so a new model has them before it's reloaded. */
    protected $attributes = ['titles' => '', 'department_id' => null];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /** The department's name, or '' (read from the request's department list, not a query each). */
    public function departmentName(): string
    {
        return $this->department_id !== null ? (string) Department::byId()->get($this->department_id)?->name : '';
    }
}
