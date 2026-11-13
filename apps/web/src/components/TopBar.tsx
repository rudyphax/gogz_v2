import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router';
import type { Me } from '@gogz/shared';
import { api } from '../api/client';
import { useChallenges } from '../api/hooks';
import { describeStatus, opponentOf } from '../features/golf/status';
import { Avatar } from './Avatar';
import { BellIcon, ChevronDownIcon, LogoutIcon, SearchIcon, UserIcon } from './icons';
import { cx } from './ui';

type Panel = 'search' | 'alerts' | 'account' | null;

const iconButton =
  'relative grid h-10 w-10 place-items-center rounded-full bg-night-900/60 text-white ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10 hover:ring-brand-400/50';

function Popover({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      aria-label={label}
      className="absolute top-12 right-0 z-40 w-72 overflow-hidden rounded-2xl bg-panel/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-line-strong backdrop-blur"
    >
      {children}
    </div>
  );
}

export function TopBar({ me }: { me: Me }) {
  const [open, setOpen] = useState<Panel>(null);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const challenges = useChallenges();
  const yourMove = (challenges.data ?? []).filter((c) => c.turnUserId === me.id);

  // Close menus when navigating, clicking elsewhere, or pressing Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
  }
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (p: Panel) => setOpen((cur) => (cur === p ? null : p));

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    await navigate('/login');
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        aria-label="Search"
        aria-expanded={open === 'search'}
        className={iconButton}
        onClick={() => toggle('search')}
      >
        <SearchIcon />
      </button>

      <button
        type="button"
        aria-label={
          yourMove.length ? `Notifications (${yourMove.length} need you)` : 'Notifications'
        }
        aria-expanded={open === 'alerts'}
        className={iconButton}
        onClick={() => toggle('alerts')}
      >
        <BellIcon />
        {yourMove.length > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-brand-400 shadow-[0_0_8px_rgb(34_211_238)] ring-2 ring-night-900" />
        )}
      </button>

      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open === 'account'}
        onClick={() => toggle('account')}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1 text-white transition hover:bg-white/10"
      >
        <span className="rounded-full ring-2 ring-brand-400/70">
          <Avatar name={me.displayName} url={me.avatarUrl} size={36} />
        </span>
        <ChevronDownIcon
          className={cx('transition', open === 'account' && 'rotate-180 text-brand-300')}
        />
      </button>

      {open === 'search' && (
        <Popover label="Search">
          <label htmlFor="global-search" className="sr-only">
            Search
          </label>
          <input
            id="global-search"
            autoFocus
            disabled
            placeholder="Search is coming soon…"
            className="w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-line-strong"
          />
          <p className="px-2 pt-2 pb-1 text-xs text-faint">
            Find friends, challenges and workouts from one place.
          </p>
        </Popover>
      )}

      {open === 'alerts' && (
        <Popover label="Notifications">
          <p className="px-2 pt-1 pb-2 text-xs font-bold tracking-wider text-faint uppercase">
            Needs your move
          </p>
          {yourMove.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-muted">You're all caught up.</p>
          ) : (
            <ul>
              {yourMove.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/golf/challenges/${c.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
                  >
                    <Avatar
                      name={opponentOf(c, me.id).displayName}
                      url={opponentOf(c, me.id).avatarUrl}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {opponentOf(c, me.id).displayName}: {describeStatus(c, me.id).label}
                      </span>
                      <span className="block truncate text-xs text-muted">{c.prize}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      )}

      {open === 'account' && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute top-12 right-0 z-40 w-60 rounded-2xl bg-panel/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-line-strong backdrop-blur"
        >
          <div className="mb-1 border-b border-line px-3 pt-1 pb-3">
            <p className="truncate text-sm font-semibold text-white">{me.displayName}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white hover:bg-white/5"
          >
            <UserIcon />
            Profile settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white hover:bg-white/5"
          >
            <LogoutIcon />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
