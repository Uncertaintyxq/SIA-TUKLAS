<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The Monday email for people who turned the weekly digest on: unread updates, this week's
 * deadlines and events, and new research from their department. Built by tuklas:weekly-digest.
 */
class WeeklyDigest extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param array<string, list<string>> $sections heading => lines, only the non-empty ones */
    public function __construct(public array $sections) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject('[Tuklas] Your week on Tuklas')->greeting("Hello, {$notifiable->name}");
        foreach ($this->sections as $heading => $lines) {
            $mail->line("**{$heading}**");
            foreach ($lines as $line) {
                $mail->line("- {$line}");
            }
        }

        return $mail
            ->action('Open Tuklas', url('/feed'))
            ->line('You get this weekly email because you turned it on. Turn it off under Account and security on Tuklas.');
    }
}
