<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What stays inside a school (docs/decisions/0002). Departments become a list per school, replacing
 * the free-text department on profiles and department announcements, so "College of Computing" at
 * two schools stays two departments. Works and publications remember the school they belong to,
 * and works get the same Public or School only choice as educators' research ("internal" on
 * publications now means School only). Existing text is matched to the new departments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            // Null only on a site without schools
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('name', 160);
            $table->timestamps();
            $table->unique(['institution_id', 'name']);
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
        });
        Schema::table('works', function (Blueprint $table) {
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
            $table->enum('visibility', ['public', 'school'])->default('public');
        });
        Schema::table('publications', function (Blueprint $table) {
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
        });

        $this->moveData();

        Schema::table('profiles', fn (Blueprint $table) => $table->dropColumn('department'));
        Schema::table('announcements', fn (Blueprint $table) => $table->dropColumn('department'));
    }

    /** Text departments become rows per school; works and publications take their author's school. */
    private function moveData(): void
    {
        $now = now();
        $ids = [];
        $department = function (?int $school, string $name) use (&$ids, $now): ?int {
            $name = trim($name);
            if ($name === '') {
                return null;
            }
            $key = ($school ?? 0).'|'.mb_strtolower($name);

            return $ids[$key] ??= DB::table('departments')->insertGetId(['institution_id' => $school, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
        };
        $schoolOf = DB::table('users')->pluck('institution_id', 'id');

        foreach (DB::table('profiles')->where('department', '!=', '')->get(['user_id', 'department']) as $p) {
            DB::table('profiles')->where('user_id', $p->user_id)->update(['department_id' => $department($schoolOf[$p->user_id] ?? null, $p->department)]);
        }
        foreach (DB::table('announcements')->whereNotNull('department')->get(['id', 'author_id', 'department']) as $a) {
            DB::table('announcements')->where('id', $a->id)->update(['department_id' => $department($schoolOf[$a->author_id] ?? null, (string) $a->department)]);
        }
        // Department follows pointed at a name; now at the department (one per school with that name)
        foreach (DB::table('follows')->where('kind', 'department')->get() as $f) {
            $matches = DB::table('departments')->where('name', $f->target)->pluck('id');
            foreach ($matches as $id) {
                DB::table('follows')->insertOrIgnore(['user_id' => $f->user_id, 'kind' => 'department', 'target' => (string) $id, 'created_at' => $f->created_at]);
            }
            DB::table('follows')->where('id', $f->id)->delete();
        }
        foreach (['works' => 'author_id', 'publications' => 'author_id'] as $table => $author) {
            foreach (DB::table($table)->get(['id', $author]) as $row) {
                DB::table($table)->where('id', $row->id)->update(['institution_id' => $schoolOf[$row->{$author}] ?? null]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('profiles', fn (Blueprint $table) => $table->string('department', 160)->default(''));
        Schema::table('announcements', fn (Blueprint $table) => $table->string('department', 160)->nullable());
        foreach (DB::table('profiles')->whereNotNull('department_id')->get(['user_id', 'department_id']) as $p) {
            DB::table('profiles')->where('user_id', $p->user_id)->update(['department' => DB::table('departments')->where('id', $p->department_id)->value('name')]);
        }
        Schema::table('profiles', fn (Blueprint $table) => $table->dropConstrainedForeignId('department_id'));
        Schema::table('announcements', fn (Blueprint $table) => $table->dropConstrainedForeignId('department_id'));
        Schema::table('works', function (Blueprint $table) {
            $table->dropConstrainedForeignId('institution_id');
            $table->dropColumn('visibility');
        });
        Schema::table('publications', fn (Blueprint $table) => $table->dropConstrainedForeignId('institution_id'));
        Schema::dropIfExists('departments');
    }
};
