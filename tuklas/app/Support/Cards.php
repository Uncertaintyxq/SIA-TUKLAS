<?php

namespace App\Support;

use App\Enums\CommentScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * Eager-loading for the card resources, so every list loads the same relations in a fixed number
 * of queries (no N+1). Pair each with its resource: UserCardResource, WorkCardResource, …
 */
class Cards
{
    /** Relations a UserCardResource reads. Prefix with the relation name: Cards::user('author'). */
    public static function user(string $relation): array
    {
        return [$relation, "{$relation}.profile"];
    }

    /** Everything a work card needs, plus the viewer's own reaction and save (no viewer = signed out). */
    public static function works(Builder $query, ?int $viewerId): Builder
    {
        return $query
            ->with([
                ...self::user('author'),
                ...self::user('adviser'),
                'approvedBy:id,name,role',
                ...self::user('coAuthors'),
                'reactions' => fn ($q) => $q->where('user_id', $viewerId ?? 0),
                'savedBy' => fn ($q) => $q->where('users.id', $viewerId ?? 0)->select('users.id'),
            ])
            ->withCount([
                'comments as public_comments_count' => fn ($q) => $q->where('scope', CommentScope::Public),
                'reactions as reactions_total',
            ]);
    }

    /** A work card plus what "My research" and the review board show (MyWorkResource). */
    public static function myWorks(Builder $query, int $viewerId): Builder
    {
        return self::works($query, $viewerId)
            ->withCount('versions')
            ->with([
                'reviews' => fn ($q) => $q->reorder()->latest('created_at')->latest('id'),
                'reviews.reviewer:id,name',
                'reviews.revisionItems:id,review_id,confirmed_by_adviser',
            ]);
    }

    public static function publications(Builder $query): Builder
    {
        return $query->with([...self::user('author'), ...self::user('coAuthors')]);
    }

    /** Events with their organizer, head count and whether the viewer registered. */
    public static function events(Builder $query, ?int $viewerId): Builder
    {
        return $query
            ->with(self::user('postedBy'))
            ->withCount('attendees')
            ->withExists(['attendees as registered' => fn ($q) => $q->where('users.id', $viewerId ?? 0)]);
    }

    public static function ads(Builder $query): Builder
    {
        return $query->with(['event:id,title,category,date,venue', ...self::user('createdBy')]);
    }

    /** Opportunities with their adviser and whether the viewer applied. */
    public static function opportunities(Builder $query, ?int $viewerId): Builder
    {
        return $query
            ->with(self::user('adviser'))
            ->withExists(['applications as applied' => fn ($q) => $q->where('user_id', $viewerId ?? 0)]);
    }
}
