<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Research groups: the adviser owns the group, mentors are other educators, the leader is a student.
 * Members share files and deadlines; chat channels live in the chat tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('research_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adviser_id')->index()->constrained('users')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('description', 1000)->default('');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('group_members', function (Blueprint $table) {
            $table->foreignId('research_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            // Students are members or the leader; educators join as mentors
            $table->enum('role', ['leader', 'member', 'mentor'])->default('member');
            $table->timestamp('added_at')->useCurrent();
            $table->primary(['research_group_id', 'user_id']);
        });

        Schema::create('group_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_group_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('file', 80);
            $table->string('type', 100);
            $table->unsignedInteger('size');
            $table->timestamp('created_at')->useCurrent();
        });

        // What happened in a group, newest first: members, roles, files, deadlines, channels, announcements
        Schema::create('group_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            // e.g. member_added, role_changed, file_shared, deadline_added, channel_created, announcement_posted
            $table->string('action', 40);
            $table->string('detail', 300);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['research_group_id', 'created_at']);
        });

        Schema::create('group_deadlines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_group_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->dateTime('due_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['research_group_id', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_deadlines');
        Schema::dropIfExists('group_activities');
        Schema::dropIfExists('group_files');
        Schema::dropIfExists('group_members');
        Schema::dropIfExists('research_groups');
    }
};
