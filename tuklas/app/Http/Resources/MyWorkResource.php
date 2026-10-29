<?php

namespace App\Http\Resources;

use App\Models\Work;
use Illuminate\Http\Request;

/**
 * A work as "My research" and the review board show it (MyWork in the client). Load it with
 * Cards::myWorks(). Only ever sent to the work's authors, its adviser or an admin.
 *
 * @mixin Work
 */
class MyWorkResource extends WorkCardResource
{
    public function toArray(Request $request): array
    {
        $latest = $this->reviews->first();

        return [
            ...parent::toArray($request),
            'createdAt' => $this->created_at->toISOString(),
            'updatedAt' => $this->updated_at->toISOString(),
            'submittedAt' => $this->submitted_at?->toISOString(),
            'versionCount' => (int) $this->versions_count,
            'hasPdf' => $this->pdf_file !== null,
            'isOwner' => $this->author_id === $request->user()?->id,
            'openItems' => $this->reviews->flatMap->revisionItems->where('confirmed_by_adviser', false)->count(),
            'latestReview' => $latest ? [
                'decision' => $latest->decision->value,
                'comment' => $latest->comment,
                'reviewerName' => $latest->reviewer->name,
                'createdAt' => $latest->created_at->toISOString(),
            ] : null,
        ];
    }
}
