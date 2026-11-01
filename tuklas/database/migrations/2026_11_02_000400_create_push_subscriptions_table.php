<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Web Push: one row per browser or phone that turned on notifications. The endpoint is the push
 * service's address for that device; p256dh and auth are the keys the message is encrypted with.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->text('endpoint');
            // The endpoint can be long; this is what makes it unique
            $table->char('endpoint_hash', 64)->unique();
            $table->string('p256dh', 200);
            $table->string('auth', 100);
            $table->string('content_encoding', 20)->default('aes128gcm');
            // "Chrome on Android", so people can recognise their devices
            $table->string('device', 120)->default('');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
