<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Institution;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The schools on this site (docs/decisions/0002): super-admins add them, edit their names and
 * email domains, and turn them off. A school is never deleted; its people and work point at it.
 */
class InstitutionController extends Controller
{
    /** GET /api/admin/institutions — every school, turned-off ones too, with how many people it has */
    public function index(): JsonResponse
    {
        $schools = Institution::withCount(['users' => fn ($q) => $q->whereNull('account_deleted_at')])->orderBy('name')->get();

        return response()->json($schools->map(fn (Institution $i) => [
            ...$i->card(), 'emailDomains' => $i->email_domains ?? [], 'active' => $i->active, 'people' => (int) $i->users_count,
        ]));
    }

    /** POST /api/admin/institutions {name, shortName, emailDomains[]} */
    public function store(Request $request): JsonResponse
    {
        $school = Institution::create($this->fields($request, null));
        Audit::log('institution_created', $request->user(), $school);

        return response()->json(['id' => $school->id], 201);
    }

    /** PUT /api/admin/institutions/{id} {name, shortName, emailDomains[], active} */
    public function update(Request $request, int $id): Response
    {
        $school = Institution::findOrFail($id);
        $school->update($this->fields($request, $school));
        Audit::log('institution_changed', $request->user(), $school);

        return response()->noContent();
    }

    /**
     * @return array{name: string, short_name: string, email_domains: list<string>, active: bool}
     *
     * @throws ValidationException
     */
    private function fields(Request $request, ?Institution $school): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160', Rule::unique('institutions', 'name')->ignore($school?->id)],
            'shortName' => ['nullable', 'string', 'max:40'],
            'emailDomains' => ['present', 'array', 'max:10'],
            'emailDomains.*' => ['string', 'max:120', 'regex:/^(?=.{3,120}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i'],
            'active' => ['sometimes', 'boolean'],
        ], [
            'name.unique' => 'There’s a school with that name already.',
            'emailDomains.*.regex' => 'Enter email domains like school.edu.ph, without the @.',
        ]);
        $domains = collect($data['emailDomains'])->map(fn (string $d) => mb_strtolower(trim($d)))->unique()->values();
        // A domain belongs to one school, or signups couldn't tell which
        $taken = Institution::query()->when($school, fn ($q) => $q->whereKeyNot($school->id))->get()
            ->flatMap(fn (Institution $i) => $i->email_domains ?? [])->intersect($domains)->first();
        if ($taken !== null) {
            throw ValidationException::withMessages(['emailDomains' => "{$taken} already belongs to another school."]);
        }

        return [
            'name' => trim($data['name']),
            'short_name' => trim((string) ($data['shortName'] ?? '')),
            'email_domains' => $domains->all(),
            'active' => (bool) ($data['active'] ?? $school->active ?? true),
        ];
    }
}
