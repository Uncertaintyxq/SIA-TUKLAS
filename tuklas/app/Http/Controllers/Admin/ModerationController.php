<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ApprovalStatus;
use App\Enums\CommentScope;
use App\Enums\WorkStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\MyWorkResource;
use App\Http\Resources\UserCardResource;
use App\Models\Ad;
use App\Models\Comment;
use App\Models\Event;
use App\Models\Honor;
use App\Models\Opportunity;
use App\Models\Work;
use App\Support\Audit;
use App\Support\Cards;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Approving events, ads and honors, and taking posts down. Admins only. Every decision is audited. */
class ModerationController extends Controller
{
    /** POST /api/admin/events/{id}/{approve|reject} */
    public function event(Request $request, int $id, string $action): Response
    {
        $approve = $action === 'approve';
        $event = Event::find($id) ?? throw new HttpException(404, 'That event no longer exists.');
        $event->status = $approve ? ApprovalStatus::Approved : ApprovalStatus::Rejected;
        $event->save();
        Audit::log("event_{$action}", $request->user(), $event);
        Notifier::notify($event->posted_by_id, $approve ? 'event_approved' : 'event_rejected',
            $approve ? "“{$event->title}” was approved and is now listed." : "“{$event->title}” wasn’t approved.", "/events/{$event->id}", $request->user()->id);

        return response()->noContent();
    }

    /** POST /api/admin/ads/{id}/{approve|reject} */
    public function ad(Request $request, int $id, string $action): Response
    {
        $approve = $action === 'approve';
        $ad = Ad::with('event:id,title')->find($id) ?? throw new HttpException(404, 'That ad no longer exists.');
        $ad->status = $approve ? ApprovalStatus::Approved : ApprovalStatus::Rejected;
        $ad->save();
        Audit::log("ad_{$action}", $request->user(), $ad);
        Notifier::notify($ad->created_by_id, $approve ? 'ad_approved' : 'ad_rejected',
            $approve ? "Your ad for “{$ad->event->title}” is approved and will run in the feed." : "Your ad for “{$ad->event->title}” wasn’t approved.",
            "/events/{$ad->event->id}", $request->user()->id);

        return response()->noContent();
    }

    /** POST /api/admin/honors/{id}/verify */
    public function verifyHonor(Request $request, int $id): Response
    {
        $me = $request->user();
        $honor = Honor::find($id) ?? throw new HttpException(404, 'That honor no longer exists.');
        $honor->forceFill(['verified' => true, 'verified_by_id' => $me->id, 'verified_at' => now()])->save();
        Audit::log('honor_verified', $me, $honor);
        Notifier::notify($honor->user_id, 'honor_verified', "“{$honor->title}” is verified and now shows on your public portfolio.", '/portfolio', $me->id);

        return response()->noContent();
    }

    /** POST /api/admin/honors/{id}/decline — declining removes the claim, as in the prototype */
    public function declineHonor(Request $request, int $id): Response
    {
        $honor = Honor::find($id) ?? throw new HttpException(404, 'That honor no longer exists.');
        $honor->delete();
        Audit::log('honor_declined', $request->user(), $honor, ['title' => $honor->title]);
        Notifier::notify($honor->user_id, 'honor_declined', "“{$honor->title}” couldn’t be verified and was removed.", '/portfolio', $request->user()->id);

        return response()->noContent();
    }

    /** GET /api/admin/posts — published works, opportunities and public comments, for taking things down */
    public function posts(Request $request): JsonResponse
    {
        $me = $request->user();
        $works = Cards::myWorks(Work::where('status', WorkStatus::Approved), $me->id)->orderByDesc('approved_at')->limit(100)->get();

        return response()->json([
            'works' => $works->map(fn (Work $w) => [...(new MyWorkResource($w))->resolve($request), 'removedAt' => $w->removed_at?->toISOString()]),
            'opportunities' => Opportunity::with(Cards::user('adviser'))->latest('created_at')->limit(100)->get()
                ->map(fn ($o) => ['id' => $o->id, 'title' => $o->title, 'adviser' => new UserCardResource($o->adviser), 'createdAt' => $o->created_at->toISOString()]),
            'comments' => Comment::with([...Cards::user('author'), 'work:id,title'])->where('scope', CommentScope::Public)->latest('created_at')->limit(100)->get()
                ->map(fn ($c) => ['id' => $c->id, 'text' => $c->text, 'author' => new UserCardResource($c->author), 'work' => $c->work->only(['id', 'title']), 'createdAt' => $c->created_at->toISOString()]),
        ]);
    }

    /** POST /api/admin/works/{id}/remove {reason?} — off the feed and portfolios; its authors still see it */
    public function removeWork(Request $request, int $id): Response
    {
        $reason = trim((string) ($request->validate(['reason' => ['nullable', 'string', 'max:300']])['reason'] ?? ''));
        $work = Work::forAccess($id) ?? throw new HttpException(404, 'That work no longer exists.');
        $work->forceFill(['removed_at' => now()])->save();
        Audit::log('work_removed', $request->user(), $work, $reason === '' ? [] : ['reason' => $reason]);
        Notifier::notify($work->authorIds(), 'work_removed', "An admin removed “{$work->title}” from the feed".($reason !== '' ? ": {$reason}" : '.'), "/works/{$work->id}", $request->user()->id);

        return response()->noContent();
    }

    /** POST /api/admin/works/{id}/restore */
    public function restoreWork(Request $request, int $id): Response
    {
        $work = Work::find($id) ?? throw new HttpException(404, 'Not found');
        $work->forceFill(['removed_at' => null])->save();
        Audit::log('work_restored', $request->user(), $work);

        return response()->noContent();
    }
}
