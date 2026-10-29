<?php

namespace App\Support;

use App\Events\RealtimePush;

/**
 * Live updates for open tabs. Events only say what changed, never the content: the client refetches
 * through the API, so every access rule still runs on the server.
 *
 * Event shapes (same as the Node server's schemas/realtime.ts):
 *   {type: 'message', conversationId, messageId, parentId}
 *   {type: 'message_deleted', conversationId, messageId}
 *   {type: 'notification', kind}
 *   {type: 'presence', userId, online, lastSeenAt}
 */
class Realtime
{
    /**
     * @param  int|list<int>  $userIds
     * @param  array<string, mixed>  $event
     */
    public static function pushTo(int|array $userIds, array $event): void
    {
        $ids = array_values(array_unique((array) $userIds));
        if ($ids !== []) {
            event(new RealtimePush($ids, $event));
        }
    }
}
