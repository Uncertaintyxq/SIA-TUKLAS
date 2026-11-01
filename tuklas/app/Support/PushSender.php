<?php

namespace App\Support;

use App\Models\PushSubscription;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Sends Web Push messages to people's devices, signed with the server's VAPID keys
 * (config/tuklas.php `push`). Tests swap it for a fake through the container.
 */
class PushSender
{
    public function configured(): bool
    {
        return config('tuklas.push.public_key') && config('tuklas.push.private_key');
    }

    /**
     * Sends one payload to every subscription and returns the ids of those the push service says
     * are gone (the person turned notifications off or uninstalled), so they can be deleted.
     *
     * @param  Collection<int, PushSubscription>  $subscriptions
     * @param  array{title: string, body: string, url: string}  $payload
     * @return list<int>
     */
    public function send(Collection $subscriptions, array $payload): array
    {
        if (! $this->configured() || $subscriptions->isEmpty()) {
            return [];
        }
        $push = new WebPush(['VAPID' => [
            'subject' => config('tuklas.push.subject'),
            'publicKey' => config('tuklas.push.public_key'),
            'privateKey' => config('tuklas.push.private_key'),
        ]]);
        $byEndpoint = $subscriptions->keyBy('endpoint');
        foreach ($subscriptions as $s) {
            $push->queueNotification(Subscription::create([
                'endpoint' => $s->endpoint,
                'keys' => ['p256dh' => $s->p256dh, 'auth' => $s->auth],
                'contentEncoding' => $s->content_encoding,
            ]), json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $gone = [];
        try {
            foreach ($push->flush() as $report) {
                if ($report->isSubscriptionExpired()) {
                    $gone[] = $byEndpoint[$report->getEndpoint()]->id;
                } elseif (! $report->isSuccess()) {
                    // The reason names the push service's answer, never the message
                    Log::warning('Push notification not delivered: '.$report->getReason());
                }
            }
        } catch (Throwable $e) {
            // Push is extra: the in-app notification and any email already went out
            Log::warning('Push notifications not sent: '.$e->getMessage());
        }

        return $gone;
    }
}
