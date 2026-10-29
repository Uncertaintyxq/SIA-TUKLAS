<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Portfolio: profile details beyond users, academic links, academic background and honors.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Portfolio details beyond the basics on users (name, program = position, headline = short bio)
        Schema::create('profiles', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            // Post-nominal titles, e.g. "PhD" or "RN, MAN"
            $table->string('titles', 120)->default('');
            $table->string('department', 160)->default('');
            $table->text('bio_long')->nullable();
            $table->string('photo_file', 80)->nullable();
            $table->string('photo_type', 40)->nullable();
            $table->string('cv_file', 80)->nullable();
            $table->string('cv_name', 160)->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('academic_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['scholar', 'orcid', 'researchgate', 'linkedin', 'faculty', 'other']);
            $table->string('url', 300);
            // Display name for `other` links
            $table->string('label', 80)->default('');
        });

        Schema::create('backgrounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('degree', 160);
            $table->string('school', 160);
            $table->string('year', 4);
        });

        Schema::create('honors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['award', 'grant', 'certification']);
            $table->string('title', 160);
            $table->string('issuer', 160);
            $table->string('year', 4);
            // Shown as "Pending verification" until an admin verifies it
            $table->boolean('verified')->default(false)->index();
            $table->foreignId('verified_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('honors');
        Schema::dropIfExists('backgrounds');
        Schema::dropIfExists('academic_links');
        Schema::dropIfExists('profiles');
    }
};
