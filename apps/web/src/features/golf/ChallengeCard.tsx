import { Link } from 'react-router';
import type { ChallengeDto } from '@gogz/shared';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/ui';
import { describeStatus, opponentOf } from './status';

export function ChallengeCard({ challenge, meId }: { challenge: ChallengeDto; meId: string }) {
  const them = opponentOf(challenge, meId);
  const status = describeStatus(challenge, meId);
  const iSent = challenge.challenger.id === meId;
  return (
    <Link
      to={`/golf/challenges/${challenge.id}`}
      className="flex items-center gap-3 rounded-xl bg-panel p-3 shadow-sm ring-1 ring-line transition hover:ring-brand-400"
    >
      <Avatar name={them.displayName} url={them.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {iSent ? `You → ${them.displayName}` : `${them.displayName} → You`}
        </p>
        <p className="truncate text-sm text-muted">{challenge.prize}</p>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </Link>
  );
}
