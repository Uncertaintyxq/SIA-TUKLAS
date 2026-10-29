<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\BackgroundRequest;
use App\Http\Requests\Profile\HonorRequest;
use App\Http\Requests\Profile\UpdateLinksRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Resources\Auth\AccountResource;
use App\Models\Honor;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The signed-in person's own portfolio: /api/profile/… Every query is scoped to the signed-in
 * account, so an id for someone else's row simply isn't found.
 */
class ProfileController extends Controller
{
    /** PATCH /api/profile */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        DB::transaction(function () use ($request, $me) {
            $me->update(['name' => $request->string('name'), 'program' => $request->string('program'), 'headline' => $request->string('headline')->toString()]);
            $me->profile()->updateOrCreate([], [
                'titles' => $request->string('titles')->toString(),
                'department' => $request->string('department')->toString(),
                'bio_long' => $request->string('bioLong')->toString(),
            ]);
        });

        return response()->json(['user' => new AccountResource($me->refresh())]);
    }

    /** PUT /api/profile/links — replaces the whole list */
    public function links(UpdateLinksRequest $request): Response
    {
        /** @var User $me */
        $me = $request->user();
        DB::transaction(function () use ($request, $me) {
            $me->links()->delete();
            foreach ($request->validated('links') as $link) {
                $me->links()->create(['type' => $link['type'], 'url' => $link['url'], 'label' => $link['label'] ?? '']);
            }
        });

        return response()->noContent();
    }

    /** POST /api/profile/background */
    public function addBackground(BackgroundRequest $request): JsonResponse
    {
        $row = $request->user()->backgrounds()->create($request->validated());

        return response()->json($row->only(['id', 'degree', 'school', 'year']), 201);
    }

    /** PUT /api/profile/background/{id} */
    public function updateBackground(BackgroundRequest $request, int $id): Response
    {
        $request->user()->backgrounds()->findOrFail($id)->update($request->validated());

        return response()->noContent();
    }

    /** DELETE /api/profile/background/{id} */
    public function deleteBackground(Request $request, int $id): Response
    {
        $request->user()->backgrounds()->whereKey($id)->delete();

        return response()->noContent();
    }

    /** POST /api/profile/honors — Rule 4: a non-admin's honor is saved unverified, whatever the request says. */
    public function addHonor(HonorRequest $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $honor = new Honor($request->validated());
        $honor->user()->associate($me);
        if ($me->isAdmin()) {
            $honor->forceFill(['verified' => true, 'verified_by_id' => $me->id, 'verified_at' => now()]);
        }
        $honor->save();

        if (! $me->isAdmin()) {
            Notifier::notifyAdmins('honor_claimed', "{$me->name} added “{$honor->title}” and it needs verification.", '/admin?tab=honors');
        }

        return response()->json($honor->only(['id', 'kind', 'title', 'issuer', 'year', 'verified']), 201);
    }

    /** PUT /api/profile/honors/{id} — editing sends a non-admin's honor back for verification. */
    public function updateHonor(HonorRequest $request, int $id): Response
    {
        /** @var User $me */
        $me = $request->user();
        $honor = $me->honors()->findOrFail($id);
        $honor->fill($request->validated());
        if (! $me->isAdmin()) {
            $honor->forceFill(['verified' => false, 'verified_by_id' => null, 'verified_at' => null]);
        }
        $honor->save();

        return response()->noContent();
    }

    /** DELETE /api/profile/honors/{id} */
    public function deleteHonor(Request $request, int $id): Response
    {
        $request->user()->honors()->whereKey($id)->delete();

        return response()->noContent();
    }

    /** PUT /api/profile/photo — the image itself is the request body */
    public function uploadPhoto(Request $request): Response
    {
        $upload = Uploads::store($request, 'image');

        return $this->replaceFile($request->user(), ['photo_file' => $upload['file'], 'photo_type' => $upload['type']], 'photo_file');
    }

    /** DELETE /api/profile/photo */
    public function deletePhoto(Request $request): Response
    {
        return $this->replaceFile($request->user(), ['photo_file' => null, 'photo_type' => null], 'photo_file');
    }

    /** PUT /api/profile/cv — the PDF itself is the request body */
    public function uploadCv(Request $request): Response
    {
        $upload = Uploads::store($request, 'pdf');

        return $this->replaceFile($request->user(), ['cv_file' => $upload['file'], 'cv_name' => $upload['name']], 'cv_file');
    }

    /** DELETE /api/profile/cv */
    public function deleteCv(Request $request): Response
    {
        return $this->replaceFile($request->user(), ['cv_file' => null, 'cv_name' => null], 'cv_file');
    }

    /** Saves the new file name(s) on the profile, then deletes the file it replaced. */
    private function replaceFile(User $me, array $values, string $column): Response
    {
        $profile = $me->profile()->firstOrCreate();
        $old = $profile->{$column};
        $profile->forceFill($values)->save();
        if ($old !== $values[$column]) {
            Uploads::delete($old);
        }

        return response()->noContent();
    }
}
