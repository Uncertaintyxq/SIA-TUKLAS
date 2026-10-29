<?php

namespace App\Support;

use App\Enums\ConversationKind;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\ResearchGroup;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Group plumbing shared by the groups, chat and announcement controllers. */
class Groups
{
    /**
     * Actions: group_created, member_added, member_removed, member_left, role_changed, file_shared,
     * file_deleted, deadline_added, channel_created, channel_deleted, announcement_posted.
     */
    public static function log(ResearchGroup $group, int $actorId, string $action, string $detail): void
    {
        $group->activities()->create(['actor_id' => $actorId, 'action' => $action, 'detail' => Str::limit($detail, 297)]);
    }

    /**
     * Creates a channel with everyone currently in the group as a member.
     *
     * @param  list<int>  $participantIds
     */
    public static function createChannel(ResearchGroup $group, string $name, array $participantIds): Conversation
    {
        $channel = Conversation::create(['kind' => ConversationKind::Channel, 'research_group_id' => $group->id, 'name' => $name]);
        foreach (array_unique($participantIds) as $userId) {
            ConversationMember::create(['conversation_id' => $channel->id, 'user_id' => $userId]);
        }

        return $channel;
    }

    /** Every group has #general. Groups made before chat existed get it the first time they're opened. */
    public static function ensureGeneralChannel(ResearchGroup $group): void
    {
        if (! $group->channels()->exists()) {
            self::createChannel($group, 'general', $group->participantIds());
        }
    }

    /** Keeps channel membership in step with group membership. */
    public static function joinChannels(ResearchGroup $group, int $userId): void
    {
        foreach ($group->channels()->pluck('id') as $channelId) {
            ConversationMember::firstOrCreate(['conversation_id' => $channelId, 'user_id' => $userId]);
        }
    }

    public static function leaveChannels(ResearchGroup $group, int $userId): void
    {
        ConversationMember::where('user_id', $userId)->whereIn('conversation_id', $group->channels()->select('id'))->delete();
    }

    /**
     * A channel name from what someone typed: lowercase, spaces become dashes, letters, numbers and dashes only.
     *
     * @throws ValidationException
     */
    public static function channelName(mixed $input): string
    {
        $name = preg_replace('/\s+/', '-', Str::lower(trim((string) $input))) ?? '';
        if (mb_strlen($name) < 2) {
            throw ValidationException::withMessages(['name' => 'Name the channel (2+ characters)']);
        }
        if (mb_strlen($name) > 40 || ! preg_match('/^[a-z0-9][a-z0-9-]*$/', $name)) {
            throw ValidationException::withMessages(['name' => 'Use letters, numbers and dashes']);
        }

        return $name;
    }
}
