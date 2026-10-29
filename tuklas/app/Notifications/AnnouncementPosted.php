<?php

namespace App\Notifications;

use App\Models\Announcement;
use App\Support\Markup;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The email copy of an announcement. One message per recipient (never a shared To/CC), queued so
 * posting doesn't wait on the mail server. Needs a queue worker: `php artisan queue:work`.
 */
class AnnouncementPosted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Announcement $announcement, public string $authorName, public string $audience) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->announcement;

        return (new MailMessage)
            ->subject("[Tuklas] {$a->title}")
            ->line("{$this->authorName} posted an announcement for {$this->audience}:")
            ->line(Markup::toPlainText($a->body))
            ->action('Read it on Tuklas', url("/announcements#a-{$a->id}"));
    }
}
