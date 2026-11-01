<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Group deliverables: a group deadline can collect work from students, one submission each or one
 * for the whole group. The adviser and mentors accept it or ask for a revision with feedback.
 * A row holds the latest file; `version` counts how many times it was handed in, and earlier
 * versions move to deliverable_versions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('group_deadlines', function (Blueprint $table) {
            // none: a reminder only; each: every student submits; group: one submission for the group
            $table->string('submission_mode', 10)->default('none');
            $table->string('instructions', 2000)->default('');
        });

        Schema::create('deliverable_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_deadline_id')->constrained()->cascadeOnDelete();
            // Who handed it in. For a group deliverable there is one row, and this is the last student to submit.
            $table->foreignId('student_id')->index()->constrained('users')->cascadeOnDelete();
            $table->string('file', 80);
            $table->string('name', 160);
            $table->string('type', 100);
            $table->unsignedInteger('size');
            // Encrypted at rest, like chat and review text
            $table->text('note')->nullable();
            $table->unsignedSmallInteger('version')->default(1);
            $table->enum('status', ['submitted', 'needs_revision', 'accepted'])->default('submitted');
            $table->text('feedback')->nullable();
            $table->foreignId('reviewed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->useCurrent();

            $table->unique(['group_deadline_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliverable_submissions');
        Schema::table('group_deadlines', function (Blueprint $table) {
            $table->dropColumn(['submission_mode', 'instructions']);
        });
    }
};
