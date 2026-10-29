<?php

namespace App\Http\Controllers\Works;

use App\Enums\CommentScope;
use App\Enums\ReactionKind;
use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\User;
use App\Models\Work;
use App\Support\Notifier;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Reading public works: reactions, the reader's library, and the public discussion. Public works only. */
class ReadingController extends Controller
{
    /** PUT /api/works/{id}/reaction {kind} */
    public function react(Request $request, int $id): Response
    {
        $kind = $request->validate(['kind' => ['required', Rule::enum(ReactionKind::class)]])['kind'];
        $work = $this->publicWork($id);
        Reaction::upsert([['user_id' => $request->user()->id, 'work_id' => $work->id, 'kind' => $kind, 'created_at' => now()]], ['user_id', 'work_id'], ['kind']);

        return response()->noContent();
    }

    /** DELETE /api/works/{id}/reaction */
    public function unreact(Request $request, int $id): Response
    {
        Reaction::where('user_id', $request->user()->id)->where('work_id', $id)->delete();

        return response()->noContent();
    }

    /** PUT /api/works/{id}/save */
    public function save(Request $request, int $id): Response
    {
        $work = $this->publicWork($id);
        $request->user()->savedWorks()->syncWithoutDetaching([$work->id => ['created_at' => now()]]);

        return response()->noContent();
    }

    /** DELETE /api/works/{id}/save */
    public function unsave(Request $request, int $id): Response
    {
        $request->user()->savedWorks()->detach($id);

        return response()->noContent();
    }

    /** POST /api/works/{id}/discussion {text} */
    public function discuss(Request $request, int $id): Response
    {
        $text = $request->validate(['text' => ['required', 'string', 'min:1', 'max:4000']], ['text.*' => 'Write something first'])['text'];
        /** @var User $me */
        $me = $request->user();
        $work = $this->publicWork($id);
        $work->comments()->create(['author_id' => $me->id, 'text' => $text, 'scope' => CommentScope::Public]);
        Notifier::notify($work->authorIds(), 'work_comment', "{$me->name} commented on your published work “{$work->title}”.", "/works/{$work->id}#discussion", $me->id);

        return response()->noContent(201);
    }

    /** DELETE /api/works/{id}/discussion/{commentId} — the comment's author, or an admin. */
    public function deleteComment(Request $request, int $id, int $commentId): Response
    {
        /** @var User $me */
        $me = $request->user();
        $deleted = Comment::whereKey($commentId)->where('work_id', $id)->where('scope', CommentScope::Public)
            ->when(! $me->isAdmin(), fn ($q) => $q->where('author_id', $me->id))
            ->delete();
        if ($deleted === 0) {
            throw new HttpException(404, 'Not found');
        }

        return response()->noContent();
    }

    private function publicWork(int $id): Work
    {
        $work = Work::forAccess($id);
        if ($work === null || ! $work->isPublic()) {
            throw new HttpException(404, WorkController::NOT_FOUND);
        }

        return $work;
    }
}
