<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Student works and their review: versions, reviews, revision checklists, defense stages,
 * comments, reactions and readers' libraries.
 */
return new class extends Migration
{
    public function up(): void
    {
        // draft → submitted → under_review → revision | approved | rejected.
        // submitted can also go straight to revision | approved | rejected; revision → submitted when the author resubmits.
        // Only approved works that an admin hasn't removed are public.
        Schema::create('works', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->index('author_id');
            $table->foreignId('adviser_id')->constrained('users')->restrictOnDelete();
            $table->enum('type', ['research', 'literary', 'innovation']);
            $table->string('title', 180);
            $table->text('abstract');
            // Array of keyword strings, e.g. ["IoT", "LoRa"]
            $table->json('tags');
            $table->enum('status', ['draft', 'submitted', 'under_review', 'revision', 'approved', 'rejected'])->default('draft');
            $table->string('pdf_file', 80)->nullable();
            $table->string('pdf_name', 160)->nullable();
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->foreignId('approved_by_id')->nullable()->constrained('users')->nullOnDelete();
            // Set when an admin takes a published work off the feed
            $table->dateTime('removed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'approved_at']);
            $table->index(['adviser_id', 'status']);
        });

        // Co-authors beyond the submitting author, in byline order
        Schema::create('work_authors', function (Blueprint $table) {
            $table->foreignId('work_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('order');
            $table->primary(['work_id', 'user_id']);
        });

        // A snapshot taken at every submission, so each resubmission is kept
        Schema::create('work_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('title', 180);
            $table->text('abstract');
            $table->json('tags');
            $table->string('pdf_file', 80)->nullable();
            $table->string('pdf_name', 160)->nullable();
            // What the author changed in this version
            $table->string('note', 500)->default('');
            $table->dateTime('submitted_at')->useCurrent();

            $table->unique(['work_id', 'version']);
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->enum('decision', ['start_review', 'revise', 'approve', 'reject']);
            // Encrypted at rest (private review text)
            $table->text('comment')->nullable();
            // The version that was reviewed
            $table->unsignedInteger('version');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['work_id', 'created_at']);
        });

        // One fix from a "return with comments": the student ticks it, the adviser confirms it before re-approval
        Schema::create('revision_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained()->cascadeOnDelete();
            // Encrypted at rest (private review text)
            $table->text('text');
            $table->boolean('done_by_student')->default(false);
            $table->boolean('confirmed_by_adviser')->default(false);
        });

        Schema::create('defense_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_id')->constrained()->cascadeOnDelete();
            $table->enum('stage', ['proposal', 'colloquium', 'final_defense', 'revisions', 'published']);
            $table->dateTime('date');
            // Panel members' names, comma-separated
            $table->string('panel', 300)->default('');
            $table->enum('verdict', ['pending', 'passed', 'passed_with_revisions', 'failed'])->default('pending');
            $table->string('notes', 500)->default('');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['work_id', 'date']);
        });

        // `review` comments are the private thread between authors and adviser; `public` ones are feed discussion
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->enum('scope', ['review', 'public'])->default('review');
            // Encrypted at rest
            $table->text('text');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['work_id', 'scope', 'created_at']);
        });

        // One reaction per reader per work
        Schema::create('reactions', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_id')->index()->constrained()->cascadeOnDelete();
            $table->enum('kind', ['insightful', 'useful', 'inspiring']);
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['user_id', 'work_id']);
        });

        // A reader's library
        Schema::create('saved_works', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_id')->index()->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['user_id', 'work_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_works');
        Schema::dropIfExists('reactions');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('defense_stages');
        Schema::dropIfExists('revision_items');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('work_versions');
        Schema::dropIfExists('work_authors');
        Schema::dropIfExists('works');
    }
};
