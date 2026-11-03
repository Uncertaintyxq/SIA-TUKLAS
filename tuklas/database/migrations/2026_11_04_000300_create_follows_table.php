<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Following people, departments and keywords: a "Following" feed, and a note when something new
 * from them goes public. `target` is the person's user id, the department's name or the keyword.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['person', 'department', 'tag']);
            $table->string('target', 160);
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['user_id', 'kind', 'target']);
            $table->index(['kind', 'target']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follows');
    }
};
