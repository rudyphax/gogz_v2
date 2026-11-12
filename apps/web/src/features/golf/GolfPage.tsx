import { useState, type FormEvent } from 'react';
import { MAX_PRIZE_LENGTH, type ChallengeDto, type Friend } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation, useChallenges, useFriends, useMe } from '../../api/hooks';
import { Avatar } from '../../components/Avatar';
import { Button, Card, Empty, ErrorText, Loading, PageHeader } from '../../components/ui';
import { ChallengeCard } from './ChallengeCard';
import { groupOf, type Group } from './status';

const GROUPS: { key: Group; title: string }[] = [
  { key: 'yourMove', title: 'Your move' },
  { key: 'live', title: 'Matches on' },
  { key: 'waiting', title: 'Waiting on them' },
  { key: 'history', title: 'History' },
];

function ChallengeForm({ friend, onDone }: { friend: Friend; onDone: (sent: boolean) => void }) {
  const [prize, setPrize] = useState('');
  const send = useApiMutation(
    (body: { opponentId: string; prize: string }) =>
      api<ChallengeDto>('/golf/challenges', { method: 'POST', body }),
    [keys.challenges],
    () => onDone(true),
  );
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send.mutate({ opponentId: friend.id, prize });
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      <label htmlFor={`prize-${friend.id}`} className="block text-sm font-medium text-stone-700">
        What's on the line?
      </label>
      <input
        id={`prize-${friend.id}`}
        autoFocus
        required
        maxLength={MAX_PRIZE_LENGTH}
        value={prize}
        onChange={(e) => setPrize(e.target.value)}
        placeholder="Loser buys lunch, $20, carries the bag…"
        className="w-full rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-stone-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
      />
      <ErrorText error={send.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={send.isPending || !prize.trim()}>
          {send.isPending ? 'Sending…' : `Send challenge`}
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-stone-500">
        {friend.displayName} gets a text with a link to respond.
      </p>
    </form>
  );
}

export function GolfPage() {
  const { data: me } = useMe();
  const friends = useFriends();
  const challenges = useChallenges();
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!me) return null;
  const grouped = new Map<Group, ChallengeDto[]>();
  for (const c of challenges.data ?? []) {
    const g = groupOf(c, me.id);
    grouped.set(g, [...(grouped.get(g) ?? []), c]);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      <section>
        <PageHeader title="Golf" subtitle="Pick a friend and put something on the line." />
        {notice && (
          <p role="status" className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {notice}
          </p>
        )}
        {friends.isPending ? (
          <Loading />
        ) : friends.error ? (
          <ErrorText error={friends.error} />
        ) : friends.data.length === 0 ? (
          <Empty>No friends yet. Once the crew signs in, they'll show up here.</Empty>
        ) : (
          <ul className="space-y-2" aria-label="Friends">
            {friends.data.map((f) => (
              <li key={f.id}>
                <Card className="!p-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    aria-expanded={selected === f.id}
                    onClick={() => {
                      setNotice(null);
                      setSelected(selected === f.id ? null : f.id);
                    }}
                  >
                    <Avatar name={f.displayName} url={f.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{f.displayName}</span>
                      <span className="block truncate text-xs text-stone-500">
                        {f.firstName} {f.lastName}
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className="block text-sm font-bold tabular-nums"
                        aria-label={`Record ${f.record.wins} wins ${f.record.losses} losses`}
                      >
                        {f.record.wins}–{f.record.losses}
                      </span>
                      <span className="block text-[11px] text-stone-500">your record</span>
                    </span>
                  </button>
                  {selected === f.id && (
                    <ChallengeForm
                      friend={f}
                      onDone={(sent) => {
                        setSelected(null);
                        if (sent) setNotice(`Challenge sent to ${f.displayName}.`);
                      }}
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Challenges" className="space-y-5 md:pt-14">
        {challenges.isPending ? (
          <Loading />
        ) : challenges.error ? (
          <ErrorText error={challenges.error} />
        ) : challenges.data.length === 0 ? (
          <Empty>No challenges yet. Tap a friend to send one.</Empty>
        ) : (
          GROUPS.filter((g) => grouped.get(g.key)?.length).map((g) => (
            <div key={g.key}>
              <h2 className="mb-2 text-xs font-bold tracking-wide text-stone-500 uppercase">
                {g.title} ({grouped.get(g.key)!.length})
              </h2>
              <div className="space-y-2">
                {grouped.get(g.key)!.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} meId={me.id} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
