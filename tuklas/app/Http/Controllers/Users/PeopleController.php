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
        $users = User::with('profile')
            ->when($role, fn ($query) => $query->where('role', $role))
            ->where(fn ($query) => $query
                ->where('name', 'like', $like)
                ->orWhere('username', 'like', $like)
                ->orWhere('program', 'like', $like)
                ->orWhereHas('profile', fn ($p) => $p->where('department', 'like', $like)))
            ->orderBy('name')
            ->limit(10)
            ->get();

        return UserCardResource::collection($users);
    }

    /** GET /api/people/advisers — advisers a student can pick: verified educators only. */
    public function advisers(): AnonymousResourceCollection
    {
        return UserCardResource::collection(User::with('profile')->where('role', Role::Educator)->where('verified', true)->orderBy('name')->get());
    }
}
