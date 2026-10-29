<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A student's application to an opportunity. Keyed by (opportunity_id, user_id). */
#[Fillable(['opportunity_id', 'user_id', 'message'])]
class OpportunityApplication extends Model
{
    public const UPDATED_AT = null;

    protected $primaryKey = null;

    public $incrementing = false;

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
