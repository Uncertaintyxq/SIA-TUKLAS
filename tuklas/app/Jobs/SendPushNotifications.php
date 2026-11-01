<?php

namespace App\Jobs;

use App\Models\PushSubscription;
use App\Support\PushSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Delivers a notification to people's phones and browsers (Notifier dispatches it), off the
 * request so posting doesn't wait on push services. Devices that unsubscribed are forgotten.
 */
class SendPushNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @param list<int> $userIds */
    public function __construct(public array $userIds, public string $message, public string $link) {}

    public function handle(PushSender $sender): void
    {
        $subscriptions = PushSubscription::whereIn('user_id', $this->userIds)->get();
        $gone = $sender->send($subscriptions, ['title' => 'Tuklas', 'body' => $this->message, 'url' => $this->link]);
        if ($gone !== []) {
            PushSubscription::whereKey($gone)->delete();
        }
    }
}
