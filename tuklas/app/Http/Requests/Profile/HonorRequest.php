<?php

namespace App\Http\Requests\Profile;

use App\Enums\HonorKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** `verified` is not accepted from the request: only the admin verify action sets it (PLAN.md rule 4). */
class HonorRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::enum(HonorKind::class)],
            'title' => ['required', 'string', 'min:2', 'max:160'],
            'issuer' => ['required', 'string', 'min:2', 'max:160'],
            'year' => ['required', 'string', 'regex:/^\d{4}$/'],
        ];
    }

    public function messages(): array
    {
        return ['title.*' => 'Enter the title of the honor', 'issuer.*' => 'Enter who gave it', 'year.*' => 'Enter a 4-digit year'];
    }
}
