<?php

namespace App\Http\Controllers\Users;

use App\Enums\FollowKind;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserCardResource;
use App\Models\Department;
use App\Models\Follow;
use App\Models\User;
use App\Support\Followers;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Following people, departments and keywords. /api/follows */
class FollowController extends Controller
{
    /** GET /api/follows — what I follow */
    public function index(Request $request): JsonResponse
    {
        $mine = Followers::of($request->user());
        $people = User::with('profile')->active()->whereIn('id', $mine['people'])->orderBy('name')->get();

        $departments = Department::byId()->only($mine['departments'])->map->card()->values();

        return response()->json(['people' => UserCardResource::collection($people), 'departments' => $departments, 'tags' => $mine['tags']]);
    }

    /** POST /api/follows {kind, target} — following twice is fine */
    public function store(Request $request): Response
    {
        [$kind, $target] = $this->target($request);
        $me = $request->user();
        if ($kind === FollowKind::Person) {
            if ((int) $target === $me->id) {
                throw new HttpException(400, 'You can’t follow yourself.');
            }
            if (! User::active()->whereKey((int) $target)->exists()) {
                throw new HttpException(404, 'That person couldn’t be found.');
            }
        }
        if ($kind === FollowKind::Department && ! Department::whereKey((int) $target)->exists()) {
            throw new HttpException(404, 'That department couldn’t be found.');
        }
        if ($this->existing($me->id, $kind, $target)->exists()) {
            return response()->noContent();
        }
        if (Follow::where('user_id', $me->id)->count() >= Follow::MAX) {
            throw new HttpException(409, 'You follow '.Follow::MAX.' things already. Unfollow some first.');
        }
        Follow::create(['user_id' => $me->id, 'kind' => $kind, 'target' => $target]);

        return response()->noContent();
    }

    /** DELETE /api/follows {kind, target} */
    public function destroy(Request $request): Response
    {
        [$kind, $target] = $this->target($request);
        $this->existing($request->user()->id, $kind, $target)->delete();

        return response()->noContent();
    }

    /** @return array{0: FollowKind, 1: string} */
    private function target(Request $request): array
    {
        $data = $request->validate([
            'kind' => ['required', Rule::enum(FollowKind::class)],
            'target' => ['required', 'string', 'max:160'],
        ]);
        $kind = FollowKind::from($data['kind']);
        $target = trim($data['target']);
        if (in_array($kind, [FollowKind::Person, FollowKind::Department], true) && ! ctype_digit($target)) {
            throw new HttpException(400, $kind === FollowKind::Person ? 'That person couldn’t be found.' : 'That department couldn’t be found.');
        }
        if ($kind === FollowKind::Tag && mb_strlen($target) > 40) {
            throw new HttpException(400, 'Keywords are at most 40 characters.');
        }

        return [$kind, $kind === FollowKind::Tag ? $target : (string) (int) $target];
    }

    /** @return Builder<Follow> Keywords match ignoring case */
    private function existing(int $userId, FollowKind $kind, string $target): Builder
    {
        return Follow::where('user_id', $userId)->where('kind', $kind)
            ->when($kind === FollowKind::Tag, fn ($q) => $q->whereRaw('LOWER(target) = ?', [mb_strtolower($target)]), fn ($q) => $q->where('target', $target));
    }
}
