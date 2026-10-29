<?php

namespace App\Http\Controllers\Events;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\AdRequest;
use App\Http\Requests\Events\EventRequest;
use App\Http\Resources\AdCardResource;
use App\Http\Resources\EventCardResource;
use App\Http\Resources\UserCardResource;
use App\Models\Ad;
use App\Models\Event;
use App\Models\User;
use App\Support\Cards;
use App\Support\Notifier;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Academic events: browsing, organizing (admin approval for educators), registration and ad requests. */
class EventController extends Controller
{
    private const NOT_FOUND = 'That event doesn’t exist or isn’t approved yet.';

    /** The organizer and admins manage an event, see its attendees and pending state. */
    public static function canManage(Event $event, User $user): bool
    {
        return $user->isAdmin() || $event->posted_by_id === $user->id;
    }

    /** GET /api/events */
    public function index(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $organizes = ! $me->isStudent();
        $approved = fn () => Cards::events(Event::where('status', ApprovalStatus::Approved), $me->id);

        return response()->json([
            'upcoming' => EventCardResource::collection($approved()->where('date', '>=', now())->orderBy('date')->get()),
            'past' => EventCardResource::collection($approved()->where('date', '<', now())->orderByDesc('date')->limit(12)->get()),
            // Events you proposed, in every status, and your ad requests (educators and admins)
            'mine' => EventCardResource::collection($organizes ? Cards::events(Event::where('posted_by_id', $me->id), $me->id)->latest('created_at')->get() : []),
            'myAds' => AdCardResource::collection($organizes ? Cards::ads(Ad::where('created_by_id', $me->id))->latest('created_at')->get() : []),
        ]);
    }

    /** GET /api/events/{id} — pending and rejected events only for their organizer and admins. */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $event = Cards::events(Event::query(), $me->id)->find($id);
        if ($event === null || ($event->status !== ApprovalStatus::Approved && ! self::canManage($event, $me))) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $manage = self::canManage($event, $me);
        $upcoming = $event->date->isFuture();
        $full = $event->capacity !== null && $event->attendees_count >= $event->capacity;

        return response()->json([
            ...(new EventCardResource($event))->resolve($request),
            'isOrganizer' => $event->posted_by_id === $me->id,
            'canRegister' => $event->status === ApprovalStatus::Approved && $upcoming && ! $full,
            'canPromote' => $manage && $event->status === ApprovalStatus::Approved && $upcoming,
            'attendees' => $manage
                ? $event->attendees()->with('profile')->orderBy('event_registrations.created_at')->get()
                    ->map(fn (User $u) => ['user' => new UserCardResource($u), 'registeredAt' => $u->pivot->created_at->toISOString()])
                : null,
            'ads' => $manage ? AdCardResource::collection(Cards::ads($event->ads()->getQuery())->latest('created_at')->get()) : [],
        ]);
    }

    /** POST /api/events — an educator's event waits for an admin; an admin's is approved straight away. */
    public function store(EventRequest $request): JsonResponse
    {
        Gate::authorize('organize');
        /** @var User $me */
        $me = $request->user();
        $event = new Event($request->validated());
        $event->status = $me->isAdmin() ? ApprovalStatus::Approved : ApprovalStatus::Pending;
        $event->postedBy()->associate($me)->save();

        if (! $me->isAdmin()) {
            Notifier::notifyAdmins('event_proposed', "{$me->name} proposed “{$event->title}” and it needs approval.", '/admin?tab=events');
        }

        return response()->json(['id' => $event->id, 'status' => $event->status->value], 201);
    }

    /** DELETE /api/events/{id} — tells registered people when an upcoming approved event is cancelled. */
    public function destroy(Request $request, int $id): Response
    {
        $me = $request->user();
        $event = Event::with(['attendees:id', 'ads:id,event_id,image_file'])->find($id);
        if ($event === null || ! self::canManage($event, $me)) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $event->delete();
        $event->ads->each(fn (Ad $ad) => Uploads::delete($ad->image_file));
        if ($event->status === ApprovalStatus::Approved && $event->date->isFuture()) {
            Notifier::notify($event->attendees->pluck('id')->all(), 'event_cancelled', "“{$event->title}” was cancelled.", '/events', $me->id);
        }

        return response()->noContent();
    }

    /** POST /api/events/{id}/register */
    public function register(Request $request, int $id): Response
    {
        $me = $request->user();
        $event = Event::withCount('attendees')->find($id);
        if ($event === null || $event->status !== ApprovalStatus::Approved) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        if ($event->date->isPast()) {
            throw new HttpException(409, 'This event has already happened.');
        }
        if ($event->attendees()->whereKey($me->id)->exists()) {
            return response()->noContent();
        }
        if ($event->capacity !== null && $event->attendees_count >= $event->capacity) {
            throw new HttpException(409, 'This event is full.');
        }
        $event->attendees()->attach($me->id, ['created_at' => now()]);

        return response()->noContent(201);
    }

    /** DELETE /api/events/{id}/register */
    public function unregister(Request $request, int $id): Response
    {
        Event::find($id)?->attendees()->detach($request->user()->id);

        return response()->noContent();
    }

    /**
     * POST /api/events/{id}/ads — academic ad slots, only for an approved, upcoming event, requested
     * by its organizer or an admin. A non-admin's request is always saved as pending.
     */
    public function storeAd(AdRequest $request, int $id): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $event = Event::find($id);
        if ($event === null || ! self::canManage($event, $me)) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        if ($event->status !== ApprovalStatus::Approved || $event->date->isPast()) {
            throw new HttpException(409, 'Only approved, upcoming events can be promoted.');
        }

        $ends = $request->date('endsAt');
        $ad = new Ad(['headline' => $request->validated('headline'), 'starts_at' => $request->date('startsAt'), 'ends_at' => $ends->gt($event->date) ? $event->date : $ends]);
        $ad->status = $me->isAdmin() ? ApprovalStatus::Approved : ApprovalStatus::Pending;
        $ad->event()->associate($event);
        $ad->createdBy()->associate($me)->save();

        if (! $me->isAdmin()) {
            Notifier::notifyAdmins('ad_requested', "{$me->name} requested an ad slot for “{$event->title}”.", '/admin?tab=ads');
        }

        return response()->json(['id' => $ad->id, 'status' => $ad->status->value], 201);
    }
}
