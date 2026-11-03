<?php

namespace App\Support;

use App\Enums\PublicationVisibility;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Counts views and downloads of works and publications (Reach). Each person or visitor counts once
 * per item per day, and authors never count for their own work.
 *
 * To know who already counted today, content_hits keeps a one-way hash of the day and the account
 * (or, signed out, the IP address and browser), keyed with the app key so it can't be looked up
 * elsewhere. Neither the IP nor the browser is stored, and the rows are deleted the next day
 * (Reach::forgetYesterday, scheduled in routes/console.php).
 */
class Reach
{
    /** A work page or publication page was opened. */
    public static function view(Work|Publication $subject, Request $request): void
    {
        self::count($subject, 'view', $request);
    }

    /**
     * Its PDF was opened or downloaded in a browser. The PDF shown inside the work page loads in a
     * frame (Sec-Fetch-Dest: iframe) and doesn't count, or every view would also be a download.
     * Requests without the header (scripts, crawlers) don't count either.
     */
    public static function download(Work|Publication $subject, Request $request): void
    {
        if ($request->header('Sec-Fetch-Dest') === 'document') {
            self::count($subject, 'download', $request);
        }
    }

    /** Empties content_hits of earlier days; their counts are already in the totals. */
    public static function forgetYesterday(): int
    {
        return DB::table('content_hits')->where('day', '<', now()->toDateString())->delete();
    }

    private static function count(Work|Publication $subject, string $kind, Request $request): void
    {
        if (! self::counts($subject, $request->user())) {
            return;
        }
        $day = now()->toDateString();
        $who = $request->user() ? 'user:'.$request->user()->id : 'visitor:'.$request->ip().'|'.$request->userAgent();
        $type = $subject instanceof Work ? 'work' : 'publication';

        $first = DB::table('content_hits')->insertOrIgnore([
            'subject_type' => $type,
            'subject_id' => $subject->id,
            'kind' => $kind,
            'visitor' => hash_hmac('sha256', "{$day}|{$who}", (string) config('app.key')),
            'day' => $day,
        ]);
        if ($first > 0) {
            // Straight to the table, so a view doesn't change the item's updated_at
            DB::table($subject->getTable())->where('id', $subject->id)->increment("{$kind}_count");
        }
    }

    /** Only what the public can read counts, and never the authors' own visits. */
    private static function counts(Work|Publication $subject, ?User $viewer): bool
    {
        $readable = $subject instanceof Work ? $subject->isPublic() : $subject->visibility !== PublicationVisibility::Draft;

        return $readable && ($viewer === null || ! $subject->isAuthor($viewer));
    }
}
