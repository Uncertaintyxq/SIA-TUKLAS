<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Models\Institution;
use Illuminate\Http\JsonResponse;

/** The schools people can sign up to (docs/decisions/0002). No sign-in needed: signup uses it. */
class InstitutionController extends Controller
{
    /** GET /api/institutions — active schools with their email domains, by name */
    public function index(): JsonResponse
    {
        return response()->json(Institution::active()->orderBy('name')->get()
            ->map(fn (Institution $i) => [...$i->card(), 'emailDomains' => $i->email_domains ?? []]));
    }
}
