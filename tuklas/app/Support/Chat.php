<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Chat plumbing shared by the chat and groups controllers. */
class Chat
{
    /**
     * Unread messages per conversation for one person: anything newer than their read marker, not sent by them.
     *
     * @return Collection<int, int> conversation id => count
     */
    public static function unreadByConversation(int $userId): Collection
    {
        return DB::table('messages as m')
            ->join('conversation_members as cm', fn ($j) => $j->on('cm.conversation_id', '=', 'm.conversation_id')->where('cm.user_id', $userId))
            ->whereColumn('m.created_at', '>', 'cm.last_read_at')
            ->where('m.sender_id', '!=', $userId)
            ->whereNull('m.deleted_at')
            ->groupBy('m.conversation_id')
            ->selectRaw('m.conversation_id, count(*) as n')
            ->pluck('n', 'm.conversation_id')
            ->map(fn ($n) => (int) $n);
    }

    /** Seen in the last two minutes counts as online (see TouchLastSeen). */
    public static function isOnline(?\DateTimeInterface $lastSeenAt): bool
    {
        return $lastSeenAt !== null && $lastSeenAt >= now()->subMinutes(2);
    }

    /** Tells every member's open tabs that a conversation changed; they refetch through the API. */
    public static function announce(int $conversationId, int $messageId, ?int $parentId, bool $deleted = false): void
    {
        $ids = DB::table('conversation_members')->where('conversation_id', $conversationId)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        Realtime::pushTo($ids, $deleted
            ? ['type' => 'message_deleted', 'conversationId' => $conversationId, 'messageId' => $messageId]
            : ['type' => 'message', 'conversationId' => $conversationId, 'messageId' => $messageId, 'parentId' => $parentId]);
    }
}
