<?php

namespace App\Http\Resources;

use App\Enums\WorkStatus;
use App\Models\Institution;
use App\Models\Work;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A work as feeds, portfolios and lists show it (WorkCard in the client). Load it with
 * Cards::works(). Counts are only shown for public works.
 *
 * @mixin Work
 */
class WorkCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isPublic = $this->isPublished();
        $approved = $this->status === WorkStatus::Approved && $this->approved_at !== null;

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'title' => $this->title,
            'abstract' => $this->abstract,
            'tags' => array_values(array_filter($this->tags ?? [], 'is_string')),
            'status' => $this->status->value,
            'authors' => UserCardResource::collection(collect([$this->author])->concat($this->coAuthors)),
            'adviser' => new UserCardResource($this->adviser),
            'department' => $this->author->profile?->departmentName() ?? '',
            // Public, or School only: signed-in members of its school (docs/decisions/0002)
            'visibility' => $this->visibility->value,
            'institution' => $this->institution_id !== null ? Institution::byId()->get($this->institution_id)?->card() : null,
            'approvedAt' => $this->approved_at?->toISOString(),
            'approval' => $approved ? [
                'approvedAt' => $this->approved_at->toISOString(),
                'approverName' => $this->approvedBy->name ?? 'Academic panel',
                'approverRole' => $this->approvedBy?->role->value ?? 'admin',
            ] : null,
            'removed' => $this->removed_at !== null,
            'commentCount' => $isPublic ? (int) $this->public_comments_count : 0,
            'reactionCount' => $isPublic ? (int) $this->reactions_total : 0,
            // Reach: these only grow while the work is public (App\Support\Reach)
            'views' => (int) $this->view_count,
            'downloads' => (int) $this->download_count,
            'myReaction' => $this->reactions->first()?->kind->value,
            'saved' => $this->savedBy->isNotEmpty(),
        ];
    }
}
