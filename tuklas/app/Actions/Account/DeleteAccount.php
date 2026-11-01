<?php

namespace App\Actions\Account;

use App\Enums\SubmissionMode;
use App\Models\DeliverableSubmission;
use App\Models\Message;
use App\Models\ResearchGroup;
use App\Models\User;
use App\Support\Audit;
use App\Support\Groups;
use App\Support\Notifier;
use App\Support\Uploads;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Deletes an account (docs/CONVERSION.md D13, the Data Privacy Act right to erasure).
 *
 * The user row stays, anonymised as "Former member", because approved works, reviews and groups
 * point at it. Everything personal goes: portfolio, unfinished works, comments, reactions, messages,
 * files, memberships, notifications, sessions. What others rely on stays under "Former member":
 * approved works, reviews, approved events, published research, announcements, the groups they
 * advise (admins are told to take them over) and shared group deliverables.
 */
class DeleteAccount
{
    public const FORMER_NAME = 'Former member';

    public function __invoke(User $user): void
    {
        $id = $user->id;
        $name = $user->name;
        $files = [];

        DB::transaction(function () use ($user, $id, $name, &$files) {
            // Portfolio
            $profile = DB::table('profiles')->where('user_id', $id)->first(['photo_file', 'cv_file']);
            array_push($files, $profile?->photo_file, $profile?->cv_file);
            foreach (['profiles', 'academic_links', 'backgrounds', 'honors'] as $table) {
                DB::table($table)->where('user_id', $id)->delete();
            }

            // Works: approved ones stay in the library; unfinished ones (and their files) go
            $unfinished = DB::table('works')->where('author_id', $id)->where('status', '!=', 'approved')->pluck('id');
            array_push($files, ...DB::table('works')->whereIn('id', $unfinished)->pluck('pdf_file'), ...DB::table('work_versions')->whereIn('work_id', $unfinished)->pluck('pdf_file'));
            DB::table('works')->whereIn('id', $unfinished)->delete();
            DB::table('work_authors')->where('user_id', $id)->whereIn('work_id', DB::table('works')->where('status', '!=', 'approved')->select('id'))->delete();
            foreach (['comments' => 'author_id', 'reactions' => 'user_id', 'message_reactions' => 'user_id', 'saved_works' => 'user_id', 'event_registrations' => 'user_id',
                'opportunity_applications' => 'user_id', 'announcement_reads' => 'user_id', 'notifications' => 'user_id'] as $table => $column) {
                DB::table($table)->where($column, $id)->delete();
            }
            DB::table('opportunities')->where('adviser_id', $id)->delete();

            // Events and ads waiting for approval go; approved ones are part of the calendar
            array_push($files, ...DB::table('ads')->where('created_by_id', $id)->where('status', '!=', 'approved')->pluck('image_file'));
            DB::table('ads')->where('created_by_id', $id)->where('status', '!=', 'approved')->delete();
            array_push($files, ...DB::table('ads')->whereIn('event_id', DB::table('events')->where('posted_by_id', $id)->where('status', '!=', 'approved')->select('id'))->pluck('image_file'));
            DB::table('events')->where('posted_by_id', $id)->where('status', '!=', 'approved')->delete();

            // Research: drafts go; internal and public publications stay
            array_push($files, ...DB::table('publications')->where('author_id', $id)->where('visibility', 'draft')->pluck('pdf_file'));
            DB::table('publications')->where('author_id', $id)->where('visibility', 'draft')->delete();
            DB::table('publication_authors')->where('user_id', $id)->whereIn('publication_id', DB::table('publications')->where('visibility', 'draft')->select('id'))->delete();

            // Groups: out of every group and channel; files they shared and their own deliverables go
            foreach (ResearchGroup::whereHas('members', fn ($m) => $m->where('user_id', $id))->get() as $group) {
                Groups::leaveChannels($group, $id);
            }
            DB::table('group_members')->where('user_id', $id)->delete();
            array_push($files, ...DB::table('group_files')->where('uploaded_by_id', $id)->pluck('file'));
            DB::table('group_files')->where('uploaded_by_id', $id)->delete();
            $own = DeliverableSubmission::where('student_id', $id)
                ->whereHas('deadline', fn ($d) => $d->where('submission_mode', SubmissionMode::Each));
            array_push($files, ...DeliverableSubmission::filesOf($own));
            $own->delete();

            // Messages: removed like a deleted message, so conversations still read in order
            array_push($files, ...DB::table('messages')->where('sender_id', $id)->pluck('file'));
            Message::where('sender_id', $id)->update([
                'text' => Crypt::encryptString(''), 'file' => null, 'file_name' => null, 'file_type' => null, 'file_size' => null,
                'group_file_id' => null, 'deleted_at' => now(),
            ]);
            DB::table('conversation_members')->where('user_id', $id)->delete();

            // Reports: the ones they filed go; copies of their content kept as evidence in reports about them are blanked
            DB::table('reports')->where('reporter_id', $id)->delete();
            DB::table('reports')->where('target_owner_id', $id)->update(['snapshot' => Crypt::encryptString('(deleted account)')]);

            // Their name in what other people see: the group logs and others' notifications
            foreach (['group_activities' => 'detail', 'notifications' => 'message'] as $table => $column) {
                DB::table($table)->where($column, 'like', '%'.addcslashes($name, '%_\\').'%')
                    ->update([$column => DB::raw('REPLACE('.$column.', '.DB::getPdo()->quote($name).', '.DB::getPdo()->quote(self::FORMER_NAME).')')]);
            }

            DB::table('sessions')->where('user_id', $id)->delete();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            $user->forceFill([
                'name' => self::FORMER_NAME,
                'username' => "former-member-{$id}",
                'email' => "former-member-{$id}@deleted.invalid",
                'email_verified_at' => null,
                'password' => Hash::make(Str::random(64)),
                'program' => '',
                'headline' => '',
                'can_publish' => false, 'can_moderate_groups' => false, 'can_broadcast' => false,
                'last_seen_at' => null,
                'privacy_accepted_at' => null, 'privacy_version' => null,
                'two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null,
                'remember_token' => null,
                'account_deleted_at' => now(),
            ])->save();

            Audit::log('account_deleted', $user, $user);
        });

        array_map(Uploads::delete(...), array_values(array_filter($files)));

        // Groups they advised keep their members and work; admins can still manage them
        foreach (ResearchGroup::where('adviser_id', $id)->get(['id', 'name']) as $group) {
            Notifier::notifyAdmins('group_orphaned', "The adviser of “{$group->name}” deleted their account. The group and its work are kept; admins can still manage it.", "/groups/{$group->id}");
        }
        // Students waiting on them as adviser need someone else to review their work
        $waiting = DB::table('works')->where('adviser_id', $id)->whereNotIn('status', ['approved', 'rejected'])->get(['id', 'author_id', 'title']);
        foreach ($waiting as $work) {
            Notifier::notify((int) $work->author_id, 'adviser_left', "Your adviser for “{$work->title}” deleted their account. The Office of Research can review it, and while it’s a draft or being revised you can choose another adviser.", "/works/{$work->id}");
        }
        if ($waiting->isNotEmpty()) {
            Notifier::notifyAdmins('adviser_left', "An adviser deleted their account with {$waiting->count()} student work(s) still in review.", '/admin');
        }
    }
}
