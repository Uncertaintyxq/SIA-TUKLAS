<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'titles' => ['nullable', 'string', 'max:120'],
            'program' => ['required', 'string', 'min:2', 'max:160'],
            // One of their own school's departments (docs/decisions/0002)
            'departmentId' => ['nullable', 'integer', Rule::exists('departments', 'id')->where(fn ($q) => $this->user()->institution_id === null
                ? $q->whereNull('institution_id') : $q->where('institution_id', $this->user()->institution_id))],
            'headline' => ['nullable', 'string', 'max:160'],
            'bioLong' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return ['name.*' => 'Enter your full name', 'program.*' => 'Enter your program or position', 'departmentId.*' => 'Choose one of your school’s departments'];
    }
}
