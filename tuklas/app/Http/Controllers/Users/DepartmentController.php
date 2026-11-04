<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A school's departments, for picking one's own on the portfolio (docs/decisions/0002). */
class DepartmentController extends Controller
{
    /** GET /api/departments?institution= — my school's departments by default */
    public function index(Request $request): JsonResponse
    {
        $school = $request->integer('institution') ?: $request->user()->institution_id;

        return response()->json(Department::byId()->where('institution_id', $school)->map->card()->values());
    }
}
