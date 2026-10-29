<?php

namespace App\Http\Requests\Works;

use App\Enums\DefenseStageKind;
use App\Enums\Verdict;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** A defense tracker stage. */
class StageRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'stage' => ['required', Rule::enum(DefenseStageKind::class)],
            'date' => ['required', 'date'],
            'panel' => ['nullable', 'string', 'max:300'],
            'verdict' => ['nullable', Rule::enum(Verdict::class)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['date.*' => 'Enter the date'];
    }

    /** @return array<string, mixed> */
    public function stage(): array
    {
        return [
            'stage' => $this->validated('stage'),
            'date' => $this->date('date'),
            'panel' => $this->string('panel')->toString(),
            'verdict' => $this->validated('verdict') ?? Verdict::Pending->value,
            'notes' => $this->string('notes')->toString(),
        ];
    }
}
