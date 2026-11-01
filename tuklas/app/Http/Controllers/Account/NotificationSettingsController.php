<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Support\NotificationPrefs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Which updates also arrive by email, and the weekly digest (Account and security). */
class NotificationSettingsController extends Controller
{
    /** GET /api/account/notifications */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->view($request));
    }

    /** PUT /api/account/notifications {email: {category: bool}, push?: {category: bool}, digest: bool} */
    public function update(Request $request): JsonResponse
    {
        $me = $request->user();
        $keys = implode(',', array_keys(NotificationPrefs::visibleTo($me)));
        $input = $request->validate([
            // Present, but may be empty when only push or the digest changes
            'email' => ['present', "array:{$keys}"],
            'email.*' => ['boolean'],
            'push' => ['sometimes', "array:{$keys}"],
            'push.*' => ['boolean'],
            'digest' => ['required', 'boolean'],
        ]);
        $current = NotificationPrefs::for($me);
        $me->forceFill(['notification_settings' => [
            'email' => array_map(fn ($v) => (bool) $v, $input['email']) + $current['email'],
            'push' => array_map(fn ($v) => (bool) $v, $input['push'] ?? []) + $current['push'],
            'digest' => (bool) $input['digest'],
        ]])->save();

        return response()->json($this->view($request));
    }

    private function view(Request $request): array
    {
        $me = $request->user();

        return [
            ...NotificationPrefs::for($me),
            'emailVerified' => $me->email_verified_at !== null,
            'categories' => collect(NotificationPrefs::visibleTo($me))
                ->map(fn ($c, $key) => ['key' => $key, 'label' => $c[0], 'description' => $c[1]])
                ->values(),
        ];
    }
}
