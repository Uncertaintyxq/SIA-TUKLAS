<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Uploaded files: checked, saved, served and deleted. The client sends the file itself as the request
 * body with its name in X-File-Name. Files live on the private disk (storage/app/private/uploads,
 * never web-served) under random names; the database keeps only those names. They're served only
 * by controllers, after the same policy check as the thing they belong to.
 */
class Uploads
{
    private const DIR = 'uploads';

    private const SAFE_NAME = '/^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/';

    private const MB = 1024 * 1024;

    /** Types a general file may be served as; anything else downloads as application/octet-stream. */
    private const SERVABLE = [
        'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/zip',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    /**
     * Checks the request body against an upload slot and saves it. Throws a 400 with a message the
     * person can act on. The file's own bytes decide its type, never the name or the browser's claim.
     *
     * @param  'pdf'|'image'|'any'  $kind
     * @return array{file: string, type: string, name: string, size: int}
     */
    public static function store(Request $request, string $kind): array
    {
        [$max, $label] = match ($kind) {
            'pdf' => [20 * self::MB, 'a PDF'],
            'image' => [5 * self::MB, 'a PNG, JPEG or WebP image'],
            'any' => [15 * self::MB, 'a file'],
        };

        $bytes = $request->getContent();
        $size = strlen($bytes);
        if ($size === 0) {
            throw new HttpException(400, "Choose {$label} to upload.");
        }
        if ($size > $max) {
            throw new HttpException(400, 'That file is too large. The limit is '.($max / self::MB).' MB.');
        }

        $name = self::cleanName((string) $request->header('X-File-Name', 'file'));
        [$type, $ext] = match ($kind) {
            'pdf' => str_starts_with($bytes, '%PDF-') ? ['application/pdf', 'pdf'] : [null, null],
            'image' => self::sniffImage($bytes),
            'any' => [self::servableType($bytes), self::extensionOf($name)],
        };
        if ($type === null) {
            throw new HttpException(400, "That file isn’t {$label}.");
        }

        $file = Str::uuid()->toString().'.'.$ext;
        Storage::disk('local')->put(self::DIR.'/'.$file, $bytes);

        return ['file' => $file, 'type' => $type, 'name' => $name, 'size' => $size];
    }

    /**
     * Streams a stored file. PDFs and images open inline (so pages can embed them); everything else
     * downloads, so an uploaded file can never run as a page on our origin.
     */
    public static function serve(?string $file, string $type, ?string $name = null, bool $download = false): StreamedResponse
    {
        if ($file === null || ! preg_match(self::SAFE_NAME, $file) || ! Storage::disk('local')->exists(self::DIR.'/'.$file)) {
            throw new HttpException(404, 'That file is no longer available.');
        }

        $inline = ! $download && ($type === 'application/pdf' || str_starts_with($type, 'image/'));
        $name ??= $file;
        $ascii = preg_replace('/[^\x20-\x7e]|"/', '_', $name);

        return Storage::disk('local')->response(self::DIR.'/'.$file, $name, [
            'Content-Type' => $type,
            'Content-Disposition' => ($inline ? 'inline' : 'attachment')."; filename=\"{$ascii}\"; filename*=UTF-8''".rawurlencode($name),
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public static function delete(?string $file): void
    {
        if ($file !== null && preg_match(self::SAFE_NAME, $file)) {
            Storage::disk('local')->delete(self::DIR.'/'.$file);
        }
    }

    /** Empties the upload folder (demo reset). */
    public static function clear(): void
    {
        Storage::disk('local')->deleteDirectory(self::DIR);
    }

    /** @return array{0: ?string, 1: ?string} [type, extension] */
    private static function sniffImage(string $bytes): array
    {
        return match (true) {
            str_starts_with($bytes, "\x89PNG") => ['image/png', 'png'],
            str_starts_with($bytes, "\xFF\xD8\xFF") => ['image/jpeg', 'jpg'],
            substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP' => ['image/webp', 'webp'],
            default => [null, null],
        };
    }

    /** What the bytes really are (finfo), if it's a type we serve; otherwise a plain download. */
    private static function servableType(string $bytes): string
    {
        $detected = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';

        return in_array($detected, self::SERVABLE, true) ? $detected : 'application/octet-stream';
    }

    private static function cleanName(string $header): string
    {
        $name = rawurldecode($header);
        $name = trim(substr(preg_replace('/[\\\\\/\r\n"\x00-\x1f]/', '', $name) ?? '', 0, 160));

        return $name === '' ? 'file' : $name;
    }

    private static function extensionOf(string $name): string
    {
        return preg_match('/\.([a-z0-9]{1,8})$/i', $name, $m) ? strtolower($m[1]) : 'bin';
    }
}
