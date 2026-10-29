<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Records security events and admin actions in audit_logs.
 * Never put passwords, tokens, 2FA codes or private message text in `meta`.
 */
class Audit
{
    /** @param array<string, mixed> $meta */
    public static function log(string $action, ?User $actor = null, ?Model $subject = null, array $meta = []): void
    {
        AuditLog::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'meta' => $meta === [] ? null : $meta,
            'ip_address' => request()?->ip(),
        ]);
    }
}
