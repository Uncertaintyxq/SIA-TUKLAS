<?php

namespace App\Http\Requests\Publications;

use App\Enums\PublicationVisibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PublicationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'abstract' => ['required', 'string', 'min:30', 'max:6000'],
            'keywords' => ['array', 'max:10'],
            'keywords.*' => ['required', 'string', 'min:1', 'max:40'],
            'methodology' => ['nullable', 'string', 'max:20000'],
            'fullText' => ['nullable', 'string', 'max:200000'],
            'coAuthorIds' => ['array', 'max:10'],
            'coAuthorIds.*' => ['integer', 'min:1', 'distinct'],
            'visibility' => ['nullable', Rule::enum(PublicationVisibility::class)],
        ];
    }

    public function messages(): array
    {
        return [
            'title.*' => 'Give the research a title of at least 5 characters',
            'abstract.*' => 'Write an abstract of at least 30 characters',
            'keywords.max' => 'Use at most 10 keywords',
            'methodology.max' => 'Keep the methodology under 20,000 characters',
            'fullText.max' => 'The full text is too long; attach it as a PDF instead',
            'coAuthorIds.max' => 'Add at most 10 co-authors',
        ];
    }

    public function visibility(): PublicationVisibility
    {
        return PublicationVisibility::tryFrom((string) $this->validated('visibility')) ?? PublicationVisibility::Draft;
    }

    /** @return array<string, mixed> */
    public function fields(): array
    {
        return [
            'title' => $this->validated('title'),
            'abstract' => $this->validated('abstract'),
            'keywords' => array_values($this->validated('keywords', [])),
            'methodology' => $this->string('methodology')->toString(),
            'full_text' => $this->string('fullText')->toString(),
            'visibility' => $this->visibility(),
        ];
    }

    /** @return array<int, array{order: int}> */
    public function byline(): array
    {
        $rows = [];
        foreach (array_values(array_unique(array_map('intval', $this->validated('coAuthorIds', [])))) as $i => $id) {
            $rows[$id] = ['order' => $i + 1];
        }

        return $rows;
    }
}
