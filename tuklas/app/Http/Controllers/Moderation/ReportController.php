<?php

namespace App\Http\Controllers\Moderation;

use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTarget;
use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Support\Notifier;
use App\Support\Reportables;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Anyone signed in can report what they can see. The person reported is never told who reported them. */
class ReportController extends Controller
{
    /** POST /api/reports {type, id, reason, details?} */
    public function store(Request $request): JsonResponse
    {
        $me = $request->user();
        $input = $request->validate([
            'type' => ['required', Rule::enum(ReportTarget::class)],
            'id' => ['required', 'integer', 'min:1'],
            'reason' => ['required', Rule::enum(ReportReason::class)],
            'details' => ['nullable', 'string', 'max:500'],
        ]);
        $type = ReportTarget::from($input['type']);
        $id = (int) $input['id'];
        $target = Reportables::find($type, $id, $me) ?? throw new HttpException(404, 'Not found');
        if ($target['owner'] === $me->id) {
            throw new HttpException(422, 'You can’t report your own '.($type === ReportTarget::User ? 'account' : $type->value).'.');
        }

        $open = fn () => Report::where('target_type', $type)->where('target_id', $id)->where('status', ReportStatus::Open);
        $firstReport = ! $open()->exists();
        // Reporting the same thing again updates the earlier report instead of adding another
        $report = $open()->where('reporter_id', $me->id)->first()
            ?? new Report(['reporter_id' => $me->id, 'target_type' => $type, 'target_id' => $id]);
        $report->fill([
            'target_owner_id' => $target['owner'],
            'reason' => $input['reason'],
            'details' => trim((string) ($input['details'] ?? '')) ?: null,
            'snapshot' => mb_substr($target['snapshot'], 0, 2000),
        ])->save();

        if ($firstReport) {
            Notifier::notifyAdmins('report_new', 'Something was reported and needs a look.', '/admin?tab=reports', $me->id);
        }

        return response()->json(['id' => $report->id], 201);
    }
}
