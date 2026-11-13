import type { ReactNode } from 'react';
import { cx } from './ui';

/**
 * Duotone icons on a 24px grid: white line work (currentColor) with a cyan
 * accent shape, so they read like the neon-on-navy style of the logo.
 */
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('h-5 w-5 shrink-0 overflow-visible', className)}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };
/** Accent fill: a translucent cyan shape behind or inside the line work. */
const accent = 'fill-brand-400/35 stroke-brand-300';

export const HomeIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v10.5h13V9" />
    <path className={accent} d="M10 19.5v-5.5h4v5.5z" />
  </Icon>
);

export const GolfIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M7 20.5V3.5" />
    <path className={accent} d="M7 3.5 17 7l-10 3.5z" />
    <ellipse cx="11" cy="20.5" rx="7.5" ry="1.5" />
    <circle className="fill-white stroke-none" cx="15.5" cy="17" r="1.6" />
  </Icon>
);

export const DumbbellIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M8 12h8" />
    <rect className={accent} x="4.5" y="6.5" width="3.5" height="11" rx="1.2" />
    <rect className={accent} x="16" y="6.5" width="3.5" height="11" rx="1.2" />
    <path d="M2.5 9.5v5M21.5 9.5v5" />
  </Icon>
);

export const ProgressIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3.5 20.5h17" />
    <rect className={accent} x="5" y="13" width="3" height="5" rx="0.8" />
    <rect className={accent} x="10.5" y="10" width="3" height="8" rx="0.8" />
    <rect className={accent} x="16" y="6.5" width="3" height="11.5" rx="0.8" />
    <path d="m4.5 9.5 5-4 4 2.5 6-4.5M16.5 3.5h3v3" />
  </Icon>
);

export const UsersIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="16.5" cy="8" r="3" />
    <path d="M14.5 14.2c3.6-.8 6.6.9 7 5.3" />
    <circle className={accent} cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20.5c.5-4 3.2-6 6.5-6s6 2 6.5 6" />
  </Icon>
);

export const ActivityIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path className="stroke-brand-300" d="M2.5 12h4l2.5-6.5 5 13 2.5-6.5h5" />
  </Icon>
);

export const TrophyIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path className={accent} d="M7.5 3.5h9V9a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 5.5h-3a3.5 3.5 0 0 0 3.6 4.4M16.5 5.5h3a3.5 3.5 0 0 1-3.6 4.4" />
    <path d="M12 13.5v3.5M8.5 20.5h7l-.8-3.5H9.3z" />
  </Icon>
);

export const SearchIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Icon>
);

export const BellIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 21h4" />
  </Icon>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <Icon className={cx('h-4 w-4', className)}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <Icon className={cx('h-4 w-4', className)}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <Icon className={cx('h-4 w-4', className)}>
    <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />
  </Icon>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const UserIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle className={accent} cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.7-4 3.7-6.5 7.5-6.5s6.8 2.5 7.5 6.5" />
  </Icon>
);

export const LogoutIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="m9.5 16.5-4.5-4.5 4.5-4.5M5 12h10" />
  </Icon>
);

export const StarIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path
      className={accent}
      d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
    />
  </Icon>
);

export const FlameIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path
      className="fill-orange-400/80 stroke-orange-300"
      d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.5 2.6-5.3 3.6-8.8 1.9 1.4 2.4 3.3 2.4 4.6 1-1 1.6-2.6 1.5-4.6 3.1 2 5.5 5.2 5.5 8.8 0 3.6-2.6 6.2-6.5 6.2z"
    />
  </Icon>
);

export const PlayIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path className="fill-white" d="m10 8.5 5.5 3.5-5.5 3.5z" />
  </Icon>
);
