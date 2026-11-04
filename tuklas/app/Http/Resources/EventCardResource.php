<?php

namespace App\Http\Resources;

use App\Models\Event;
use App\Models\Institution;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An academic event as lists show it (EventCard in the client). Load it with Cards::events().
 *
 * @mixin Event
 */
class EventCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // The posting school only, or every school (docs/decisions/0002)
            'audience' => $this->audience->value,
            'institution' => $this->institution_id !== null ? Institution::byId()->get($this->institution_id)?->card() : null,
            'id' => $this->id,
            'category' => $this->category->value,
            'title' => $this->title,
            'description' => $this->description,
            'venue' => $this->venue,
            'date' => $this->date->toISOString(),
            'capacity' => $this->capacity,
            'status' => $this->status->value,
            'organizer' => new UserCardResource($this->postedBy),
            'registrationCount' => (int) $this->attendees_count,
            'registered' => (bool) $this->registered,
            'createdAt' => $this->created_at->toISOString(),
        ];
    }
}
