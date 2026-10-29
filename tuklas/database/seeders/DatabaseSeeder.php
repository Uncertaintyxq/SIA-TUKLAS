<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** `php artisan db:seed` loads the demo data (see DemoSeeder). */
    public function run(): void
    {
        $this->call(DemoSeeder::class);
        $this->command?->info('Password for all demo accounts: '.DemoSeeder::PASSWORD);
    }
}
