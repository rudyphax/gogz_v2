import { put } from '@vercel/blob';

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export interface AvatarStorage {
  save(userId: string, contentType: string, data: Buffer): Promise<string>;
}

/** Production: Vercel Blob. */
export class BlobAvatarStorage implements AvatarStorage {
  constructor(private readonly token: string) {}
  async save(userId: string, contentType: string, data: Buffer): Promise<string> {
    const ext = contentType.split('/')[1];
    const blob = await put(`avatars/${userId}.${ext}`, data, {
      access: 'public',
      contentType,
      token: this.token,
      addRandomSuffix: true,
    });
    return blob.url;
  }
}

/** Local dev and tests: store the image inline as a data URL. */
export class InlineAvatarStorage implements AvatarStorage {
  save(_userId: string, contentType: string, data: Buffer): Promise<string> {
    return Promise.resolve(`data:${contentType};base64,${data.toString('base64')}`);
  }
}
