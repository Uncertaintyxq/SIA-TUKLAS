<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Earlier versions of a deliverable submission. Handing in again moves the current file, note and
 * the review it got here, so the adviser and student can compare drafts and see past feedback.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliverable_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deliverable_submission_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('version');
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('file', 80);
            $table->string('name', 160);
            $table->string('type', 100);
            $table->unsignedInteger('size');
            // Encrypted at rest, like the live submission
            $table->text('note')->nullable();
            $table->enum('status', ['submitted', 'needs_revision', 'accepted']);
            $table->text('feedback')->nullable();
            $table->foreignId('reviewed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at');

            $table->unique(['deliverable_submission_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliverable_versions');
    }
};
