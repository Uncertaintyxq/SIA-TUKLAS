<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\Institution;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Adds a school on the server, or updates one by name (docs/decisions/0002): its short name, the
 * email domains that sign people in to it straight away, and its departments. Running it again
 * adds what's new and keeps the rest. After launch, super-admins do this on the admin page.
 */
#[Signature('tuklas:school {name : The school\'s full name}
    {--short= : Short name for person cards, e.g. UIC}
    {--domain=* : An email domain that belongs to it, e.g. uic.edu.ph (repeat for several)}
    {--department=* : A department to add (repeat for several)}')]
#[Description('Add or update a school with its email domains and departments')]
class AddSchool extends Command
{
    public function handle(): int
    {
        $name = trim((string) $this->argument('name'));
        $domains = collect((array) $this->option('domain'))->map(fn ($d) => mb_strtolower(ltrim(trim((string) $d), '@')))->filter()->unique()->values();
        foreach ($domains as $domain) {
            if (! preg_match('/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/', $domain)) {
                $this->error("{$domain} doesn't look like an email domain (e.g. school.edu.ph).");

                return self::FAILURE;
            }
            $owner = Institution::where('name', '!=', $name)->get()->first(fn (Institution $i) => in_array($domain, $i->email_domains ?? [], true));
            if ($owner !== null) {
                $this->error("{$domain} already belongs to {$owner->name}.");

                return self::FAILURE;
            }
        }

        $school = Institution::firstOrNew(['name' => $name]);
        $created = ! $school->exists;
        $school->fill([
            'short_name' => $this->option('short') !== null ? trim((string) $this->option('short')) : ($school->short_name ?? ''),
            'email_domains' => collect($school->email_domains ?? [])->merge($domains)->unique()->values()->all(),
            'active' => true,
        ])->save();

        $added = 0;
        foreach ((array) $this->option('department') as $department) {
            $department = trim((string) $department);
            if ($department !== '' && Department::firstOrCreate(['institution_id' => $school->id, 'name' => $department])->wasRecentlyCreated) {
                $added++;
            }
        }

        $this->info(($created ? 'Added ' : 'Updated ').$school->name.' (id '.$school->id.').');
        $this->line('Email domains: '.(($school->email_domains ?? []) === [] ? 'none (every signup waits for an admin)' : implode(', ', $school->email_domains)));
        $this->line("Departments added: {$added}; it has ".Department::where('institution_id', $school->id)->count().' in all.');

        return self::SUCCESS;
    }
}
