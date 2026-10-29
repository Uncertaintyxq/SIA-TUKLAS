<?php

namespace App\Http\Requests\Events;

use Illuminate\Foundation\Http\FormRequest;

/** `status` is never accepted: a non-admin's ad request is always saved as pending. */
class AdRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'headline' => ['required', 'string', 'min:5', 'max:120'],
            'startsAt' => ['required', 'date'],
            'endsAt' => ['required', 'date', 'after:startsAt'],
        ];
    }

    public function messages(): array
    {
        return [
            'headline.*' => 'Write a headline of at least 5 characters',
            'startsAt.*' => 'Enter when the promo starts',
            'endsAt.after' => 'The promo must end after it starts',
            'endsAt.*' => 'Enter when the promo ends',
        ];
    }
}
