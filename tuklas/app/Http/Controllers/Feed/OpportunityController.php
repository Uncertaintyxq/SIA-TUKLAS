<?php

namespace App\Http\Controllers\Feed;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feed\OpportunityRequest;
use App\Http\Resources\OpportunityCardResource;
use App\Http\Resources\UserCardResource;
use App\Models\Opportunity;
use App\Models\OpportunityApplication;
use App\Models\User;
use App\Support\Cards;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Mentorships, research grants and calls for submissions. /api/opportunities/… */
class OpportunityController extends Controller
{
    /** GET /api/opportunities/mine — my postings with their applications */
    public function mine(Request $request): JsonResponse
    {
        $me = $request->user();
        $rows = Cards::opportunities(Opportunity::where('adviser_id', $me->id), $me->id)
            ->with(['applications' => fn ($q) => $q->latest('created_at'), ...Cards::user('applications.user')])
            ->latest('created_at')
            ->get();

        return response()->json($rows->map(fn (Opportunity $o) => [
            ...(new OpportunityCardResource($o))->resolve($request),
            'applications' => $o->applications->map(fn ($a) => [
                'user' => new UserCardResource($a->user), 'message' => $a->message, 'createdAt' => $a->created_at->toISOString(),
            ]),
        ]));
    }

    /** POST /api/opportunities — verified educators and admins */
    public function store(OpportunityRequest $request): JsonResponse
    {
        Gate::authorize('organize');
        $o = new Opportunity($request->validated());
        $o->adviser()->associate($request->user())->save();

        return response()->json(['id' => $o->id], 201);
    }

    /** DELETE /api/opportunities/{id} — its adviser, or an admin */
    public function destroy(Request $request, int $id): Response
    {
        /** @var User $me */
        $me = $request->user();
        $deleted = Opportunity::whereKey($id)->when(! $me->isAdmin(), fn ($q) => $q->where('adviser_id', $me->id))->delete();
        if ($deleted === 0) {
            throw new HttpException(404, 'Not found');
        }

        return response()->noContent();
    }

    /** POST /api/opportunities/{id}/apply {message} — students and educators */
    public function apply(Request $request, int $id): Response
    {
        $message = $request->validate(['message' => ['required', 'string', 'min:10', 'max:1000']], ['message.*' => 'Tell the adviser a little about yourself (10+ characters)'])['message'];
        /** @var User $me */
        $me = $request->user();
        if ($me->isAdmin()) {
            throw new HttpException(403, 'You don’t have access to this.');
        }
        $o = Opportunity::find($id) ?? throw new HttpException(404, 'That opportunity is no longer posted.');
        if ($o->adviser_id === $me->id) {
            throw new HttpException(409, 'You can’t apply to your own posting.');
        }
        if ($o->deadline->lt(now()->subDay())) {
            throw new HttpException(409, 'Applications for this opportunity have closed.');
        }
        if (OpportunityApplication::where('opportunity_id', $o->id)->where('user_id', $me->id)->exists()) {
            throw new HttpException(409, 'You’ve already applied.');
        }

        OpportunityApplication::create(['opportunity_id' => $o->id, 'user_id' => $me->id, 'message' => $message]);
        Notifier::notify($o->adviser_id, 'opportunity_application', "{$me->name} applied to “{$o->title}”.", '/post');

        return response()->noContent(201);
    }

    /** DELETE /api/opportunities/{id}/apply */
    public function withdraw(Request $request, int $id): Response
    {
        OpportunityApplication::where('opportunity_id', $id)->where('user_id', $request->user()->id)->delete();

        return response()->noContent();
    }
}
