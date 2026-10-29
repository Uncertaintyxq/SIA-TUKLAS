<?php

namespace App\Http\Requests\Works;

use App\Enums\WorkType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** A work's details, for creating (with `submit`) and editing. Who may do it is WorkPolicy's job. */
class WorkRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(WorkType::class)],
            'title' => ['required', 'string', 'min:5', 'max:180'],
            'abstract' => ['required', 'string', 'min:30', 'max:6000'],
            'tags' => ['array', 'max:10'],
            'tags.*' => ['required', 'string', 'min:1', 'max:40'],
            'adviserId' => ['required', 'integer', 'min:1'],
            'coAuthorIds' => ['array', 'max:10'],
            'coAuthorIds.*' => ['integer', 'min:1', 'distinct'],
            // Creating only: false saves a draft; true submits it to the adviser straight away
            'submit' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.*' => 'Give the work a title of at least 5 characters',
            'abstract.*' => 'Write an abstract of at least 30 characters',
            'tags.max' => 'Use at most 10 keywords',
            'adviserId.*' => 'Choose a research adviser',
            'coAuthorIds.max' => 'Add at most 10 co-authors',
        ];
    }

    /** @return list<string> */
    public function tags(): array
    {
        return array_values($this->validated('tags', []));
    }

    /** @return list<int> */
    public function coAuthorIds(): array
    {
        return array_values(array_unique(array_map('intval', $this->validated('coAuthorIds', []))));
    }
}
