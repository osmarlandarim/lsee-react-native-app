import { getAuthBaseUrl, getStoredAccessToken } from '@/services/auth';

type ApiRequestInit = RequestInit & {
  headers?: Record<string, string>;
};

function withJsonHeader(headers: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json',
    ...headers,
  };
}

export async function apiFetch(path: string, init: ApiRequestInit = {}) {
  const headers = withJsonHeader(init.headers);

  return fetch(`${getAuthBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

export async function apiFetchAuth(path: string, init: ApiRequestInit = {}) {
  const accessToken = await getStoredAccessToken();

  if (!accessToken) {
    throw new Error('Usuário não autenticado.');
  }

  const headers = withJsonHeader({
    ...init.headers,
    Authorization: `Bearer ${accessToken}`,
  });

  return fetch(`${getAuthBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}