<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reports of works, discussion comments, chat messages, events and people. Admins see them in a
 * queue grouped by what was reported; resolving one closes every open report about the same thing.
 * `snapshot` keeps what was reported (encrypted), so the evidence survives the author deleting it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->enum('target_type', ['work', 'comment', 'message', 'event', 'user']);
            $table->unsignedBigInteger('target_id');
            // Whose content it is (or the person reported), so they can be warned
            $table->foreignId('target_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('reason', ['spam', 'harassment', 'inappropriate', 'plagiarism', 'privacy', 'other']);
            $table->text('details')->nullable();
            $table->text('snapshot');
            $table->enum('status', ['open', 'dismissed', 'actioned'])->default('open');
            // remove or warn when actioned; the admin's note goes to the person warned
            $table->string('action', 10)->nullable();
            $table->string('note', 500)->nullable();
            $table->foreignId('resolved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['target_type', 'target_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
