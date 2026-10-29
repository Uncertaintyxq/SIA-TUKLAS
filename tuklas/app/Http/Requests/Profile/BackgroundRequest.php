<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class BackgroundRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'degree' => ['required', 'string', 'min:2', 'max:160'],
            'school' => ['required', 'string', 'min:2', 'max:160'],
            'year' => ['required', 'string', 'regex:/^\d{4}$/'],
        ];
    }

    public function messages(): array
    {
        return ['degree.*' => 'Enter the degree or diploma', 'school.*' => 'Enter the school', 'year.*' => 'Enter a 4-digit year'];
    }
}
