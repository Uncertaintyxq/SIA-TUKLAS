<?php

namespace App\Console\Commands;

use App\Enums\ApprovalStatus;
use App\Models\Event;
use App\Models\GroupDeadline;
use App\Models\User;
use App\Models\Work;
use App\Notifications\WeeklyDigest;
use App\Support\NotificationPrefs;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Emails the weekly digest to everyone who turned it on (scheduled Monday 8 AM Philippine time in
 * routes/console.php). People with nothing new that week get no email.
 */
#[Signature('tuklas:weekly-digest')]
#[Description('Email the weekly digest to people who turned it on')]
class SendWeeklyDigest extends Command
{
    private const TZ = 'Asia/Manila';

    public function handle(): int
    {
        $sent = 0;
        User::active()->whereNotNull('email_verified_at')->whereNotNull('notification_settings')->with('profile:user_id,department')
            ->lazyById()
            ->filter(fn (User $u) => NotificationPrefs::for($u)['digest'])
            ->each(function (User $u) use (&$sent) {
                $sections = array_filter($this->sectionsFor($u));
                if ($sections !== []) {
                    $u->notify(new WeeklyDigest($sections));
                    $sent++;
                }
            });
        $this->info("Sent {$sent} weekly digest".($sent === 1 ? '' : 's').'.');

        return self::SUCCESS;
    }

    /** @return array<string, list<string>> */
    private function sectionsFor(User $u): array
    {
        $week = [now(), now()->addWeek()];
        $unread = $u->appNotifications()->where('read', false)->where('created_at', '>=', now()->subWeek());
        $unreadCount = (clone $unread)->count();
        $unreadLines = $unread->latest('created_at')->limit(5)->pluck('message')->all();
        if ($unreadCount > count($unreadLines)) {
            $unreadLines[] = 'and '.($unreadCount - count($unreadLines)).' more';
        }

        $deadlines = GroupDeadline::with('group:id,name')
            ->whereBetween('due_at', $week)
            ->whereHas('group', fn ($g) => $g->where('adviser_id', $u->id)->orWhereHas('members', fn ($m) => $m->where('user_id', $u->id)))
            ->orderBy('due_at')->limit(10)->get()
            ->map(fn ($d) => "{$d->title} ({$d->group->name}), due ".$d->due_at->timezone(self::TZ)->format('D, M j, g:i A'))->all();

        $events = Event::where('status', ApprovalStatus::Approved)->whereBetween('date', $week)
            ->whereHas('attendees', fn ($a) => $a->whereKey($u->id))
            ->orderBy('date')->limit(10)->get()
            ->map(fn ($e) => "{$e->title}, ".$e->date->timezone(self::TZ)->format('D, M j, g:i A')." at {$e->venue}")->all();

        $department = (string) $u->profile?->department;
        $works = $department === '' ? [] : Work::public()->where('approved_at', '>=', now()->subWeek())->where('author_id', '!=', $u->id)
            ->whereHas('author.profile', fn ($p) => $p->where('department', $department))
            ->latest('approved_at')->limit(5)->pluck('title')->all();

        return [
            'Updates you haven’t read' => $unreadLines,
            'Group deadlines this week' => $deadlines,
            'Your events this week' => $events,
            "New research in {$department}" => $works,
        ];
    }
}
