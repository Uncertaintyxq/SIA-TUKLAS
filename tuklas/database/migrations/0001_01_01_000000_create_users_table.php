<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            // Public handle: the read-only portfolio lives at /u/<username>
            $table->string('username', 40)->unique();
            $table->string('email', 191)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['student', 'educator', 'admin']);
            // Educators stay unverified until an admin confirms them. Only verified educators can approve work.
            $table->boolean('verified')->default(true);
            $table->string('program', 160);
            $table->string('headline', 160)->default('');
            // Educator rights an admin can grant or revoke. Students never use them; admins always have them.
            $table->boolean('can_publish')->default(true);
            $table->boolean('can_moderate_groups')->default(true);
            $table->boolean('can_broadcast')->default(true);
            // When the person last closed Tuklas (chat shows "last seen")
            $table->timestamp('last_seen_at')->nullable();
            // Data Privacy Act consent: when the person accepted, and which version of the notice
            $table->timestamp('privacy_accepted_at')->nullable();
            $table->string('privacy_version', 20)->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
