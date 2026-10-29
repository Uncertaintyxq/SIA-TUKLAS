<?php

namespace App\Http\Resources;

use App\Models\Opportunity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A mentorship, grant or call (OpportunityCard in the client). Load it with Cards::opportunities().
 *
 * @mixin Opportunity
 */
class OpportunityCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'title' => $this->title,
            'description' => $this->description,
            'deadline' => $this->deadline->toISOString(),
            'slots' => $this->slots,
            'createdAt' => $this->created_at->toISOString(),
            'adviser' => new UserCardResource($this->adviser),
            'applied' => (bool) $this->applied,
            'isOwner' => $this->adviser_id === $request->user()?->id,
        ];
    }
}
