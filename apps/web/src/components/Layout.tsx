import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import type { Me } from '@gogz/shared';
import { DumbbellIcon, GolfIcon, HomeIcon, ProgressIcon, UsersIcon } from './icons';
import { TopBar } from './TopBar';
import { cx } from './ui';

function NavItem({
  to,
  icon,
  children,
  active,
  sub,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  active: boolean;
  sub?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition lg:gap-3.5 lg:px-4 lg:py-3 lg:text-[15px]',
        sub && 'lg:ml-7 lg:py-2.5 lg:text-sm',
        active
          ? 'bg-gradient-to-r from-brand-400/30 via-brand-400/10 to-transparent text-white shadow-[0_0_24px_-8px_rgb(34_211_238/0.8)] ring-1 ring-brand-400/50'
          : 'text-white/85 hover:bg-white/5 hover:text-white',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2 -left-px hidden w-1 rounded-full bg-brand-400 shadow-[0_0_10px_rgb(34_211_238)] lg:block"
        />
      )}
      <span className={cx('transition', active && 'drop-shadow-[0_0_6px_rgb(34_211_238/0.8)]')}>
        {icon}
      </span>
      {children}
    </Link>
  );
}

const Logo = ({ className }: { className: string }) => (
  <Link to="/" aria-label="GOGZ home" className={cx('block w-fit', className)}>
    <img src="/logo.webp" alt="" className="h-8 w-auto lg:h-12" />
  </Link>
);

export function Layout({ me }: { me: Me }) {
  const { pathname } = useLocation();
  const onProgress = pathname.startsWith('/gym/progress');

  return (
    <div className="min-h-dvh">
      {/* Phones: sticky header with the menu strip under it. Desktop: fixed sidebar, controls top right. */}
      <div className="sticky top-0 z-30 lg:static">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-night-900/90 px-4 py-2.5 backdrop-blur lg:ml-64 lg:justify-end lg:border-0 lg:bg-transparent lg:px-10 lg:pt-5 lg:pb-0 lg:backdrop-blur-none">
          <Logo className="lg:hidden" />
          <TopBar me={me} />
        </header>

        <aside className="border-b border-line bg-night-900/90 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0 lg:bg-night-900/95 lg:px-4 lg:pt-7">
          <Logo className="hidden px-3 lg:block" />
          <nav
            aria-label="Main"
            className="flex gap-1 overflow-x-auto px-4 py-2 lg:mt-10 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0 lg:py-0"
          >
            <NavItem to="/" icon={<HomeIcon />} active={pathname === '/'}>
              Home
            </NavItem>
            <NavItem to="/golf" icon={<GolfIcon />} active={pathname.startsWith('/golf')}>
              Golf
            </NavItem>
            <span aria-hidden className="mx-3 my-2 hidden h-px bg-line lg:block" />
            <NavItem
              to="/gym"
              icon={<DumbbellIcon />}
              active={pathname.startsWith('/gym') && !onProgress}
            >
              Gym
            </NavItem>
            <NavItem to="/gym/progress" icon={<ProgressIcon />} active={onProgress} sub>
              Progress
            </NavItem>
            {me.role === 'admin' && (
              <>
                <span aria-hidden className="mx-3 my-2 hidden h-px bg-line lg:block" />
                <NavItem
                  to="/admin/members"
                  icon={<UsersIcon />}
                  active={pathname.startsWith('/admin')}
                >
                  Members
                </NavItem>
              </>
            )}
          </nav>
          <div
            aria-hidden
            className="pointer-events-none mt-auto hidden h-48 bg-gradient-to-t from-brand-500/10 to-transparent lg:-mx-4 lg:block"
          />
        </aside>
      </div>

      <div className="lg:pl-64">
        {me.role === 'demo' && (
          <div className="mx-4 mt-4 rounded-xl bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-200 ring-1 ring-amber-400/20 sm:mx-6 lg:mx-10">
            You're exploring the demo account with sample data. Texts are never sent, and the data
            resets nightly.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:pt-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
