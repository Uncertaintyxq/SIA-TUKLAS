<?php

namespace App\Support;

use App\Models\User;
use Closure;

/**
 * @mentions in discussion comments, review comments and chat messages. Someone mentioned hears
 * about it only if they can read the text where they were mentioned, and the notification says who
 * and where, never the text itself (chat and review text are encrypted; notifications aren't).
 */
class Mentions
{
    /**
     * @ followed by a username (letters, digits and dashes, like Usernames makes), not inside a word
     * or an email address: "@andrea" mentions, "andrea@school.edu" doesn't. The client uses the same
     * pattern to link them (components/ui/MentionText.tsx).
     */
    private const PATTERN = '/(?<![A-Za-z0-9_.@])@([a-z0-9][a-z0-9-]{1,39})/i';

    /** More than this in one message is treated as spam: only the first ones are notified. */
    public const MAX = 10;

    /**
     * "@everyone" and "@all" mean every member of a group channel (ChatController), not a person.
     * Usernames never take these names (Usernames::unique).
     */
    public const EVERYONE = ['everyone', 'all'];

    /** @return list<string> The usernames mentioned, lowercased, first ones first, at most MAX */
    public static function usernames(string $text): array
    {
        preg_match_all(self::PATTERN, $text, $m);
        $names = array_diff(array_unique(array_map('mb_strtolower', $m[1])), self::EVERYONE);

        return array_slice(array_values($names), 0, self::MAX);
    }

    /** Whether the text says "@everyone" or "@all". */
    public static function mentionsEveryone(string $text): bool
    {
        preg_match_all(self::PATTERN, $text, $m);

        return array_intersect(array_map('mb_strtolower', $m[1]), self::EVERYONE) !== [];
    }

    /**
     * Tells everyone in $ids that $author mentioned them all. The caller decides who may do this
     * and who "everyone" is.
     *
     * @param  list<int>  $ids
     */
    public static function notifyEveryone(array $ids, User $author, string $where, string $link): void
    {
        Notifier::notify($ids, 'mention', "{$author->name} mentioned everyone {$where}.", $link, $author->id);
    }

    /**
     * Notifies the people mentioned in $text who can read it ($canRead). $previous is the text before
     * an edit, so only newly mentioned people hear about it; $alreadyTold are people this same post
     * notifies anyway (a work's authors on a comment), who don't need a second notification.
     *
     * @param  Closure(User): bool  $canRead
     * @param  list<int>  $alreadyTold
     */
    public static function notify(string $text, User $author, Closure $canRead, string $where, string $link, string $previous = '', array $alreadyTold = []): void
    {
        $names = array_values(array_diff(self::usernames($text), self::usernames($previous)));
        if ($names === []) {
            return;
        }
        $ids = User::active()->whereIn('username', $names)->whereNotIn('id', [$author->id, ...$alreadyTold])->get()
            ->filter(fn (User $u) => $canRead($u))
            ->modelKeys();
        Notifier::notify(array_values($ids), 'mention', "{$author->name} mentioned you {$where}.", $link, $author->id);
    }
}
