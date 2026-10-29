<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** One live update, sent on each recipient's private channel (users.{id}). See App\Support\Realtime. */
class RealtimePush implements ShouldBroadcastNow
{
    /**
     * @param  list<int>  $userIds
     * @param  array<string, mixed>  $event
     */
    public function __construct(public array $userIds, public array $event) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return array_map(fn (int $id) => new PrivateChannel("users.{$id}"), $this->userIds);
    }

    public function broadcastAs(): string
    {
        return 'tuklas';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->event;
    }
}
