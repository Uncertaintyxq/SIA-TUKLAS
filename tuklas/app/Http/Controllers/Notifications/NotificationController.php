<?php

namespace App\Http\Controllers\Notifications;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** The signed-in person's notifications (the bell). /api/notifications/… */
class NotificationController extends Controller
{
    /** GET /api/notifications — the latest 30, with the unread count */
    public function index(Request $request): JsonResponse
    {
        $mine = $request->user()->appNotifications();

        return response()->json([
            'items' => (clone $mine)->latest('created_at')->latest('id')->limit(30)->get()->map(fn ($n) => [
                'id' => $n->id, 'type' => $n->type, 'message' => $n->message, 'link' => $n->link,
                'read' => $n->read, 'createdAt' => $n->created_at->toISOString(),
            ]),
            'unread' => (clone $mine)->where('read', false)->count(),
        ]);
    }

    /** POST /api/notifications/read {ids?} — marks the given ones read, or all of them. */
    public function read(Request $request): Response
    {
        $ids = $request->validate(['ids' => ['sometimes', 'array', 'max:200'], 'ids.*' => ['integer', 'min:1']])['ids'] ?? null;
        $request->user()->appNotifications()
            ->where('read', false)
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->update(['read' => true]);

        return response()->noContent();
    }
}
