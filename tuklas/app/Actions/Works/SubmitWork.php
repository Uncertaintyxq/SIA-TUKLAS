<?php

namespace App\Actions\Works;

use App\Enums\WorkStatus;
use App\Models\User;
use App\Models\Work;
use App\Support\Notifier;
use Illuminate\Support\Facades\DB;

/** Snapshots the work as a new version, sends it to the adviser, and tells them. */
class SubmitWork
{
    public function handle(Work $work, User $me, string $note = ''): void
    {
        $version = DB::transaction(function () use ($work, $note) {
            $version = (int) $work->versions()->max('version') + 1;
            $work->versions()->create([
                'version' => $version,
                'title' => $work->title,
                'abstract' => $work->abstract,
                'tags' => $work->tags,
                'pdf_file' => $work->pdf_file,
                'pdf_name' => $work->pdf_name,
                'note' => $note,
                'submitted_at' => now(),
            ]);
            $work->forceFill(['status' => WorkStatus::Submitted, 'submitted_at' => now()])->save();

            return $version;
        });

        $resubmitted = $version > 1;
        Notifier::notify(
            [$work->adviser_id, ...$work->authorIds()],
            $resubmitted ? 'work_resubmitted' : 'work_submitted',
            $resubmitted ? "{$me->name} resubmitted “{$work->title}” (version {$version})." : "{$me->name} submitted “{$work->title}” for review.",
            "/works/{$work->id}",
            $me->id,
        );
    }
}
