<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who sees opportunities, events and their ads (docs/decisions/0002): the posting school by
 * default, or every school. Announcements get a school scope (one school's admins to that school).
 * Existing postings belong to their poster's school.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('opportunities', function (Blueprint $table) {
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
            $table->enum('audience', ['school', 'all'])->default('school');
        });
        Schema::table('events', function (Blueprint $table) {
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
            $table->enum('audience', ['school', 'all'])->default('school');
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->enum('scope', ['system', 'school', 'department', 'group'])->change();
            // school scope: which school
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
        });

        $schoolOf = DB::table('users')->pluck('institution_id', 'id');
        foreach (['opportunities' => 'adviser_id', 'events' => 'posted_by_id'] as $table => $poster) {
            foreach (DB::table($table)->get(['id', $poster]) as $row) {
                DB::table($table)->where('id', $row->id)->update(['institution_id' => $schoolOf[$row->{$poster}] ?? null]);
            }
        }
    }

    public function down(): void
    {
        DB::table('announcements')->where('scope', 'school')->delete();
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('institution_id');
            $table->enum('scope', ['system', 'department', 'group'])->change();
        });
        foreach (['events', 'opportunities'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('institution_id');
                $t->dropColumn('audience');
            });
        }
    }
};
