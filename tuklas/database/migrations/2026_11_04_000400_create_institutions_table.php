<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Several schools on one site (docs/decisions/0002). Every person belongs to a school, matched by
 * email domain at signup or confirmed by an admin. Super-admins manage the schools. A site that
 * already has accounts puts them all in one school named after TUKLAS_INSTITUTION, already
 * confirmed, and its admins become super-admins.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institutions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160)->unique();
            $table->string('short_name', 40)->default('');
            // Email domains that belong to the school, e.g. ["school.edu.ph"]; subdomains match too
            $table->json('email_domains');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('institution_id')->nullable()->constrained()->restrictOnDelete();
            // Null while the school's admins haven't confirmed someone who signed up without its email domain
            $table->timestamp('institution_confirmed_at')->nullable();
            $table->boolean('is_super_admin')->default(false);
        });

        if (DB::table('users')->exists()) {
            $now = now();
            $id = DB::table('institutions')->insertGetId([
                'name' => (string) (config('tuklas.institution') ?: config('app.name')),
                'short_name' => '', 'email_domains' => '[]', 'active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('users')->update(['institution_id' => $id, 'institution_confirmed_at' => $now]);
            DB::table('users')->where('role', 'admin')->update(['is_super_admin' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('institution_id');
            $table->dropColumn(['institution_confirmed_at', 'is_super_admin']);
        });
        Schema::dropIfExists('institutions');
    }
};
