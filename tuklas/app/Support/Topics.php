<?php

namespace App\Support;

use Normalizer;

/**
 * Topic overlap: compares a draft's title and keywords with approved works, so a student sees
 * similar theses early. Plain term overlap is enough at one school's scale.
 */
class Topics
{
    private const STOP = 'about above after again against also among analysis and any approach are assessment based being between both but can case '
        .'during each effect effects evaluation for from further how into its more most new not of off once only other our over own '
        .'same should some study such than that the their them then there these they this those through toward towards under until '
        .'use used using very via was were what when where which while who why will with within without';

    /** @return list<string> Lowercase content words, accents folded, light plural stripping ("networks" → "network"). */
    public static function terms(string $text): array
    {
        static $stop = null;
        $stop ??= array_flip(explode(' ', self::STOP));

        $folded = preg_replace('/\p{Mn}+/u', '', Normalizer::normalize(mb_strtolower($text), Normalizer::FORM_KD) ?: '') ?? '';
        $words = [];
        foreach (preg_split('/[^\p{L}\p{N}]+/u', $folded, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $word) {
            if (mb_strlen($word) < 3 || isset($stop[$word])) {
                continue;
            }
            if (mb_strlen($word) > 4 && str_ends_with($word, 's') && ! str_ends_with($word, 'ss')) {
                $word = mb_substr($word, 0, -1);
            }
            $words[$word] = true;
        }

        return array_keys($words);
    }

    /**
     * Title and keyword hits count double; abstract hits add a little.
     *
     * @param  list<string>  $query
     * @param  list<string>  $tags
     * @return array{score: float, shared: list<string>}
     */
    public static function overlap(array $query, string $title, array $tags, string $abstract): array
    {
        $q = array_flip($query);
        $hits = fn (string $text) => array_values(array_filter(self::terms($text), fn ($t) => isset($q[$t])));
        $inTitle = $hits($title);
        $inTags = $hits(implode(' ', $tags));
        $inAbstract = $hits($abstract);

        return [
            'score' => count($inTitle) * 2 + count($inTags) * 2 + min(count($inAbstract), 4) * 0.5,
            'shared' => array_values(array_unique([...$inTitle, ...$inTags, ...$inAbstract])),
        ];
    }
}
