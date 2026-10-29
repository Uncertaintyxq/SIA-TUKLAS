<?php

namespace App\Support;

/**
 * Announcement bodies use a small markup (**bold**, _italic_, ## headings, - and 1. lists, [text](url)).
 * The React app renders it (escaping everything else); emails get this plain-text version.
 */
class Markup
{
    public static function toPlainText(string $body): string
    {
        $text = preg_replace('/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/', '$1 ($2)', $body) ?? $body;
        $text = preg_replace('/\*\*([^*]+)\*\*/', '$1', $text) ?? $text;
        $text = preg_replace('/(^|\W)_([^_]+)_(?=\W|$)/m', '$1$2', $text) ?? $text;
        $text = preg_replace('/^#{2,3}\s+/m', '', $text) ?? $text;

        return trim($text);
    }
}
