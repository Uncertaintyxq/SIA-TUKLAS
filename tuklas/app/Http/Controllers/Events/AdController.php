<?php

namespace App\Http\Controllers\Events;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\Ad;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Uploads;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Ad images and removing ads. /api/ads/… */
class AdController extends Controller
{
    /** GET /api/ads/{id}/image — approved ads for anyone; pending ones only for their requester and admins. */
    public function image(Request $request, int $id): StreamedResponse
    {
        $ad = Ad::find($id);
        $me = $request->user();
        if ($ad === null || ($ad->status !== ApprovalStatus::Approved && ! ($me && $this->owns($ad, $me)))) {
            throw new HttpException(404, 'Not found');
        }

        return Uploads::serve($ad->image_file, $ad->image_type ?? 'image/jpeg');
    }

    /** PUT /api/ads/{id}/image — the image itself is the body. A new image on an approved ad goes back to an admin. */
    public function uploadImage(Request $request, int $id): Response
    {
        /** @var User $me */
        $me = $request->user();
        $ad = Ad::with('event:id,title')->find($id);
        if ($ad === null || ! $this->owns($ad, $me)) {
            throw new HttpException(404, 'Not found');
        }
        $upload = Uploads::store($request, 'image');
        $old = $ad->image_file;
        $wasApproved = $ad->status === ApprovalStatus::Approved;
        $ad->forceFill(['image_file' => $upload['file'], 'image_type' => $upload['type']]);
        if (! $me->isAdmin()) {
            $ad->status = ApprovalStatus::Pending;
        }
        $ad->save();
        Uploads::delete($old);

        if (! $me->isAdmin() && $wasApproved) {
            Notifier::notifyAdmins('ad_requested', "{$me->name} changed the image on the ad for “{$ad->event->title}”.", '/admin?tab=ads');
        }

        return response()->noContent();
    }

    /** DELETE /api/ads/{id} */
    public function destroy(Request $request, int $id): Response
    {
        $ad = Ad::find($id);
        if ($ad === null || ! $this->owns($ad, $request->user())) {
            throw new HttpException(404, 'Not found');
        }
        $ad->delete();
        Uploads::delete($ad->image_file);

        return response()->noContent();
    }

    private function owns(Ad $ad, User $user): bool
    {
        return $user->isAdmin() || $ad->created_by_id === $user->id;
    }
}
