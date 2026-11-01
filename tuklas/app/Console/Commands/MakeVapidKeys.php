<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Makes the VAPID key pair that identifies this server to push services (Web Push). Keep the same
 * pair once people have turned notifications on: a new pair stops their devices receiving them.
 */
#[Signature('tuklas:vapid-keys {--write= : Append the keys to this .env file instead of printing them (only if it has none)}')]
#[Description('Make the Web Push (VAPID) keys for push notifications')]
class MakeVapidKeys extends Command
{
    public function handle(): int
    {
        $keys = self::createKeys();
        $lines = "WEBPUSH_PUBLIC_KEY={$keys['publicKey']}\nWEBPUSH_PRIVATE_KEY={$keys['privateKey']}\n";

        $file = $this->option('write');
        if (! $file) {
            $this->line($lines);

            return self::SUCCESS;
        }
        $env = is_file($file) ? (string) file_get_contents($file) : '';
        if (preg_match('/^WEBPUSH_PUBLIC_KEY=\S+/m', $env)) {
            $this->info('Push keys are already set; keeping them.');

            return self::SUCCESS;
        }
        // Drop empty placeholders from .env.production.example, then add the new pair
        $env = preg_replace('/^WEBPUSH_(PUBLIC|PRIVATE)_KEY=\s*$\n?/m', '', $env);
        file_put_contents($file, rtrim($env)."\n\n# Web Push keys (php artisan tuklas:vapid-keys); keep them once people use notifications\n".$lines);
        $this->info("Push keys added to {$file}.");

        return self::SUCCESS;
    }

    /**
     * A P-256 key pair in the VAPID format (base64url: the public key as an uncompressed point, the
     * private key as its 32-byte scalar), the same as VAPID::createVapidKeys() makes. Done here
     * because PHP on Windows can't make the key without being told where openssl.cnf is (Herd
     * ships one next to php.exe); Linux servers don't need it.
     *
     * @return array{publicKey: string, privateKey: string}
     */
    public static function createKeys(): array
    {
        $options = ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC];
        $bundled = dirname(PHP_BINARY).'/extras/ssl/openssl.cnf';
        if (PHP_OS_FAMILY === 'Windows' && ! getenv('OPENSSL_CONF') && is_file($bundled)) {
            $options['config'] = $bundled;
        }
        $key = openssl_pkey_new($options);
        if ($key === false) {
            throw new RuntimeException('OpenSSL could not make the key. On Windows, set OPENSSL_CONF to an openssl.cnf file.');
        }
        $ec = openssl_pkey_get_details($key)['ec'];
        $pad = fn (string $bytes) => str_pad($bytes, 32, "\0", STR_PAD_LEFT);
        $base64url = fn (string $bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');

        return [
            'publicKey' => $base64url("\x04".$pad($ec['x']).$pad($ec['y'])),
            'privateKey' => $base64url($pad($ec['d'])),
        ];
    }
}
