<?php

namespace App\Http\Controllers\Users;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Finding people: co-author and member pickers, the adviser list. /api/people/… */
class PeopleController extends Controller
{
    /** GET /api/people/search?q=&role= — at most 10 people; no emails. */
    public function search(Request $request): AnonymousResourceCollection
    {
        $q = mb_substr(trim((string) $request->query('q', '')), 0, 80);
        $role = Role::tryFrom((string) $request->query('role', ''));
        if (mb_strlen($q) < 2) {
            return UserCardResource::collection([]);
        }

        $like = '%'.addcslashes($q, '%_\\').'%';
        $users = User::with('profile')->active()
            ->when($role, fn ($query) => $query->where('role', $role))
            ->where(fn ($query) => $query
                ->where('name', 'like', $like)
                ->orWhere('username', 'like', $like)
                ->orWhere('program', 'like', $like)
                ->orWhereHas('profile.department', fn ($d) => $d->where('name', 'like', $like)))
            ->orderBy('name')
            ->limit(10)
            ->get();

        return UserCardResource::collection($users);
    }

    /** GET /api/people/advisers — advisers a student can pick: verified educators of their own school (docs/decisions/0002). */
    public function advisers(Request $request): AnonymousResourceCollection
    {
        $school = $request->user()->institution_id;

        return UserCardResource::collection(User::with('profile')->active()->where('role', Role::Educator)->where('verified', true)
            ->when($school !== null, fn ($q) => $q->where('institution_id', $school))
            ->orderBy('name')->get());
    }
}
