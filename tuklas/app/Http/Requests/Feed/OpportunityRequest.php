<?php

namespace App\Http\Requests\Feed;

use App\Enums\OpportunityKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OpportunityRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::enum(OpportunityKind::class)],
            'title' => ['required', 'string', 'min:5', 'max:140'],
            'description' => ['required', 'string', 'min:20', 'max:4000'],
            'deadline' => ['required', 'date', 'after:-1 day'],
            'slots' => ['nullable', 'integer', 'min:1', 'max:99'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.*' => 'Give the posting a title of at least 5 characters',
            'description.*' => 'Describe the opportunity in at least 20 characters',
            'deadline.after' => 'Choose a deadline that hasn’t passed',
            'deadline.*' => 'Enter the application deadline',
        ];
    }
}
