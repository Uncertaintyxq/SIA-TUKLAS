<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Support\PushSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Turning push notifications on or off for one browser or phone (Account and security). */
class PushSubscriptionController extends Controller
{
    /** GET /api/account/push?endpoint= — the server's public key, and whether this device is on */
    public function show(Request $request, PushSender $sender): JsonResponse
    {
        $me = $request->user();
        $endpoint = (string) $request->query('endpoint', '');

        return response()->json([
            'available' => $sender->configured(),
            'publicKey' => (string) config('tuklas.push.public_key'),
            'thisDevice' => $endpoint !== '' && $me->pushSubscriptions()->where('endpoint_hash', hash('sha256', $endpoint))->exists(),
            'devices' => $me->pushSubscriptions()->latest()->get()->map(fn (PushSubscription $s) => ['device' => $s->device, 'since' => $s->created_at->toISOString()]),
        ]);
    }

    /** POST /api/account/push {endpoint, keys: {p256dh, auth}, contentEncoding?} — the browser's PushSubscription */
    public function store(Request $request): Response
    {
        $input = $request->validate([
            // Push services are always HTTPS; anything else isn't a real subscription
            'endpoint' => ['required', 'url:https', 'max:1000'],
            'keys.p256dh' => ['required', 'string', 'max:200'],
            'keys.auth' => ['required', 'string', 'max:100'],
            'contentEncoding' => ['nullable', 'in:aes128gcm,aesgcm'],
        ]);
        // One row per device; signing in with another account on it moves the row to that account
        PushSubscription::updateOrCreate(['endpoint_hash' => hash('sha256', $input['endpoint'])], [
            'user_id' => $request->user()->id,
            'endpoint' => $input['endpoint'],
            'p256dh' => $input['keys']['p256dh'],
            'auth' => $input['keys']['auth'],
            'content_encoding' => $input['contentEncoding'] ?? 'aes128gcm',
            'device' => self::device((string) $request->userAgent()),
        ]);

        return response()->noContent();
    }

    /** DELETE /api/account/push {endpoint} — this device stops getting notifications */
    public function destroy(Request $request): Response
    {
        $endpoint = (string) $request->validate(['endpoint' => ['required', 'string', 'max:1000']])['endpoint'];
        $request->user()->pushSubscriptions()->where('endpoint_hash', hash('sha256', $endpoint))->delete();

        return response()->noContent();
    }

    /** "Chrome on Android", from the user agent. Good enough to recognise your own devices. */
    private static function device(string $ua): string
    {
        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => 'A browser',
        };
        $system = match (true) {
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'iPhone') || str_contains($ua, 'iPad') => 'iPhone or iPad',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS') => 'Mac',
            str_contains($ua, 'Linux') => 'Linux',
            default => '',
        };

        return $system === '' ? $browser : "{$browser} on {$system}";
    }
}
