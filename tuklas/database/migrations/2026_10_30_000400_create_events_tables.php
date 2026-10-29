<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Academic events, registrations and ads. Advertising is limited to academic events, and both
 * events and ads need an admin before they go public.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('posted_by_id')->constrained('users')->cascadeOnDelete();
            $table->enum('category', ['colloquium', 'defense', 'fair', 'innovation', 'cpgarcia']);
            $table->string('title', 140);
            $table->text('description');
            $table->string('venue', 160);
            $table->dateTime('date');
            // Seats; null means open attendance
            $table->unsignedInteger('capacity')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['status', 'date']);
        });

        Schema::create('event_registrations', function (Blueprint $table) {
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['event_id', 'user_id']);
        });

        // An academic ad slot: a promo for an approved event, shown in the feed sidebar between starts_at and ends_at
        Schema::create('ads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_id')->constrained('users')->cascadeOnDelete();
            $table->string('headline', 120);
            $table->string('image_file', 80)->nullable();
            $table->string('image_type', 40)->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['status', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ads');
        Schema::dropIfExists('event_registrations');
        Schema::dropIfExists('events');
    }
};
