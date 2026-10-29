<?php

namespace App\Http\Controllers\Works;

use App\Http\Controllers\Controller;
use App\Http\Requests\Works\StageRequest;
use App\Models\Work;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** The defense tracker: authors, the adviser and admins manage it while the work isn't removed. */
class DefenseStageController extends Controller
{
    /** POST /api/works/{id}/stages */
    public function store(StageRequest $request, int $id): Response
    {
        $this->work($id)->defenseStages()->create($request->stage());

        return response()->noContent(201);
    }

    /** PUT /api/works/{id}/stages/{stageId} */
    public function update(StageRequest $request, int $id, int $stageId): Response
    {
        $this->work($id)->defenseStages()->findOrFail($stageId)->update($request->stage());

        return response()->noContent();
    }

    /** DELETE /api/works/{id}/stages/{stageId} */
    public function destroy(int $id, int $stageId): Response
    {
        $this->work($id)->defenseStages()->whereKey($stageId)->delete();

        return response()->noContent();
    }

    private function work(int $id): Work
    {
        $work = WorkController::visible($id);
        if (Gate::denies('insider', $work) || $work->removed_at !== null) {
            throw new HttpException(404, WorkController::NOT_FOUND);
        }

        return $work;
    }
}
