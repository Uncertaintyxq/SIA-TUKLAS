<?php

namespace App\Http\Controllers\Works;

use App\Actions\Works\CheckWorkPeople;
use App\Actions\Works\SubmitWork;
use App\Enums\CommentScope;
use App\Enums\ReactionKind;
use App\Enums\WorkStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Works\WorkRequest;
use App\Http\Resources\MyWorkResource;
use App\Http\Resources\UserCardResource;
use App\Http\Resources\WorkCardResource;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Work;
use App\Support\Cards;
use App\Support\Topics;
use App\Support\Uploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Student works at /api/works: lists, one work, and writing a work. */
class WorkController extends Controller
{
    public const NOT_FOUND = 'That work doesn’t exist or isn’t public yet.';

    /** A work the viewer may see, ready for WorkPolicy; otherwise 404, the same as a missing work. */
    public static function visible(int $id): Work
    {
        $work = Work::forAccess($id);
        if ($work === null || Gate::denies('view', $work)) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        return $work;
    }

    /** GET /api/works/mine — everything I wrote or co-wrote, in every status. */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $me = $request->user();
        $works = Cards::myWorks(Work::query(), $me->id)
            ->where(fn ($q) => $q->where('author_id', $me->id)->orWhereHas('coAuthors', fn ($c) => $c->where('users.id', $me->id)))
            ->latest('updated_at')
            ->get();

        return MyWorkResource::collection($works);
    }

    /** GET /api/works/review-queue — everything submitted to me. Admins see all submitted work. */
    public function reviewQueue(Request $request): AnonymousResourceCollection
    {
        /** @var User $me */
        $me = $request->user();
        $works = Cards::myWorks(Work::query(), $me->id)
            ->where('status', '!=', WorkStatus::Draft)
            ->when(! $me->isAdmin(), fn ($q) => $q->where('adviser_id', $me->id))
            ->latest('updated_at')
            ->limit(200)
            ->get();

        return MyWorkResource::collection($works);
    }

    /** GET /api/works/similar?title=&keywords=&exclude= — approved works that share terms with a draft. */
    public function similar(Request $request): JsonResponse
    {
        $query = Topics::terms(mb_substr((string) $request->query('title', ''), 0, 180).' '.mb_substr((string) $request->query('keywords', ''), 0, 400));
        if ($query === []) {
            return response()->json([]);
        }

        $ranked = Work::public()
            ->when($request->integer('exclude'), fn ($q, $id) => $q->whereKeyNot($id))
            ->with(['author:id,name', 'coAuthors:id,name'])
            ->get(['id', 'author_id', 'title', 'type', 'tags', 'abstract', 'approved_at'])
            ->map(function (Work $w) use ($query) {
                $match = Topics::overlap($query, $w->title, $w->tags ?? [], $w->abstract);

                return [
                    'id' => $w->id,
                    'title' => $w->title,
                    'type' => $w->type->value,
                    'authors' => [$w->author->name, ...$w->coAuthors->pluck('name')->all()],
                    'year' => ($w->approved_at ?? now())->year,
                    'shared' => $match['shared'],
                    'score' => $match['score'],
                ];
            })
            ->where('score', '>=', 2)
            ->sortByDesc('score')
            ->take(5)
            ->map(fn (array $w) => collect($w)->except('score'))
            ->values();

        return response()->json($ranked);
    }

    /** GET /api/works/{id} — the work page. Private parts only for authors, the adviser and admins. */
    public function show(Request $request, int $id): JsonResponse
    {
        $viewer = $request->user();
        $work = Cards::works(Work::query(), $viewer?->id)
            ->with([
                'versions' => fn ($q) => $q->reorder()->orderByDesc('version'),
                ...Cards::user('reviews.reviewer'),
                'reviews.revisionItems' => fn ($q) => $q->orderBy('id'),
                'comments' => fn ($q) => $q->orderBy('created_at')->orderBy('id'),
                ...Cards::user('comments.author'),
                'defenseStages' => fn ($q) => $q->reorder()->orderBy('date')->orderBy('id'),
            ])
            ->find($id);
        if ($work === null || Gate::denies('view', $work)) {
            throw new HttpException(404, self::NOT_FOUND);
        }

        $insider = Gate::allows('insider', $work);
        $reviewer = Gate::allows('review', $work);
        $author = $work->isAuthor($viewer);
        $open = $work->isPublic();
        $final = $work->status->isFinal();
        $counts = Reaction::where('work_id', $work->id)->selectRaw('kind, count(*) as n')->groupBy('kind')->pluck('n', 'kind');
        $comment = fn (Comment $c) => [
            'id' => $c->id,
            'author' => new UserCardResource($c->author),
            'text' => $c->text,
            'createdAt' => $c->created_at->toISOString(),
            'canDelete' => $viewer !== null && ($viewer->id === $c->author_id || $viewer->isAdmin()),
        ];

        return response()->json([
            ...(new WorkCardResource($work))->resolve($request),
            'pdfName' => $work->pdf_file ? ($work->pdf_name ?? 'work.pdf') : null,
            'submittedAt' => $work->submitted_at?->toISOString(),
            'createdAt' => $work->created_at->toISOString(),
            'updatedAt' => $work->updated_at->toISOString(),
            'versions' => $insider ? $work->versions->map(fn ($v) => [
                'version' => $v->version, 'title' => $v->title, 'note' => $v->note,
                'submittedAt' => $v->submitted_at->toISOString(), 'pdfName' => $v->pdf_file ? ($v->pdf_name ?? 'work.pdf') : null,
            ]) : [],
            'reviews' => $insider ? $work->reviews->map(fn ($r) => [
                'id' => $r->id,
                'reviewer' => new UserCardResource($r->reviewer),
                'decision' => $r->decision->value,
                'comment' => $r->comment,
                'version' => $r->version,
                'createdAt' => $r->created_at->toISOString(),
                'items' => $r->revisionItems->map(fn ($i) => ['id' => $i->id, 'text' => $i->text, 'done' => $i->done_by_student, 'confirmed' => $i->confirmed_by_adviser]),
            ]) : [],
            'thread' => $insider ? $work->comments->where('scope', CommentScope::Review)->map($comment)->values() : [],
            'discussion' => $open ? $work->comments->where('scope', CommentScope::Public)->map($comment)->values() : [],
            'stages' => $work->defenseStages->map(fn ($s) => [
                'id' => $s->id, 'stage' => $s->stage->value, 'date' => $s->date->toISOString(),
                'panel' => $s->panel, 'verdict' => $s->verdict->value, 'notes' => $s->notes,
            ]),
            'reactions' => collect(ReactionKind::cases())->mapWithKeys(fn ($k) => [$k->value => (int) ($counts[$k->value] ?? 0)]),
            'openItems' => $work->reviews->flatMap->revisionItems->where('confirmed_by_adviser', false)->count(),
            'can' => [
                'edit' => Gate::allows('edit', $work),
                'submit' => Gate::allows('edit', $work),
                'delete' => $viewer !== null && $work->author_id === $viewer->id && $work->status === WorkStatus::Draft,
                'decide' => $reviewer && $work->removed_at === null ? array_map(fn ($d) => $d->value, $work->status->allowedDecisions()) : [],
                'comment' => $insider && $work->status->inReview(),
                'manageStages' => $insider && $work->removed_at === null,
                'tickItems' => $author && ! $final,
                'confirmItems' => $reviewer && ! $final,
                'discuss' => $viewer !== null && $open,
            ],
        ]);
    }

    /** POST /api/works — students and educators; saves a draft, or submits it right away. */
    public function store(WorkRequest $request, CheckWorkPeople $people, SubmitWork $submit): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        if ($me->isAdmin()) {
            throw new HttpException(403, 'Admins review works; they don’t submit them.');
        }
        $coAuthors = $request->coAuthorIds();
        $people->handle($me, $request->integer('adviserId'), $coAuthors);

        $work = DB::transaction(function () use ($request, $me, $coAuthors) {
            $work = new Work([
                'type' => $request->validated('type'), 'title' => $request->validated('title'),
                'abstract' => $request->validated('abstract'), 'tags' => $request->tags(), 'adviser_id' => $request->integer('adviserId'),
            ]);
            $work->author()->associate($me)->save();
            $work->coAuthors()->sync(self::bylineOrder($coAuthors));

            return $work;
        });

        if ($request->boolean('submit')) {
            $submit->handle($work->load('coAuthors:id'), $me);
        }

        return response()->json(['id' => $work->id], 201);
    }

    /** PUT /api/works/{id} */
    public function update(WorkRequest $request, CheckWorkPeople $people, int $id): Response
    {
        $work = self::visible($id);
        if (Gate::denies('edit', $work)) {
            throw new HttpException(409, 'Only the main author can edit a work, and only while it’s a draft or sent back for revision.');
        }
        $coAuthors = $request->coAuthorIds();
        $people->handle($request->user(), $request->integer('adviserId'), $coAuthors);

        DB::transaction(function () use ($request, $work, $coAuthors) {
            $work->update([
                'type' => $request->validated('type'), 'title' => $request->validated('title'),
                'abstract' => $request->validated('abstract'), 'tags' => $request->tags(), 'adviser_id' => $request->integer('adviserId'),
            ]);
            $work->coAuthors()->sync(self::bylineOrder($coAuthors));
        });

        return response()->noContent();
    }

    /** DELETE /api/works/{id} — only drafts, by their main author. */
    public function destroy(Request $request, int $id): Response
    {
        $work = self::visible($id);
        if ($work->author_id !== $request->user()->id || $work->status !== WorkStatus::Draft) {
            throw new HttpException(409, 'Only drafts can be deleted, by their main author.');
        }
        $work->delete();
        Uploads::delete($work->pdf_file);

        return response()->noContent();
    }

    /**
     * @param  list<int>  $ids
     * @return array<int, array{order: int}>
     */
    private static function bylineOrder(array $ids): array
    {
        $rows = [];
        foreach ($ids as $i => $id) {
            $rows[$id] = ['order' => $i + 1];
        }

        return $rows;
    }
}
