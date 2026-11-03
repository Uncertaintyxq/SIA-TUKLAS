<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reach: how many times public works and publications were viewed and their PDFs downloaded.
 * Each person or visitor counts once per day. content_hits remembers who already counted today as a
 * one-way hash (App\Support\Reach) and is emptied every day, so no personal data is kept.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Written out per table (not in a loop) so Larastan can read the new columns
        Schema::table('works', function (Blueprint $table) {
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('download_count')->default(0);
        });
        Schema::table('publications', function (Blueprint $table) {
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('download_count')->default(0);
        });

        Schema::create('content_hits', function (Blueprint $table) {
            $table->string('subject_type', 12);
            $table->unsignedBigInteger('subject_id');
            $table->string('kind', 10);
            $table->char('visitor', 64);
            $table->date('day')->index();
            $table->primary(['subject_type', 'subject_id', 'kind', 'visitor', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_hits');
        Schema::table('works', fn (Blueprint $table) => $table->dropColumn(['view_count', 'download_count']));
        Schema::table('publications', fn (Blueprint $table) => $table->dropColumn(['view_count', 'download_count']));
    }
};
