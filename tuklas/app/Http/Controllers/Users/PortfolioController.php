<?php

namespace App\Http\Controllers\Users;

use App\Enums\PublicationVisibility;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicationCardResource;
use App\Http\Resources\UserCardResource;
use App\Http\Resources\WorkCardResource;
use App\Models\Profile;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use App\Support\Cards;
use App\Support\Uploads;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Public portfolios at /u/<username>: anyone can open them, signed in or not. */
class PortfolioController extends Controller
{
    /** GET /api/users/{username}/portfolio */
    public function show(Request $request, string $username): JsonResponse
    {
        $viewer = $request->user();
        $user = User::with(['profile', 'links' => fn ($q) => $q->orderBy('id'), 'backgrounds' => fn ($q) => $q->orderByDesc('year')->orderBy('id'), 'honors' => fn ($q) => $q->orderByDesc('year')->orderByDesc('id')])
            ->where('username', $username)
            ->first() ?? throw new HttpException(404, 'There’s no portfolio at that address.');

        $isOwner = $viewer?->id === $user->id;
        $seeAll = $isOwner || $viewer?->isAdmin();
        $authoredBy = fn (Builder $q) => $q->where('author_id', $user->id)->orWhereHas('coAuthors', fn ($c) => $c->where('users.id', $user->id));

        $works = Cards::works(Work::public()->where($authoredBy), $viewer?->id)->orderByDesc('approved_at')->get();
        $mentored = $user->role === Role::Educator
            ? Cards::works(Work::public()->where('adviser_id', $user->id), $viewer?->id)->orderByDesc('approved_at')->get()
            : collect();
        $publications = Cards::publications(Publication::query())
            ->whereIn('visibility', $viewer ? [PublicationVisibility::Internal, PublicationVisibility::Public] : [PublicationVisibility::Public])
            ->where($authoredBy)
            ->orderByDesc('published_at')
            ->get();

        // Rule 4: honors stay private until an admin verifies them.
        $honors = $user->honors->filter(fn ($h) => $seeAll || $h->verified)->values();

        return response()->json([
            'user' => [...(new UserCardResource($user))->resolve($request), 'headline' => $user->headline],
            'titles' => $user->profile?->titles ?? '',
            'bioLong' => $user->profile?->bio_long ?? '',
            'cv' => $user->profile?->cv_file ? ['url' => "/api/users/{$user->username}/cv", 'name' => $user->profile->cv_name ?? 'CV.pdf'] : null,
            'links' => $user->links->map->only(['id', 'type', 'url', 'label'])->values(),
            'background' => $user->backgrounds->map->only(['id', 'degree', 'school', 'year'])->values(),
            'honors' => $honors->map->only(['id', 'kind', 'title', 'issuer', 'year', 'verified'])->values(),
            'works' => WorkCardResource::collection($works),
            'mentored' => WorkCardResource::collection($mentored),
            'publications' => PublicationCardResource::collection($publications),
            'stats' => [
                'published' => $works->count(),
                'mentored' => $mentored->count(),
                'publications' => $publications->count(),
                'verifiedHonors' => $user->honors->where('verified', true)->count(),
                'degrees' => $user->backgrounds->count(),
            ],
            'isOwner' => $isOwner,
        ]);
    }

    /** GET /api/users/{username}/photo */
    public function photo(string $username): StreamedResponse
    {
        $profile = $this->profileOf($username);

        return Uploads::serve($profile?->photo_file, $profile?->photo_type ?? 'image/jpeg');
    }

    /** GET /api/users/{username}/cv */
    public function cv(Request $request, string $username): StreamedResponse
    {
        $profile = $this->profileOf($username);

        return Uploads::serve($profile?->cv_file, 'application/pdf', $profile?->cv_name ?? 'CV.pdf', $request->query('download') === '1');
    }

    private function profileOf(string $username): ?Profile
    {
        return Profile::whereHas('user', fn ($q) => $q->where('username', $username))->first();
    }
}
