<?php

namespace App\Http\Controllers\Works;

use App\Http\Controllers\Controller;
use App\Models\WorkVersion;
use App\Support\Uploads;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** A work's PDF and its versions' PDFs. Served with the same privacy check as the work. */
class WorkFileController extends Controller
{
    /** PUT /api/works/{id}/pdf — the PDF itself is the request body */
    public function upload(Request $request, int $id): Response
    {
        $work = WorkController::visible($id);
        if (Gate::denies('edit', $work)) {
            throw new HttpException(409, 'The PDF can only change while the work is a draft or sent back for revision.');
        }
        $upload = Uploads::store($request, 'pdf');
        $old = $work->pdf_file;
        $work->forceFill(['pdf_file' => $upload['file'], 'pdf_name' => $upload['name']])->save();
        $this->release($old);

        return response()->noContent();
    }

    /** DELETE /api/works/{id}/pdf */
    public function remove(int $id): Response
    {
        $work = WorkController::visible($id);
        if (Gate::denies('edit', $work)) {
            throw new HttpException(404, WorkController::NOT_FOUND);
        }
        $old = $work->pdf_file;
        $work->forceFill(['pdf_file' => null, 'pdf_name' => null])->save();
        $this->release($old);

        return response()->noContent();
    }

    /** GET /api/works/{id}/pdf[?download=1] */
    public function show(Request $request, int $id): StreamedResponse
    {
        $work = WorkController::visible($id);

        return Uploads::serve($work->pdf_file, 'application/pdf', $work->pdf_name ?? 'work.pdf', $request->query('download') === '1');
    }

    /** GET /api/works/{id}/versions/{version}/pdf — authors, the adviser and admins only */
    public function version(int $id, int $version): StreamedResponse
    {
        $work = WorkController::visible($id);
        if (Gate::denies('insider', $work)) {
            throw new HttpException(404, WorkController::NOT_FOUND);
        }
        $v = $work->versions()->where('version', $version)->first();

        return Uploads::serve($v?->pdf_file, 'application/pdf', $v?->pdf_name ?? "version-{$version}.pdf");
    }

    /** Deletes a replaced PDF unless a submitted version still points at it. */
    private function release(?string $file): void
    {
        if ($file !== null && ! WorkVersion::where('pdf_file', $file)->exists()) {
            Uploads::delete($file);
        }
    }
}
