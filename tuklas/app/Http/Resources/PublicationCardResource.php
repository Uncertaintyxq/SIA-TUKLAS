<?php

namespace App\Http\Resources;

use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Educator research as lists show it (PublicationCard in the client). Load it with Cards::publications().
 *
 * @mixin Publication
 */
class PublicationCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'abstract' => $this->abstract,
            'keywords' => array_values(array_filter($this->keywords ?? [], 'is_string')),
            'visibility' => $this->visibility->value,
            'authors' => UserCardResource::collection(collect([$this->author])->concat($this->coAuthors)),
            'department' => $this->author->profile?->department ?? '',
            'hasPdf' => $this->pdf_file !== null,
            'publishedAt' => $this->published_at?->toISOString(),
            'createdAt' => $this->created_at->toISOString(),
            'updatedAt' => $this->updated_at->toISOString(),
        ];
    }
}
