import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { ProfilePage } from './ProfilePage';

describe('ProfilePage', () => {
  it('saves details and shows the normalized phone number', async () => {
    let patched: unknown;
    server.use(
      http.get('/api/me', () => HttpResponse.json(ME)),
      http.patch('/api/profile', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({
          ...ME,
          displayName: 'Big Rudy',
          phone: '+15551234567',
          smsOptIn: true,
        });
      }),
    );
    const user = userEvent.setup();
    renderAt(<ProfilePage />);
    const sms = await screen.findByRole('checkbox');
    expect(sms).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();

    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), 'Big Rudy');
    await user.type(screen.getByLabelText('Mobile number'), '555 123 4567');
    await user.click(sms);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(patched).toEqual({
      firstName: 'Rudy',
      lastName: 'P',
      displayName: 'Big Rudy',
      phone: '555 123 4567',
      smsOptIn: true,
    });
    expect(screen.getByLabelText('Mobile number')).toHaveValue('+15551234567');
  });

  it('sets a password', async () => {
    let body: unknown;
    server.use(
      http.get('/api/me', () => HttpResponse.json(ME)),
      http.put('/api/profile/password', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAt(<ProfilePage />);
    await user.type(await screen.findByLabelText('New password'), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Password saved')).toBeInTheDocument();
    expect(body).toEqual({ newPassword: 'a-long-password' });
    await waitFor(() => expect(screen.getByLabelText('Current password')).toBeInTheDocument());
  });

  it('uploads a profile picture', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json(ME)),
      http.put('/api/profile/avatar', () =>
        HttpResponse.json({ ...ME, avatarUrl: 'https://blob.test/a.png' }),
      ),
    );
    const user = userEvent.setup();
    const { container } = renderAt(<ProfilePage />);
    const file = new File(['png'], 'me.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Profile picture'), file);
    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://blob.test/a.png'),
    );
  });

  it('is read-only for the demo account', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json({ ...ME, role: 'demo' })));
    renderAt(<ProfilePage />);
    expect(await screen.findByText(/turned off for the demo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});
