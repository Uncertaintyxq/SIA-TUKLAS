<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chat: direct 1-on-1 conversations and text channels inside research groups.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->enum('kind', ['direct', 'channel']);
            // Channels belong to a research group
            $table->foreignId('research_group_id')->nullable()->index()->constrained()->cascadeOnDelete();
            // Channel name; empty for direct chats
            $table->string('name', 80)->default('');
            // Direct chats: the two user ids, sorted ("3:7"), so each pair has one conversation
            $table->string('direct_key', 40)->nullable()->unique();
            $table->dateTime('last_message_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
        });

        // Who is in a conversation, and how far they have read
        Schema::create('conversation_members', function (Blueprint $table) {
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->dateTime('last_read_at')->useCurrent();
            $table->primary(['conversation_id', 'user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            // Thread replies point at the message they answer
            $table->foreignId('parent_id')->nullable()->index()->constrained('messages')->cascadeOnDelete();
            // Encrypted at rest
            $table->text('text');
            // A file sent in a direct chat is stored on the message
            $table->string('file', 80)->nullable();
            $table->string('file_name', 160)->nullable();
            $table->string('file_type', 100)->nullable();
            $table->unsignedInteger('file_size')->nullable();
            // A file shared in a channel lives in the group's file repository
            $table->foreignId('group_file_id')->nullable()->constrained()->nullOnDelete();
            // Set when the sender or a moderator removes the message
            $table->dateTime('deleted_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_members');
        Schema::dropIfExists('conversations');
    }
};
