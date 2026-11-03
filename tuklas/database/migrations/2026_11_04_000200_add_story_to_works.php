<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "How we made this": the researchers' own words on how the work was made or conceived (client
 * Q&A 2a). Optional. Kept in each submitted version like the abstract, and public once the work is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('works', function (Blueprint $table) {
            $table->text('story')->nullable();
        });
        Schema::table('work_versions', function (Blueprint $table) {
            $table->text('story')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('works', fn (Blueprint $table) => $table->dropColumn('story'));
        Schema::table('work_versions', fn (Blueprint $table) => $table->dropColumn('story'));
    }
};
