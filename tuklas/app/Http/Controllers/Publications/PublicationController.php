<?php

namespace App\Http\Controllers\Publications;

use App\Enums\PublicationVisibility;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Feed\FeedController;
use App\Http\Requests\Publications\PublicationRequest;
use App\Http\Resources\PublicationCardResource;
use App\Models\Publication;
use App\Models\User;
use App\Models\Work;
use App\Support\Cards;
use App\Support\Followers;
use App\Support\Reach;
use App\Support\Uploads;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Educator research publishing: educators draft, host and publish their own research (no adviser
 * review), and everyone reads it in the research library. /api/publications/…
 */
class PublicationController extends Controller
{
    private const NOT_FOUND = 'That research doesn’t exist or isn’t published.';

    /** GET /api/publications?q=&year=&dept=&keyword= — the library: published research the viewer may read, newest first. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $term = mb_strtolower(mb_substr(trim((string) $request->query('q', '')), 0, 80));
        $year = FeedController::year($request->query('year'));
        $dept = mb_substr(trim((string) $request->query('dept', '')), 0, 160);
        $keyword = mb_substr(trim((string) $request->query('keyword', '')), 0, 40);
        $rows = Cards::publications($this->readable($request))
            ->when($year !== null, fn ($q) => $q->whereYear('published_at', $year))
            ->when($dept !== '', fn ($q) => $q->whereHas('author.profile', fn ($p) => $p->where('department', $dept)))
            ->when($keyword !== '', fn ($q) => $q->whereJsonContains('keywords', $keyword))
            ->orderByDesc('published_at')
            ->limit(200)
            ->get()
            ->filter(fn (Publication $p) => $term === '' || collect([$p->title, $p->abstract, ...($p->keywords ?? []), $p->author->name, ...$p->coAuthors->pluck('name')])
                ->contains(fn ($s) => str_contains(mb_strtolower((string) $s), $term)))
            ->values();

        return PublicationCardResource::collection($rows);
    }

    /**
     * GET /api/publications/browse — what the library can be browsed by: every department with how
     * much research and how many student works it has, and the years and keywords research has.
     * Counts only what the viewer may read (internal research needs an account).
     */
    public function browse(Request $request): JsonResponse
    {
        $research = $this->readable($request)->with('author.profile:user_id,department')->get(['id', 'author_id', 'keywords', 'published_at']);
        $works = Work::public()->with('author.profile:user_id,department')->get(['id', 'author_id']);
        $departmentOf = fn ($item) => $item->author?->profile?->department ?: null;
        $researchBy = $research->map($departmentOf)->filter()->countBy();
        $worksBy = $works->map($departmentOf)->filter()->countBy();

        return response()->json([
            'departments' => $researchBy->keys()->merge($worksBy->keys())->unique()->sort()->values()
                ->map(fn (string $d) => ['name' => $d, 'research' => (int) ($researchBy[$d] ?? 0), 'works' => (int) ($worksBy[$d] ?? 0)]),
            'years' => $research->map(fn (Publication $p) => $p->published_at?->year)->filter()->unique()->sortDesc()->values(),
            'keywords' => FeedController::topKeywords($research->pluck('keywords')),
        ]);
    }

    /** @return Builder<Publication> Published research the viewer may read: public, plus internal when signed in */
    private function readable(Request $request): Builder
    {
        return Publication::query()->whereIn('visibility', $request->user() ? [PublicationVisibility::Internal, PublicationVisibility::Public] : [PublicationVisibility::Public]);
    }

    /** GET /api/publications/mine — everything I wrote or co-wrote, drafts included. */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $me = $request->user();
        $rows = Cards::publications(Publication::query())
            ->where(fn ($q) => $q->where('author_id', $me->id)->orWhereHas('coAuthors', fn ($c) => $c->where('users.id', $me->id)))
            ->latest('updated_at')
            ->get();

        return PublicationCardResource::collection($rows);
    }

    /** GET /api/publications/{id} */
    public function show(Request $request, int $id): JsonResponse
    {
        $viewer = $request->user();
        $p = $this->visible($id);
        Reach::view($p, $request);

        return response()->json([
            ...(new PublicationCardResource($p))->resolve($request),
            'methodology' => $p->methodology,
            'fullText' => $p->full_text,
            'pdfName' => $p->pdf_file ? ($p->pdf_name ?? 'research.pdf') : null,
            'can' => [
                'edit' => $viewer?->id === $p->author_id,
                'delete' => $viewer !== null && ($viewer->id === $p->author_id || $viewer->isAdmin()),
                'publish' => $viewer?->id === $p->author_id && $viewer->hasRight('publish'),
            ],
        ]);
    }

    /** GET /api/publications/{id}/pdf[?download=1] — opening it in a browser counts as a download (Reach) */
    public function pdf(Request $request, int $id): StreamedResponse
    {
        $p = $this->visible($id);
        if ($p->pdf_file !== null) {
            Reach::download($p, $request);
        }

        return Uploads::serve($p->pdf_file, 'application/pdf', $p->pdf_name ?? 'research.pdf', $request->query('download') === '1');
    }

    /** POST /api/publications — educators */
    public function store(PublicationRequest $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        if ($me->role !== Role::Educator) {
            throw new HttpException(403, 'You don’t have access to this.');
        }
        $this->check($request, $me);

        $p = DB::transaction(function () use ($request, $me) {
            $p = new Publication($request->fields());
            $p->published_at = $request->visibility() === PublicationVisibility::Draft ? null : now();
            $p->author()->associate($me)->save();
            $p->coAuthors()->sync($request->byline());

            return $p;
        });
        if ($p->published_at !== null) {
            Followers::tellAboutPublication($p);
        }

        return response()->json(['id' => $p->id], 201);
    }

    /** PUT /api/publications/{id} — the first move out of Draft stamps the publication date and tells followers. */
    public function update(PublicationRequest $request, int $id): Response
    {
        /** @var User $me */
        $me = $request->user();
        $p = $this->visible($id);
        if (Gate::denies('update', $p)) {
            throw new HttpException(403, 'Only the main author can edit this research.');
        }
        $this->check($request, $me);

        $wasDraft = $p->published_at === null;
        DB::transaction(function () use ($request, $p) {
            $p->fill($request->fields());
            if ($request->visibility() !== PublicationVisibility::Draft) {
                $p->published_at ??= now();
            }
            $p->save();
            $p->coAuthors()->sync($request->byline());
        });
        // Followers hear once, the first time it leaves Draft
        if ($wasDraft && $p->published_at !== null) {
            Followers::tellAboutPublication($p->unsetRelation('coAuthors'));
        }

        return response()->noContent();
    }

    /** DELETE /api/publications/{id} */
    public function destroy(int $id): Response
    {
        $p = $this->visible($id);
        if (Gate::denies('delete', $p)) {
            throw new HttpException(404, self::NOT_FOUND);
        }
        $p->delete();
        Uploads::delete($p->pdf_file);

        return response()->noContent();
    }

    /** PUT /api/publications/{id}/pdf — the PDF itself is the body */
    public function uploadPdf(Request $request, int $id): Response
    {
        $p = $this->authored($request, $id);
        $upload = Uploads::store($request, 'pdf');
        $old = $p->pdf_file;
        $p->forceFill(['pdf_file' => $upload['file'], 'pdf_name' => $upload['name']])->save();
        Uploads::delete($old);

        return response()->noContent();
    }

    /** DELETE /api/publications/{id}/pdf */
    public function removePdf(Request $request, int $id): Response
    {
        $p = $this->authored($request, $id);
        $old = $p->pdf_file;
        $p->forceFill(['pdf_file' => null, 'pdf_name' => null])->save();
        Uploads::delete($old);

        return response()->noContent();
    }

    private function visible(int $id): Publication
    {
        $p = Cards::publications(Publication::query())->find($id);
        if ($p === null || Gate::denies('view', $p)) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $p;
    }

    private function authored(Request $request, int $id): Publication
    {
        $p = Publication::find($id);
        if ($p === null || $p->author_id !== $request->user()->id) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $p;
    }

    /** Verified educators write; Internal and Public need the publishing right. */
    private function check(PublicationRequest $request, User $me): void
    {
        if (! $me->verified) {
            throw new HttpException(403, 'An admin needs to verify your educator account first.');
        }
        if ($request->visibility() !== PublicationVisibility::Draft && ! $me->hasRight('publish')) {
            throw new HttpException(403, 'An admin has turned off your publishing right. You can still save drafts.');
        }
        $ids = array_keys($request->byline());
        if (in_array($me->id, $ids, true)) {
            throw new HttpException(400, 'You’re already the main author; don’t add yourself as a co-author.');
        }
        if (User::active()->whereIn('id', $ids)->whereIn('role', [Role::Student, Role::Educator])->count() !== count($ids)) {
            throw new HttpException(400, 'One of the co-authors couldn’t be found.');
        }
    }
}
