<?php

namespace App\Http\Requests\Events;

use App\Enums\EventCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Advertising and events are limited to academic ones: anything else fails here and in the MySQL ENUM. */
class EventRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'category' => ['required', Rule::enum(EventCategory::class)],
            'title' => ['required', 'string', 'min:5', 'max:140'],
            'description' => ['required', 'string', 'min:20', 'max:4000'],
            'venue' => ['required', 'string', 'min:2', 'max:160'],
            'date' => ['required', 'date', 'after:-1 minute'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'category.*' => 'Only academic events can be posted on Tuklas.',
            'title.*' => 'Give the event a title of at least 5 characters',
            'description.*' => 'Describe the event in at least 20 characters',
            'venue.*' => 'Enter the venue',
            'date.after' => 'Choose a date in the future',
            'date.*' => 'Enter the date and time',
        ];
    }
}
