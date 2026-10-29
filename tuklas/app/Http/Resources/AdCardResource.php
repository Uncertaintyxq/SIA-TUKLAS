<?php

namespace App\Http\Resources;

use App\Models\Ad;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An academic ad slot (AdCard in the client). Load it with Cards::ads().
 *
 * @mixin Ad
 */
class AdCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'headline' => $this->headline,
            'imageUrl' => $this->image_file ? "/api/ads/{$this->id}/image" : null,
            'startsAt' => $this->starts_at->toISOString(),
            'endsAt' => $this->ends_at->toISOString(),
            'status' => $this->status->value,
            'event' => [
                'id' => $this->event->id,
                'title' => $this->event->title,
                'category' => $this->event->category->value,
                'date' => $this->event->date->toISOString(),
                'venue' => $this->event->venue,
            ],
            'createdBy' => new UserCardResource($this->createdBy),
        ];
    }
}
