import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import type { Me } from '@gogz/shared';
import { api } from '../api/client';
import { Avatar } from './Avatar';
import { cx } from './ui';

const tab = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
    isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white',
  );

export function Layout({ me }: { me: Me }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    await navigate('/login');
  }

  return (
    <div className="min-h-dvh">
      {me.role === 'demo' && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
          You're exploring the demo account with sample data. Texts are never sent, and the data
          resets nightly.
        </div>
      )}
      <header className="bg-brand-900 text-white">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3 sm:gap-2"
        >
          <span className="mr-2 text-lg font-black tracking-tight sm:mr-4">GOGZ</span>
          <NavLink to="/golf" className={tab}>
            Golf
          </NavLink>
          <NavLink to="/gym" className={tab}>
            Gym
          </NavLink>
          {me.role === 'admin' && (
            <NavLink to="/admin/members" className={tab}>
              Members
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-2">
            <NavLink
              to="/profile"
              aria-label="Profile"
              className="rounded-full ring-2 ring-transparent hover:ring-white/40"
            >
              <Avatar name={me.displayName} url={me.avatarUrl} size={32} />
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-2 py-1 text-xs text-brand-100 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
