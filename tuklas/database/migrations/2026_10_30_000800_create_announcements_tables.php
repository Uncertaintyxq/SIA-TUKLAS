<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Announcements: system-wide (admins only), per department, or per research group.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->enum('scope', ['system', 'department', 'group']);
            // department scope: matches profiles.department
            $table->string('department', 160)->nullable();
            // group scope
            $table->foreignId('research_group_id')->nullable()->index()->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            // Light markup: **bold**, _italic_, "## " headings, "- " and "1. " lists, [text](https://…) links
            $table->text('body');
            $table->boolean('pinned')->default(false);
            $table->timestamps();

            $table->index(['scope', 'created_at']);
        });

        Schema::create('announcement_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->index()->constrained()->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('file', 80);
            $table->string('type', 100);
            $table->unsignedInteger('size');
            $table->timestamp('created_at')->useCurrent();
        });

        // Read receipts: one row the first time a person sees an announcement
        Schema::create('announcement_reads', function (Blueprint $table) {
            $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->timestamp('read_at')->useCurrent();
            $table->primary(['announcement_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_reads');
        Schema::dropIfExists('announcement_attachments');
        Schema::dropIfExists('announcements');
    }
};
