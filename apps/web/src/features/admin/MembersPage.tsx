import { useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { keys, useApiMutation, useMe, useMembers } from '../../api/hooks';
import { Badge, Button, Card, ErrorText, Field, Loading, PageHeader } from '../../components/ui';

export function MembersPage() {
  const { data: me } = useMe();
  const members = useMembers();
  const [email, setEmail] = useState('');
  const add = useApiMutation(
    () => api('/admin/allowed-emails', { method: 'POST', body: { email } }),
    [keys.members],
    () => setEmail(''),
  );
  const remove = useApiMutation(
    (target: string) =>
      api(`/admin/allowed-emails/${encodeURIComponent(target)}`, { method: 'DELETE' }),
    [keys.members, keys.friends],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate(undefined);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Members"
        subtitle="Only these Google accounts can sign in. Nobody else can create an account."
      />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <Field
              id="invite-email"
              label="Invite by Gmail address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="buddy@gmail.com"
            />
          </div>
          <Button type="submit" disabled={add.isPending}>
            Add
          </Button>
        </form>
        <div className="mt-2">
          <ErrorText error={add.error ?? remove.error} />
        </div>
      </Card>
      {members.isPending ? (
        <Loading />
      ) : members.error ? (
        <ErrorText error={members.error} />
      ) : (
        <ul
          className="divide-y divide-line rounded-xl bg-panel ring-1 ring-line"
          aria-label="Invited emails"
        >
          {members.data.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{m.email}</span>
              {m.role === 'admin' && <Badge tone="blue">Admin</Badge>}
              {m.registered ? <Badge tone="green">Joined</Badge> : <Badge>Invited</Badge>}
              {m.email !== me?.email && (
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs text-red-300"
                  onClick={() => {
                    if (confirm(`Remove ${m.email}? They'll be signed out and can't sign back in.`))
                      remove.mutate(m.email);
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
