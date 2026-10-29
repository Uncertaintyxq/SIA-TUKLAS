<?php

namespace App\Enums;

/** Stages on a work's defense tracker. */
enum DefenseStageKind: string
{
    case Proposal = 'proposal';
    case Colloquium = 'colloquium';
    case FinalDefense = 'final_defense';
    case Revisions = 'revisions';
    case Published = 'published';
}
