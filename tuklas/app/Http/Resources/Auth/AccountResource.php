<?php

namespace App\Http\Resources\Auth;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in person's own account, as /api/auth/me and login return it (PublicUser in the
 * client). Only ever sent to the account's owner: it includes the email address.
 *
 * @mixin User
 */
class AccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role->value,
            // False for an educator an admin hasn't verified yet
            'verified' => $this->verified,
            'program' => $this->program,
            'headline' => $this->headline,
            'rights' => $this->rights(),
            'emailVerified' => $this->hasVerifiedEmail(),
            // What the React app must ask for before anything else works (EnsureAccountReady). Demo mode skips both.
            'emailVerificationRequired' => ! $this->hasVerifiedEmail() && ! config('tuklas.demo_mode'),
            'twoFactorEnabled' => $this->hasTwoFactorEnabled(),
            'twoFactorRequired' => $this->mustUseTwoFactor() && ! config('tuklas.demo_mode'),
            'privacyAccepted' => $this->privacy_version === config('tuklas.privacy_version'),
        ];
    }
}
