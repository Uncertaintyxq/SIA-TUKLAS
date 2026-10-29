<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opportunities educators post (mentorships, grants, calls for submissions) and students' applications.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adviser_id')->constrained('users')->cascadeOnDelete();
            $table->enum('kind', ['mentorship', 'grant', 'call']);
            $table->string('title', 140);
            $table->text('description');
            $table->dateTime('deadline');
            $table->unsignedInteger('slots')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('opportunity_applications', function (Blueprint $table) {
            $table->foreignId('opportunity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->string('message', 1000);
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['opportunity_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunity_applications');
        Schema::dropIfExists('opportunities');
    }
};
