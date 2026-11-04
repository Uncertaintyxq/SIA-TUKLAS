<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Admins per school (docs/decisions/0002): a school's admins see and decide what belongs to their
 * school; super-admins see every school, or one they pick. See User::administers().
 */
class AdminScope
{
    /** The school an admin screen shows: a school admin's own; for super-admins the ?institution= they picked, or every school (null). */
    public static function school(Request $request): ?int
    {
        /** @var User $me */
        $me = $request->user();
        if (! $me->isSuperAdmin()) {
            return $me->institution_id;
        }
        $picked = (int) $request->query('institution', 0);

        return $picked > 0 ? $picked : null;
    }

    /**
     * One school's rows: by a column, or through a relation to a person (e.g. 'poster').
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public static function apply(Builder $query, ?int $school, string $column = 'institution_id', ?string $through = null): Builder
    {
        if ($school === null) {
            return $query;
        }

        return $through !== null
            ? $query->whereHas($through, fn ($q) => $q->where('institution_id', $school))
            : $query->where($column, $school);
    }

    /** Stops an admin acting on another school's people or content. */
    public static function check(User $me, ?int $school): void
    {
        if (! $me->administers($school)) {
            throw new HttpException(403, 'That belongs to another school. Its own admins handle it.');
        }
    }
}
