<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The email copy of an in-app notification, for people who chose email for its category
 * (NotificationPrefs). Queued, one message per person. The link opens the same screen.
 */
class ActivityEmail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $message, public string $link) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('[Tuklas] '.mb_strimwidth($this->message, 0, 90, '…'))
            ->line($this->message)
            ->action('Open on Tuklas', url($this->link))
            ->line('You get this email because of your notification settings. Change them under Account and security on Tuklas.');
    }
}
