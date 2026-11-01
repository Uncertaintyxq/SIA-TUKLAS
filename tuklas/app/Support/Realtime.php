<?php

namespace App\Support;

use App\Events\RealtimePush;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Support\Facades\Log;

/**
 * Live updates for open tabs. Events only say what changed, never the content: the client refetches
 * through the API, so every access rule still runs on the server.
 *
 * Event shapes (client/src/types/realtime.ts), sent as "tuklas" on each recipient's users.{id} channel.
 * Who is online comes from the "online" presence channel (routes/channels.php), not from here:
 *   {type: 'message', conversationId, messageId, parentId}
 *   {type: 'message_deleted', conversationId, messageId}
 *   {type: 'notification', kind}
 */
class Realtime
{
    /**
     * Best effort: the change is already saved, and open tabs catch up when they refetch. If Reverb
     * is down, the request still succeeds and the failure is logged.
     *
     * @param  int|list<int>  $userIds
     * @param  array<string, mixed>  $event
     */
    public static function pushTo(int|array $userIds, array $event): void
    {
        $ids = array_values(array_unique((array) $userIds));
        if ($ids === []) {
            return;
        }
        try {
            event(new RealtimePush($ids, $event));
        } catch (BroadcastException $e) {
            Log::warning('Live update not sent: '.$e->getMessage(), ['type' => $event['type'] ?? null]);
        }
    }
}
