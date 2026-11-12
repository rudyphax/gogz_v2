import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { MAX_PRIZE_LENGTH, type ChallengeDto } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation, useChallenge, useMe } from '../../api/hooks';
import { Avatar } from '../../components/Avatar';
import { Badge, Button, Card, ErrorText, Loading } from '../../components/ui';
import { describeStatus, opponentOf } from './status';

type ActionBody =
  | { type: 'accept' | 'decline' | 'cancel' | 'confirm' | 'dispute' }
  | { type: 'counter'; prize: string }
  | { type: 'report'; winnerId: string };

const EVENT_TEXT: Record<string, string> = {
  create: 'sent the challenge',
  counter: 'countered',
  accept: 'accepted',
  decline: 'declined',
  cancel: 'withdrew the challenge',
  report: 'reported the result',
  confirm: 'confirmed the result',
  dispute: 'disputed the result',
};

export function ChallengeDetailPage() {
  const { id = '' } = useParams();
  const { data: me } = useMe();
  const { data: challenge, isPending, error } = useChallenge(id);
  const [countering, setCountering] = useState(false);
  const [counterPrize, setCounterPrize] = useState('');

  const act = useApiMutation(
    (body: ActionBody) =>
      api<ChallengeDto>(`/golf/challenges/${id}/actions`, { method: 'POST', body }),
    [keys.challenge(id), keys.challenges, keys.friends],
    () => setCountering(false),
  );

  if (isPending || !me) return <Loading />;
  if (error) return <ErrorText error={error} />;

  const them = opponentOf(challenge, me.id);
  const status = describeStatus(challenge, me.id);
  const can = new Set(challenge.availableActions);
  const winnerName =
    challenge.winnerId === me.id ? 'You' : challenge.winnerId === them.id ? them.displayName : null;

  function submitCounter(e: FormEvent) {
    e.preventDefault();
    act.mutate({ type: 'counter', prize: counterPrize });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/golf" className="text-sm text-brand-700 hover:underline">
        ← Back to Golf
      </Link>

      <Card className="text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <Avatar name={me.displayName} url={me.avatarUrl} size={56} />
            <span className="text-sm font-semibold">You</span>
          </div>
          <span className="text-lg font-black text-stone-300">VS</span>
          <div className="flex flex-col items-center gap-1">
            <Avatar name={them.displayName} url={them.avatarUrl} size={56} />
            <span className="text-sm font-semibold">{them.displayName}</span>
          </div>
        </div>
        <p className="mt-5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          On the line
        </p>
        <p className="mt-1 text-2xl font-bold" data-testid="prize">
          {challenge.prize}
        </p>
        <div className="mt-3">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {winnerName && challenge.status === 'result_reported' && (
          <p className="mt-3 text-sm text-stone-600">Reported winner: {winnerName}</p>
        )}
        {challenge.status === 'completed' && (
          <p className="mt-3 text-sm font-semibold">
            {winnerName === 'You' ? '🏆 You won!' : `${them.displayName} won.`}
          </p>
        )}
      </Card>

      {can.size > 0 && (
        <Card className="space-y-3">
          <ErrorText error={act.error} />
          {countering ? (
            <form onSubmit={submitCounter} className="space-y-2">
              <label htmlFor="counter-prize" className="block text-sm font-medium">
                Your counteroffer
              </label>
              <input
                id="counter-prize"
                autoFocus
                required
                maxLength={MAX_PRIZE_LENGTH}
                value={counterPrize}
                onChange={(e) => setCounterPrize(e.target.value)}
                className="w-full rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-stone-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={act.isPending || !counterPrize.trim()}>
                  Send counteroffer
                </Button>
                <Button variant="ghost" onClick={() => setCountering(false)}>
                  Back
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {can.has('accept') && (
                <Button disabled={act.isPending} onClick={() => act.mutate({ type: 'accept' })}>
                  Accept
                </Button>
              )}
              {can.has('counter') && (
                <Button
                  variant="secondary"
                  disabled={act.isPending}
                  onClick={() => {
                    setCounterPrize(challenge.prize);
                    setCountering(true);
                  }}
                >
                  Counteroffer
                </Button>
              )}
              {can.has('decline') && (
                <Button
                  variant="danger"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ type: 'decline' })}
                >
                  Decline
                </Button>
              )}
              {can.has('cancel') && (
                <Button
                  variant="danger"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ type: 'cancel' })}
                >
                  Withdraw challenge
                </Button>
              )}
              {can.has('report') && (
                <>
                  <p className="w-full text-sm text-stone-600">
                    Round finished? Report the result:
                  </p>
                  <Button
                    disabled={act.isPending}
                    onClick={() => act.mutate({ type: 'report', winnerId: me.id })}
                  >
                    I won
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ type: 'report', winnerId: them.id })}
                  >
                    {them.displayName} won
                  </Button>
                </>
              )}
              {can.has('confirm') && (
                <Button disabled={act.isPending} onClick={() => act.mutate({ type: 'confirm' })}>
                  Confirm result
                </Button>
              )}
              {can.has('dispute') && (
                <Button
                  variant="danger"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ type: 'dispute' })}
                >
                  Dispute
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {challenge.events && challenge.events.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-bold">Timeline</h2>
          <ol className="space-y-2 text-sm">
            {challenge.events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>
                  <strong>{e.actorId === me.id ? 'You' : e.actorName}</strong>{' '}
                  {EVENT_TEXT[e.type] ?? e.type}
                  {e.prize && e.type === 'counter' ? `: “${e.prize}”` : ''}
                </span>
                <time className="shrink-0 text-xs text-stone-500" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
