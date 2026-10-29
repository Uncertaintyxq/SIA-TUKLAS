<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A person as every screen shows them: name, role badge, photo and where they belong (UserCard in
 * the client). Never includes the email address. Load `profile` with it (Cards::USER).
 *
 * @mixin User
 */
class UserCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->profile;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'role' => $this->role->value,
            // Educators only count as advisers once an admin verifies them
            'verified' => $this->verified,
            'program' => $this->program,
            'department' => $profile?->department ?? '',
            // The version query busts the browser cache when the photo changes
            'photoUrl' => $profile?->photo_file
                ? "/api/users/{$this->username}/photo?v=".($profile->updated_at?->getTimestampMs() ?? 0)
                : null,
        ];
    }
}
