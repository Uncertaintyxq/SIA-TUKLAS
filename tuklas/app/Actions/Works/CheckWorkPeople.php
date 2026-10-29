<?php

namespace App\Actions\Works;

use App\Enums\Role;
use App\Models\User;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** The adviser must be a verified educator; co-authors are students or educators. Nobody plays two parts. */
class CheckWorkPeople
{
    /**
     * @param  list<int>  $coAuthorIds
     *
     * @throws HttpException 400 with the reason
     */
    public function handle(User $me, int $adviserId, array $coAuthorIds): void
    {
        $problem = match (true) {
            $adviserId === $me->id => 'You can’t be your own adviser. Choose another research adviser.',
            ! User::where('id', $adviserId)->where('role', Role::Educator)->where('verified', true)->exists() => 'Choose a verified research adviser.',
            in_array($me->id, $coAuthorIds, true) => 'You’re already the main author; don’t add yourself as a co-author.',
            in_array($adviserId, $coAuthorIds, true) => 'Your adviser can’t also be a co-author.',
            User::whereIn('id', $coAuthorIds)->whereIn('role', [Role::Student, Role::Educator])->count() !== count($coAuthorIds) => 'One of the co-authors couldn’t be found.',
            default => null,
        };

        if ($problem !== null) {
            throw new HttpException(400, $problem);
        }
    }
}
