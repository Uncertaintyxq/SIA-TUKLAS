<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Research an educator drafts and publishes directly. No adviser review: the educator's
 * publishing right is the gate. Drafts are the authors' alone, internal is for signed-in users,
 * public is for everyone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->index()->constrained('users')->cascadeOnDelete();
            $table->string('title', 200);
            $table->text('abstract');
            // Array of keyword strings
            $table->json('keywords');
            $table->text('methodology');
            $table->mediumText('full_text');
            $table->string('pdf_file', 80)->nullable();
            $table->string('pdf_name', 160)->nullable();
            $table->enum('visibility', ['draft', 'internal', 'public'])->default('draft');
            // Set the first time it leaves draft
            $table->dateTime('published_at')->nullable();
            $table->timestamps();

            $table->index(['visibility', 'published_at']);
        });

        // Co-authors beyond the main author, in byline order
        Schema::create('publication_authors', function (Blueprint $table) {
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('order');
            $table->primary(['publication_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_authors');
        Schema::dropIfExists('publications');
    }
};
