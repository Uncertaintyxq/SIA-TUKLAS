<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * In-app notifications (the bell). Tuklas's own table, not Laravel's database notification channel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // e.g. work_approved, work_revision, event_approved (see App\Support\Notifier)
            $table->string('type', 40);
            $table->string('message', 300);
            // App path to open, e.g. /works/12
            $table->string('link', 200);
            $table->boolean('read')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'read', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
