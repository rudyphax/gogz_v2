import type { Me } from '@gogz/shared';
import type { User } from './db/schema.js';

export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    phone: user.phone,
    smsOptIn: user.smsOptIn,
    avatarUrl: user.avatarUrl,
    role: user.role,
    hasPassword: user.passwordHash !== null,
  };
}

export const publicUser = (u: Pick<User, 'id' | 'displayName' | 'avatarUrl'>) => ({
  id: u.id,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
});
