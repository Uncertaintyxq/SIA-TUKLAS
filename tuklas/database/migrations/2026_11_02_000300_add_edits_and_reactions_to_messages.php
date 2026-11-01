<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chat polish: a sender can edit a message (edited_at shows "edited"; the old text isn't kept),
 * and people react to messages with one of a few emoji. "Seen by" needs no table: it comes from
 * conversation_members.last_read_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('edited_at')->nullable();
        });

        Schema::create('message_reactions', function (Blueprint $table) {
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->string('emoji', 16);
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['message_id', 'user_id', 'emoji']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_reactions');
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('edited_at');
        });
    }
};
