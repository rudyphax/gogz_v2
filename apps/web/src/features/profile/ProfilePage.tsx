import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, type Me } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation, useMe } from '../../api/hooks';
import { Avatar } from '../../components/Avatar';
import { Button, Card, ErrorText, Field, PageHeader } from '../../components/ui';

const MAX_AVATAR_MB = 2;

function DetailsForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: me.firstName,
    lastName: me.lastName,
    displayName: me.displayName,
    email: me.email,
    phone: me.phone ?? '',
    smsOptIn: me.smsOptIn,
  });
  const [saved, setSaved] = useState(false);
  const isAdmin = me.role === 'admin';
  const save = useApiMutation(
    () =>
      api<Me>('/profile', {
        method: 'PATCH',
        body: { ...form, email: isAdmin ? form.email : undefined },
      }),
    [keys.friends],
    (updated) => {
      qc.setQueryData(keys.me, updated);
      setForm((f) => ({ ...f, phone: updated.phone ?? '', smsOptIn: updated.smsOptIn }));
      setSaved(true);
    },
  );
  const set = (patch: Partial<typeof form>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined);
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="firstName"
          label="First name"
          required
          value={form.firstName}
          onChange={(e) => set({ firstName: e.target.value })}
        />
        <Field
          id="lastName"
          label="Last name"
          value={form.lastName}
          onChange={(e) => set({ lastName: e.target.value })}
        />
      </div>
      <Field
        id="displayName"
        label="Display name"
        hint="What your friends see on challenges."
        required
        value={form.displayName}
        onChange={(e) => set({ displayName: e.target.value })}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        disabled={!isAdmin}
        hint={
          isAdmin
            ? 'Changing this also updates the invite list.'
            : 'Your email is your invite. Ask the admin to change it.'
        }
        value={form.email}
        onChange={(e) => set({ email: e.target.value })}
      />
      <Field
        id="phone"
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        placeholder="(555) 123-4567"
        value={form.phone}
        onChange={(e) => set({ phone: e.target.value })}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-brand-700"
          checked={form.smsOptIn}
          disabled={!form.phone.trim()}
          onChange={(e) => set({ smsOptIn: e.target.checked })}
        />
        <span>
          Text me when a friend challenges me or responds. Message & data rates may apply. Reply
          STOP to opt out.
        </span>
      </label>
      <ErrorText error={save.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          Save changes
        </Button>
        {saved && (
          <span role="status" className="text-sm text-brand-700">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function PasswordForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [done, setDone] = useState(false);
  const save = useApiMutation(
    () =>
      api('/profile/password', {
        method: 'PUT',
        body: { currentPassword: currentPassword || undefined, newPassword },
      }),
    [],
    () => {
      qc.setQueryData<Me>(keys.me, (m) => (m ? { ...m, hasPassword: true } : m));
      setCurrent('');
      setNew('');
      setDone(true);
    },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(false);
        save.mutate(undefined);
      }}
      className="space-y-4"
    >
      <p className="text-sm text-stone-600">
        {me.hasPassword
          ? 'Change the password you use to sign in without Google.'
          : 'Optional: set a password so you can also sign in with your email.'}
      </p>
      {me.hasPassword && (
        <Field
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <Field
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        value={newPassword}
        onChange={(e) => setNew(e.target.value)}
      />
      <ErrorText error={save.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {me.hasPassword ? 'Change password' : 'Set password'}
        </Button>
        {done && (
          <span role="status" className="text-sm text-brand-700">
            Password saved
          </span>
        )}
      </div>
    </form>
  );
}

function AvatarForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useApiMutation(
    (file: File) => api<Me>('/profile/avatar', { method: 'PUT', body: file }),
    [keys.friends],
    (m) => qc.setQueryData(keys.me, m),
  );
  const remove = useApiMutation(
    () => api<Me>('/profile/avatar', { method: 'DELETE' }),
    [keys.friends],
    (m) => qc.setQueryData(keys.me, m),
  );
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={me.displayName} url={me.avatarUrl} size={72} />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload photo'}
          </Button>
          {me.avatarUrl && (
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined)}
            >
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          aria-label="Profile picture"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
              setLocalError(`Pick an image under ${MAX_AVATAR_MB} MB.`);
              return;
            }
            setLocalError(null);
            upload.mutate(file);
          }}
        />
        <p className="text-xs text-stone-500">JPEG, PNG, WebP or GIF, up to {MAX_AVATAR_MB} MB.</p>
        <ErrorText error={localError ? new Error(localError) : (upload.error ?? remove.error)} />
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { data: me } = useMe();
  if (!me) return null;
  const demo = me.role === 'demo';
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Profile" subtitle={me.email} />
      {demo ? (
        <Card>
          <p className="text-sm text-stone-600">
            Profile editing is turned off for the demo account.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 font-bold">Photo</h2>
            <AvatarForm me={me} />
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">Details</h2>
            <DetailsForm me={me} />
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">Password</h2>
            <PasswordForm me={me} />
          </Card>
        </>
      )}
    </div>
  );
}
