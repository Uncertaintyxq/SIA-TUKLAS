<?php

namespace App\Http\Requests\Profile;

use App\Enums\LinkType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLinksRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'links' => ['present', 'array', 'max:12'],
            'links.*.type' => ['required', Rule::enum(LinkType::class)],
            // Only web links: no javascript:, data: or other schemes that could run on click
            'links.*.url' => ['required', 'string', 'max:300', 'url:http,https'],
            'links.*.label' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function messages(): array
    {
        return ['links.max' => 'Add at most 12 links', 'links.*.url.url' => 'Enter a full link, starting with https://'];
    }
}
