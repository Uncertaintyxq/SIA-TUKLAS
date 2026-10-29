<?php

namespace App\Http\Requests\Works;

use App\Enums\ReviewDecision;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecisionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::enum(ReviewDecision::class)],
            'comment' => ['nullable', 'string', 'max:4000'],
            // Revision checklist: one fix per entry (only with `revise`)
            'items' => ['array', 'max:20'],
            'items.*' => ['required', 'string', 'min:1', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['items.max' => 'Use at most 20 checklist items'];
    }
}
