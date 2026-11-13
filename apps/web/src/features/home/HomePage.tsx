import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Friend } from '@gogz/shared';
import { useChallenges, useFriends, useMe, usePlans, useSessions } from '../../api/hooks';
import { Avatar } from '../../components/Avatar';
import {
  ActivityIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  DumbbellIcon,
  FlameIcon,
  GolfIcon,
  PlayIcon,
  PlusIcon,
  ProgressIcon,
  StarIcon,
  TrophyIcon,
  UsersIcon,
} from '../../components/icons';
import { cx } from '../../components/ui';
import { opponentOf } from '../golf/status';
import { featuredChallenge, golfSummary, greeting, gymWeek } from './stats';

const tile =
  'relative overflow-hidden rounded-2xl bg-gradient-to-b from-panel-2/80 to-panel ring-1 ring-line shadow-lg shadow-black/30';

function TileTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
      <span className="text-brand-300">{icon}</span>
      {children}
    </h2>
  );
}

function Hero({ name, onLogRound }: { name: string; onLogRound: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl ring-1 ring-line">
      <img
        src="/images/hero.webp"
        alt=""
        className="absolute inset-y-0 right-0 h-full w-full object-cover object-right sm:w-[75%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-night-950 via-night-950/85 to-night-950/10 sm:via-night-950/70"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-night-950/90 to-transparent"
      />

      <div className="relative px-5 pt-8 pb-5 sm:px-8 sm:pt-10">
        <h1 className="heading-display text-3xl text-white drop-shadow sm:text-5xl">
          {greeting(new Date())}, {name}!
        </h1>
        <p className="mt-2 text-sm text-ink-soft italic sm:text-lg">
          Golf. Gym. Challenges. Friends. All in one place.
        </p>
        <span
          aria-hidden
          className="mt-3 block h-0.5 w-28 rounded-full bg-gradient-to-r from-brand-400 to-transparent"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Quick actions" role="group">
          <Link
            to="/golf"
            className="flex items-center justify-center gap-3 rounded-xl bg-brand-400 px-4 py-3.5 text-[15px] font-bold text-night-950 shadow-[0_0_30px_-6px_rgb(34_211_238/0.9)] transition hover:bg-brand-300"
          >
            <TrophyIcon className="h-6 w-6 [&_*]:!stroke-night-950" />
            New Challenge
          </Link>
          <button
            type="button"
            onClick={onLogRound}
            className="flex items-center justify-center gap-3 rounded-xl bg-night-900/70 px-4 py-3.5 text-[15px] font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:ring-brand-400/60"
          >
            <GolfIcon className="h-6 w-6" />
            Log Golf Round
          </button>
          <Link
            to="/gym"
            className="flex items-center justify-center gap-3 rounded-xl bg-night-900/70 px-4 py-3.5 text-[15px] font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:ring-brand-400/60"
          >
            <DumbbellIcon className="h-6 w-6" />
            Log Workout
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChallengeTile() {
  const { data: me } = useMe();
  const { data: challenges = [] } = useChallenges();
  const featured = me ? featuredChallenge(challenges, me.id) : null;
  const them = featured && me ? opponentOf(featured, me.id) : null;

  return (
    <section className={cx(tile, 'min-h-60')} aria-label="Golf challenge">
      <img
        src="/images/challenge-ball.webp"
        alt=""
        className="absolute inset-y-0 right-0 h-full w-3/5 object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-transparent"
      />
      <div className="relative flex h-full flex-col p-5">
        <TileTitle icon={<TrophyIcon />}>
          <span className="text-brand-300">Golf Challenge</span>
        </TileTitle>
        {featured && them ? (
          <>
            <p className="heading-display mt-4 line-clamp-2 max-w-[65%] text-2xl text-white">
              {featured.prize}
            </p>
            <p className="mt-1 text-sm text-ink-soft">vs. {them.displayName}</p>
            <div className="mt-3">
              <Avatar name={them.displayName} url={them.avatarUrl} size={34} />
            </div>
            <Link
              to={`/golf/challenges/${featured.id}`}
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-night-950 hover:bg-brand-300"
            >
              View Challenge <ArrowRightIcon />
            </Link>
          </>
        ) : (
          <>
            <p className="heading-display mt-4 max-w-[65%] text-2xl text-white">
              Nothing on the line
            </p>
            <p className="mt-1 text-sm text-ink-soft">Call out a friend for this weekend.</p>
            <Link
              to="/golf"
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-night-950 hover:bg-brand-300"
            >
              Start one <ArrowRightIcon />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-1.5 rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 shadow-[0_0_10px_rgb(34_211_238/0.6)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function WeekTile({ workouts, target }: { workouts: number; target: number }) {
  return (
    <section className={cx(tile, 'p-5')} aria-label="This week's activity">
      <TileTitle icon={<ProgressIcon />}>This Week's Activity</TileTitle>
      <div className="mt-5 space-y-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-line">
            <GolfIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-white">Golf</span>
              <span className="text-muted">Round logging soon</span>
            </div>
            <p className="text-sm text-brand-300">0 rounds</p>
            <Meter value={0} max={2} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-line">
            <DumbbellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-white">Gym</span>
              <span className="text-muted">Goal {target}/week</span>
            </div>
            <p className="text-sm text-brand-300">
              {workouts} workout{workouts === 1 ? '' : 's'}
            </p>
            <Meter value={workouts} max={target} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-2 text-sm">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="font-bold text-white tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GolfTile({ wins, losses, open }: { wins: number; losses: number; open: number }) {
  return (
    <section className={cx(tile, 'grid grid-cols-[1fr_1.2fr]')} aria-label="Golf stats">
      <div className="relative p-5">
        <img
          src="/images/tile-golf.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-night-950/80 to-night-950/40"
        />
        <div className="relative">
          <TileTitle icon={<GolfIcon />}>Golf</TileTitle>
          <p className="heading-display mt-5 text-4xl text-white tabular-nums">
            {wins}–{losses}
          </p>
          <p className="text-sm text-ink-soft">Challenge record</p>
        </div>
      </div>
      <div className="p-4">
        <StatRows
          rows={[
            ['Open challenges', open],
            ['Rounds (30d)', '—'],
            ['Best score', '—'],
          ]}
        />
      </div>
    </section>
  );
}

function GymTile({
  workouts,
  target,
  sets,
  streak,
}: {
  workouts: number;
  target: number;
  sets: number;
  streak: number;
}) {
  const pct = target ? Math.min(1, workouts / target) : 0;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  return (
    <section className={cx(tile, 'grid grid-cols-[1fr_1.2fr]')} aria-label="Gym stats">
      <div className="relative p-5">
        <img
          src="/images/tile-gym.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-night-950/85 to-night-950/40"
        />
        <div className="relative">
          <TileTitle icon={<DumbbellIcon />}>Gym</TileTitle>
          <div className="mt-3 flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${circumference * pct} ${circumference}`}
                style={{ filter: 'drop-shadow(0 0 4px rgb(34 211 238))' }}
              />
            </svg>
            <div>
              <p className="heading-display text-3xl text-white tabular-nums">
                {workouts}/{target}
              </p>
              <p className="text-xs text-ink-soft">This week</p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <StatRows
          rows={[
            ['Sets this week', sets],
            ['Avg. workout', '—'],
            [
              'Streak',
              <span key="s" className="inline-flex items-center gap-1">
                <FlameIcon className="h-4 w-4" />
                {streak} week{streak === 1 ? '' : 's'}
              </span>,
            ],
          ]}
        />
      </div>
    </section>
  );
}

const HIGHLIGHTS = [
  { img: 'highlight-swing', title: 'Swing Analysis', meta: 'Driver · Nov 10', video: true },
  { img: 'highlight-score', title: 'New Best Score!', meta: 'Eagle Valley · Nov 8' },
  { img: 'highlight-pr', title: 'Bench Press PR', meta: '185 lb · Nov 6' },
  { img: 'highlight-crew', title: 'Weekend Crew Round', meta: 'The Crew · Nov 4' },
];

function Highlights() {
  return (
    <section className={cx(tile, 'p-5')} aria-label="Recent highlights">
      <div className="flex items-center justify-between">
        <TileTitle icon={<StarIcon />}>Recent Highlights</TileTitle>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-line">
          Sample
        </span>
      </div>
      <ul className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
        {HIGHLIGHTS.map((h) => (
          <li
            key={h.img}
            className="group relative h-36 w-56 shrink-0 snap-start overflow-hidden rounded-xl ring-1 ring-line"
          >
            <img
              src={`/images/${h.img}.webp`}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/30 to-transparent"
            />
            {h.video && (
              <PlayIcon className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg" />
            )}
            <div className="absolute inset-x-3 bottom-2.5">
              <p className="text-sm font-bold text-white">{h.title}</p>
              <p className="text-xs text-ink-soft">{h.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FEED = [
  { verb: 'completed a workout', detail: 'Upper Body Strength', when: '52m ago', icon: 'gym' },
  { verb: 'posted a golf round', detail: '83 at Eagle Valley', when: '2h ago', icon: 'golf' },
  { verb: 'accepted your challenge', detail: 'Weekend Match Play', when: '4h ago', icon: 'trophy' },
  { verb: 'added a swing video', detail: 'Driver', when: '5h ago', icon: 'play' },
] as const;

const FEED_ICONS = {
  gym: <DumbbellIcon className="h-4 w-4" />,
  golf: <GolfIcon className="h-4 w-4" />,
  trophy: <TrophyIcon className="h-4 w-4" />,
  play: <PlayIcon className="h-4 w-4" />,
};

function CrewPanel({ friends, isAdmin }: { friends: Friend[]; isAdmin: boolean }) {
  const shown = friends.slice(0, 5);
  // Placeholder feed until activity is tracked: sample events attributed to real friends.
  const names = friends.length ? friends.map((f) => f.displayName) : ['Jordan', 'Marcus', 'Sam'];
  return (
    <aside className={cx(tile, 'flex flex-col p-5')} aria-label="The crew">
      <Link to="/golf" className="group flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-line">
          <UsersIcon className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold text-white">The Crew</span>
          <span className="block text-sm text-muted">{friends.length + 1} members</span>
        </span>
        <ChevronRightIcon className="text-muted transition group-hover:translate-x-0.5 group-hover:text-white" />
      </Link>
      <ul className="mt-4 flex items-center gap-2" aria-label="Crew members">
        {shown.map((f) => (
          <li key={f.id} title={f.displayName} className="rounded-full ring-2 ring-white/15">
            <Avatar name={f.displayName} url={f.avatarUrl} size={44} />
          </li>
        ))}
        {isAdmin && (
          <li>
            <Link
              to="/admin/members"
              aria-label="Invite a member"
              className="grid h-11 w-11 place-items-center rounded-full text-white ring-1 ring-white/20 transition hover:bg-white/10 hover:ring-brand-400/60"
            >
              <PlusIcon />
            </Link>
          </li>
        )}
      </ul>

      <div className="my-5 h-px bg-line" />

      <TileTitle icon={<ActivityIcon className="h-6 w-6" />}>Activity Feed</TileTitle>
      <ul className="mt-3 flex-1 divide-y divide-white/5" aria-label="Activity feed">
        {FEED.map((item, i) => {
          const name = names[i % names.length]!;
          return (
            <li key={item.verb} className="flex gap-3 py-3">
              <Avatar
                name={name}
                url={friends[i % (friends.length || 1)]?.avatarUrl ?? null}
                size={40}
              />
              <div className="min-w-0">
                <p className="text-sm text-white">
                  <strong className="font-bold">{name}</strong> {item.verb}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                  <span className="text-brand-300">{FEED_ICONS[item.icon]}</span>
                  {item.detail} · {item.when}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        to="/golf"
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-brand-400/40 transition hover:bg-brand-400/10 hover:ring-brand-400"
      >
        View All Activity <ArrowRightIcon className="text-brand-300" />
      </Link>
    </aside>
  );
}

export function HomePage() {
  const { data: me } = useMe();
  const { data: friends = [] } = useFriends();
  const { data: challenges = [] } = useChallenges();
  const { data: sessions = [] } = useSessions();
  const { data: plans = [] } = usePlans();
  const [notice, setNotice] = useState<string | null>(null);
  if (!me) return null;

  const golf = golfSummary(friends, challenges, me.id);
  const gym = gymWeek(sessions, new Date());
  const target = plans.find((p) => p.isActive)?.daysPerWeek ?? 3;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Hero
          name={me.firstName || me.displayName}
          onLogRound={() => setNotice('Round logging is coming soon. For now, challenge a friend!')}
        />
        {notice && (
          <p
            role="status"
            className="rounded-xl bg-brand-400/10 px-4 py-2.5 text-sm text-brand-200 ring-1 ring-brand-400/30"
          >
            {notice}
          </p>
        )}
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <ChallengeTile />
          <WeekTile workouts={gym.workouts} target={target} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <GolfTile {...golf} />
          <GymTile workouts={gym.workouts} target={target} sets={gym.sets} streak={gym.streak} />
        </div>
        <Highlights />
      </div>
      <CrewPanel friends={friends} isAdmin={me.role === 'admin'} />
    </div>
  );
}
