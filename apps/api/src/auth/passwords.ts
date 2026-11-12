import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash used when the user doesn't exist, so response timing doesn't reveal it. */
let dummyHash: Promise<string> | null = null;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword('not-a-real-password');
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
