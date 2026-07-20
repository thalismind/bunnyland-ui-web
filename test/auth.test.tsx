import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { JSX } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setPlayerAuth } from '../src/api';
import {
  AuthGate,
  AuthProvider,
  hasAuthScopes,
  useAuth,
  type AuthScope,
} from '../src/preact';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function session(scopes: AuthScope[] = ['world:play']): Record<string, unknown> {
  return {
    subject: 'player',
    scopes,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    rotate_after: null,
    rotation_eligible: false,
  };
}

afterEach(() => {
  cleanup();
  setPlayerAuth('');
  vi.restoreAllMocks();
});

describe('shared authentication gate', () => {
  it('applies the same scope implications as the server', () => {
    expect(hasAuthScopes(['world:play'], ['character:profile', 'character:chat'])).toBe(true);
    expect(hasAuthScopes(['world:admin'], ['world:play', 'character:profile'])).toBe(true);
    expect(hasAuthScopes(['character:profile'], ['character:chat'])).toBe(false);
  });

  it('renders children only after the session has every required scope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(session(['world:play']))));
    render(
      <AuthProvider base="/api/v1">
        <AuthGate scopes={['character:profile', 'character:chat']}>
          <div>Private character tools</div>
        </AuthGate>
      </AuthProvider>,
    );

    expect(screen.getByText('Checking access…')).toBeTruthy();
    expect(await screen.findByText('Private character tools')).toBeTruthy();
  });

  it('opens a login modal with requested scope details and reports login errors', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ detail: 'invalid username or password' }, 401);
      return jsonResponse({ detail: 'bearer token required' }, 401);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider base="/api/v1">
        <AuthGate scopes={['character:chat']}><div>Chat</div></AuthGate>
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Login' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Character chat \(character:chat\)/)).toBeTruthy();
    fireEvent.input(screen.getByLabelText('Username'), { target: { value: 'player' } });
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain('invalid username or password');
  });

  it('closes the modal and renders children after a successful login', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (
      init?.method === 'POST'
        ? jsonResponse(session(['character:profile']))
        : jsonResponse({ detail: 'bearer token required' }, 401)
    ));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthProvider base="/api/v1">
        <AuthGate scopes={['character:profile']}><div>Character profile</div></AuthGate>
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Login' }));
    fireEvent.input(screen.getByLabelText('Username'), { target: { value: 'player' } });
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'correct' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(await screen.findByText('Character profile')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the missing scope and allows another login for an authenticated account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(session(['character:profile']))));
    render(
      <AuthProvider base="/api/v1">
        <AuthGate scopes={['world:admin']}><div>Admin tools</div></AuthGate>
      </AuthProvider>,
    );

    expect(await screen.findByText(/Insufficient access for player/)).toBeTruthy();
    expect(screen.getByText(/World administration \(world:admin\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as another user' }));
    expect(screen.getByText(/Requested access: World administration \(world:admin\)/)).toBeTruthy();
  });

  it('rechecks the session when the shared bearer credential changes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(session(['world:play'])));
    vi.stubGlobal('fetch', fetchMock);
    function RefreshCount(): JSX.Element {
      const auth = useAuth();
      return <div>{auth.status}</div>;
    }
    render(<AuthProvider base="/api/v1"><RefreshCount /></AuthProvider>);
    await screen.findByText('authenticated');

    setPlayerAuth('Bearer replacement');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
