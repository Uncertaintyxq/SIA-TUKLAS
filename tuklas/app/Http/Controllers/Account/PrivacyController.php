<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Message;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * The data subject's rights under the Data Privacy Act (RA 10173): see and download what Tuklas
 * holds about you, control where you're signed in, and give consent to the current privacy notice.
 */
class PrivacyController extends Controller
{
    /** GET /api/account/export — everything Tuklas holds about me, as a JSON download */
    public function export(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user()->load(['profile', 'links', 'backgrounds', 'honors']);
        $data = [
            'exportedAt' => now()->toISOString(),
            'account' => $me->only(['id', 'name', 'username', 'email', 'program', 'headline', 'verified', 'created_at', 'email_verified_at', 'privacy_accepted_at', 'privacy_version'])
                + ['role' => $me->role->value, 'twoFactorEnabled' => $me->hasTwoFactorEnabled()],
            'profile' => $me->profile?->only(['titles', 'department', 'bio_long', 'cv_name']),
            'links' => $me->links->map->only(['type', 'url', 'label']),
            'background' => $me->backgrounds->map->only(['degree', 'school', 'year']),
            'honors' => $me->honors->map->only(['kind', 'title', 'issuer', 'year', 'verified']),
            'works' => $me->works()->with('versions')->get()->map(fn ($w) => $w->only(['id', 'type', 'title', 'abstract', 'tags', 'status', 'submitted_at', 'approved_at', 'created_at'])
                + ['versions' => $w->versions->map->only(['version', 'title', 'note', 'submitted_at'])]),
            'publications' => $me->publications()->get()->map->only(['id', 'title', 'abstract', 'keywords', 'visibility', 'published_at']),
            'comments' => Comment::where('author_id', $me->id)->get()->map->only(['work_id', 'scope', 'text', 'created_at']),
            'messages' => Message::where('sender_id', $me->id)->whereNull('deleted_at')->get()->map->only(['conversation_id', 'text', 'file_name', 'created_at']),
            'eventRegistrations' => DB::table('event_registrations')->where('user_id', $me->id)->get(['event_id', 'created_at']),
            'opportunityApplications' => DB::table('opportunity_applications')->where('user_id', $me->id)->get(['opportunity_id', 'message', 'created_at']),
            'notifications' => $me->appNotifications()->latest('created_at')->get()->map->only(['type', 'message', 'read', 'created_at']),
            'activity' => DB::table('audit_logs')->where('actor_id', $me->id)->latest('created_at')->limit(500)->get(['action', 'ip_address', 'created_at']),
        ];
        Audit::log('data_exported', $me, $me);

        return response()->json($data)->header('Content-Disposition', 'attachment; filename="tuklas-data-'.$me->username.'.json"');
    }

    /** GET /api/account/sessions — where I'm signed in */
    public function sessions(Request $request): JsonResponse
    {
        $current = $request->session()->getId();
        $rows = DB::table('sessions')->where('user_id', $request->user()->id)->orderByDesc('last_activity')->get(['id', 'ip_address', 'user_agent', 'last_activity']);

        return response()->json($rows->map(fn ($s) => [
            // A digest, never the session id itself
            'id' => hash('sha256', $s->id),
            'ipAddress' => $s->ip_address,
            'userAgent' => mb_substr((string) $s->user_agent, 0, 200),
            'lastActiveAt' => Carbon::createFromTimestamp($s->last_activity)->toISOString(),
            'current' => $s->id === $current,
        ]));
    }

    /** POST /api/account/sessions/logout-others {password} — signs me out everywhere else */
    public function logoutOthers(Request $request): Response
    {
        $password = $request->validate(['password' => ['required', 'string']])['password'];
        /** @var User $me */
        $me = $request->user();
        if (! Hash::check($password, $me->password)) {
            throw ValidationException::withMessages(['password' => 'That isn’t your current password.']);
        }
        DB::table('sessions')->where('user_id', $me->id)->where('id', '!=', $request->session()->getId())->delete();
        Audit::log('logged_out_other_sessions', $me, $me);

        return response()->noContent();
    }

    /** POST /api/account/privacy {accept: true} — consent to the current privacy notice */
    public function acceptPrivacy(Request $request): Response
    {
        $request->validate(['accept' => ['accepted']], ['accept.accepted' => 'Please read and accept the privacy notice to continue.']);
        $me = $request->user();
        $me->forceFill(['privacy_accepted_at' => now(), 'privacy_version' => config('tuklas.privacy_version')])->save();
        Audit::log('privacy_accepted', $me, $me, ['version' => config('tuklas.privacy_version')]);

        return response()->noContent();
    }
}
