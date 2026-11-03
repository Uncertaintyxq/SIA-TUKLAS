/**
 * FollowButton — follow or unfollow a person, department or keyword. Following shows their new
 * works and research in the feed's Following filter and, per notification settings, tells you.
 */
import { Check, Plus } from 'lucide-react';
import { isFollowing, useFollow, useFollows, useUnfollow, type FollowTarget } from '../../api/follows';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export function FollowButton({ kind, target, label, className }: FollowTarget & { label: string; className?: string }) {
  const { data } = useFollows();
  const follow = useFollow();
  const unfollow = useUnfollow();
  const toast = useToast();
  const on = isFollowing(data, { kind, target });
  const action = on ? unfollow : follow;

  return (
    <Button
      variant={on ? 'secondary' : 'primary'}
      icon={on ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      aria-pressed={on}
      aria-label={`${on ? 'Unfollow' : 'Follow'} ${label}`}
      title={on ? `Unfollow ${label}` : undefined}
      loading={action.isPending}
      disabled={!data}
      className={className}
      onClick={() => action.mutate({ kind, target }, { onError: (e) => toast(e.message, 'error') })}
    >
      {on ? 'Following' : 'Follow'}
    </Button>
  );
}
