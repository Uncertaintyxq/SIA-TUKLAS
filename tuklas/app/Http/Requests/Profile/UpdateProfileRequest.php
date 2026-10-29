<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'titles' => ['nullable', 'string', 'max:120'],
            'program' => ['required', 'string', 'min:2', 'max:160'],
            'department' => ['nullable', 'string', 'max:160'],
            'headline' => ['nullable', 'string', 'max:160'],
            'bioLong' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return ['name.*' => 'Enter your full name', 'program.*' => 'Enter your program or position'];
    }
}
