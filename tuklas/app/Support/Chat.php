<?php

namespace App\Support;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
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

    /**
     * Saves a message, moves the conversation to the top, marks it read for the sender and tells
     * every member's open tabs.
     *
     * @param  array<string, mixed>  $fields  text, parent_id, file fields
     */
    public static function post(Conversation $c, int $senderId, array $fields): Message
    {
        $m = DB::transaction(function () use ($c, $senderId, $fields) {
            $m = new Message($fields + ['sender_id' => $senderId]);
            $m->conversation()->associate($c)->save();
            $c->forceFill(['last_message_at' => now()])->save();
            ConversationMember::where('conversation_id', $c->id)->where('user_id', $senderId)->update(['last_read_at' => now()]);

            return $m;
        });
        self::announce($c->id, $m->id, $m->parent_id);

        return $m;
    }

    /** Tells every member's open tabs that a conversation changed; they refetch through the API. */
    public static function announce(int $conversationId, int $messageId, ?int $parentId, bool $deleted = false): void
    {
        $ids = DB::table('conversation_members')->where('conversation_id', $conversationId)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        Realtime::pushTo($ids, $deleted
            ? ['type' => 'message_deleted', 'conversationId' => $conversationId, 'messageId' => $messageId]
            : ['type' => 'message', 'conversationId' => $conversationId, 'messageId' => $messageId, 'parentId' => $parentId]);
    }

    /** A message was edited or reacted to: open tabs refetch it, without counting it as new. */
    public static function announceChange(int $conversationId, int $messageId): void
    {
        Realtime::pushTo(self::memberIds($conversationId), ['type' => 'message_changed', 'conversationId' => $conversationId, 'messageId' => $messageId]);
    }

    /** Someone read a conversation: the others' "Seen by" refreshes. The reader isn't told. */
    public static function announceRead(int $conversationId, int $readerId): void
    {
        Realtime::pushTo(array_values(array_diff(self::memberIds($conversationId), [$readerId])), ['type' => 'conversation_read', 'conversationId' => $conversationId]);
    }

    /** @return list<int> */
    private static function memberIds(int $conversationId): array
    {
        return DB::table('conversation_members')->where('conversation_id', $conversationId)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }
}
