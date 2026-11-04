<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Each school's list of departments (docs/decisions/0002). Admins add and rename them; one is
 * removed only while nobody has picked it and no announcement points at it.
 */
class DepartmentController extends Controller
{
    /** GET /api/admin/departments?institution= — a school's departments with how many people picked each */
    public function index(Request $request): JsonResponse
    {
        $school = $request->integer('institution');
        $rows = Department::withCount('profiles')->where('institution_id', $school ?: null)->orderBy('name')->get();

        return response()->json($rows->map(fn (Department $d) => [...$d->card(), 'people' => (int) $d->profiles_count]));
    }

    /** POST /api/admin/departments {institutionId, name} */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institutionId' => ['required', 'integer', Rule::exists('institutions', 'id')],
            'name' => ['required', 'string', 'min:2', 'max:160', Rule::unique('departments', 'name')->where('institution_id', $request->integer('institutionId'))],
        ], ['name.unique' => 'That school has a department with that name already.']);
        $department = Department::create(['institution_id' => (int) $data['institutionId'], 'name' => trim($data['name'])]);
        Audit::log('department_created', $request->user(), $department);

        return response()->json(['id' => $department->id], 201);
    }

    /** PUT /api/admin/departments/{id} {name} — renaming changes it everywhere it shows */
    public function update(Request $request, int $id): Response
    {
        $department = Department::findOrFail($id);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160', Rule::unique('departments', 'name')->where('institution_id', $department->institution_id)->ignore($department->id)],
        ], ['name.unique' => 'That school has a department with that name already.']);
        $department->update(['name' => trim($data['name'])]);
        Audit::log('department_changed', $request->user(), $department);

        return response()->noContent();
    }

    /** DELETE /api/admin/departments/{id} — only while nobody uses it */
    public function destroy(Request $request, int $id): Response
    {
        $department = Department::withCount('profiles')->findOrFail($id);
        if ($department->profiles_count > 0 || $department->announcements()->exists()) {
            throw new HttpException(409, 'People or announcements use this department. Rename it instead, or move them first.');
        }
        $department->delete();
        Audit::log('department_deleted', $request->user(), $department);

        return response()->noContent();
    }
}
