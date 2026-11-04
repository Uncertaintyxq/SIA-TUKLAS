<?php

namespace App\Support;

use App\Enums\FollowKind;
use App\Models\Follow;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Following: what someone follows, and telling followers when something new goes public. Only
 * call tell…() once a work is approved or research leaves Draft, never for anything still private.
 */
class Followers
{
    /**
     * What this person follows.
     *
     * @return array{people: list<int>, departments: list<int>, tags: list<string>}
     */
    public static function of(User $user): array
    {
        $rows = Follow::where('user_id', $user->id)->orderBy('id')->get(['kind', 'target']);
        $targets = fn (FollowKind $kind) => $rows->where('kind', $kind)->pluck('target')->values();

        return [
            'people' => $targets(FollowKind::Person)->map(fn ($id) => (int) $id)->all(),
            'departments' => $targets(FollowKind::Department)->map(fn ($id) => (int) $id)->all(),
            'tags' => $targets(FollowKind::Tag)->all(),
        ];
    }

    /** A work just went public: its authors' followers, its department's and its keywords' (only its school's, when it's School only), not the approver. */
    public static function tellAboutWork(Work $work, ?int $approverId = null): void
    {
        $work->loadMissing(['author.profile', 'coAuthors']);
        $people = $work->authorIds();
        $ids = self::following($people, $work->author->profile?->department_id, $work->tags ?? []);
        $ids = User::whereIn('id', array_diff($ids, $people))->get()->filter(fn (User $u) => $work->canBeReadBy($u))->pluck('id')->all();
        Notifier::notify(array_values($ids), 'follow_work', "New on Tuklas: “{$work->title}” by {$work->author->name}.", "/works/{$work->id}", $approverId);
    }

    /** Research just left Draft: its authors' followers, its department's and its keywords' (only its school's, when it's School only). */
    public static function tellAboutPublication(Publication $p): void
    {
        $p->loadMissing(['author.profile', 'coAuthors']);
        $people = [$p->author_id, ...$p->coAuthors->pluck('id')->all()];
        $ids = self::following($people, $p->author->profile?->department_id, $p->keywords ?? []);
        $ids = User::whereIn('id', array_diff($ids, $people))->get()->filter(fn (User $u) => $p->canBeReadBy($u))->pluck('id')->all();
        Notifier::notify(array_values($ids), 'follow_research', "{$p->author->name} published “{$p->title}”.", "/publications/{$p->id}");
    }

    /**
     * Who follows any of these people, this department or any of these keywords.
     *
     * @param  list<int>  $people
     * @param  array<mixed>  $tags
     * @return list<int>
     */
    private static function following(array $people, ?int $department, array $tags): array
    {
        $tags = array_values(array_unique(array_map(fn ($t) => mb_strtolower(trim($t)), array_filter($tags, fn ($t) => is_string($t) && trim($t) !== ''))));

        return Follow::query()
            ->where(function (Builder $q) use ($people, $department, $tags) {
                $q->where(fn ($f) => $f->where('kind', FollowKind::Person)->whereIn('target', array_map('strval', $people)));
                if ($department) {
                    $q->orWhere(fn ($f) => $f->where('kind', FollowKind::Department)->where('target', (string) $department));
                }
                if ($tags !== []) {
                    $q->orWhere(fn ($f) => $f->where('kind', FollowKind::Tag)->whereIn(DB::raw('LOWER(target)'), $tags));
                }
            })
            ->distinct()
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
