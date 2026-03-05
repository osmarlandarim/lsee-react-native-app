import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Fallback para SecureStore no web usando localStorage
const isWeb = Platform.OS === 'web';
const localStore = {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  async deleteItemAsync(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

type ApiProfile = {
  usuarioId: string;
  googleId?: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
  fotoCapa?: string | null;
};

export type AuthSession = {
  accessToken: string;
  profile: ApiProfile;
};

export const AUTH_SESSION_KEY = 'lsee.auth_session';
let memorySessionFallback: AuthSession | null = null;

function reportSecureStoreError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[auth] SecureStore ${operation} failed: ${message}`);
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    return trimmed;
  }

  let normalized = trimmed
    .replace(/^htt:\/\//i, 'http://')
    .replace(/^https:\/\/\//i, 'https://')
    .replace(/:\/\/(.+?):333(?=\/|$)/i, '://$1:3333');

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  return normalized.replace(/\/$/, '');
}

function getHostFromExpo() {
  const fromExpoConfig = Constants.expoConfig?.hostUri;

  if (fromExpoConfig) {
    return fromExpoConfig.split(':')[0];
  }

  return null;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, any>;
  } catch {
    return null;
  }
}

function normalizeApiProfile(profile: any): ApiProfile {
  return {
    usuarioId: String(profile?.usuarioId ?? profile?.id ?? ''),
    googleId: profile?.googleId ?? profile?.google_id ?? null,
    email: profile?.email ?? null,
    name: profile?.name ?? profile?.full_name ?? null,
    picture: profile?.picture ?? profile?.picture_url ?? null,
    fotoCapa: profile?.fotoCapa ?? profile?.foto_capa ?? null,
  };
}

export function getAuthBaseUrl() {
  const configuredWeb = process.env.EXPO_PUBLIC_AUTH_BASE_URL_WEB?.trim();
  const configuredNative = process.env.EXPO_PUBLIC_AUTH_BASE_URL_NATIVE?.trim();
  const configured = process.env.EXPO_PUBLIC_AUTH_BASE_URL?.trim();

  if (Platform.OS === 'web' && configuredWeb) {
    return normalizeBaseUrl(configuredWeb);
  }

  if (Platform.OS !== 'web' && configuredNative) {
    return normalizeBaseUrl(configuredNative);
  }

  if (configured) {
    return normalizeBaseUrl(configured);
  }

  const expoHost = getHostFromExpo();

  if (expoHost) {
    return `http://${expoHost}:3333`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3333';
  }

  return 'http://localhost:3333';
}

export async function signInWithGoogleMobile(params: {
  idToken: string;
  clientId?: string;
  platform?: 'web' | 'android' | 'ios';
}): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  const platform = params.platform ?? (Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android');
  const tokenClaims = decodeJwtPayload(params.idToken);
  const endpoints =
    platform === 'web'
      ? ['/auth/google', '/auth/google/mobile']
      : ['/auth/google/mobile', '/auth/google'];

  let response: Response | null = null;
  let payload: any = null;
  let lastNetworkError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: params.idToken,
          id_token: params.idToken,
          token: params.idToken,
          credential: params.idToken,
          clientId: params.clientId,
          platform,
          tokenAudience: tokenClaims?.aud ?? null,
          tokenIssuer: tokenClaims?.iss ?? null,
        }),
      });
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (response.ok) {
      break;
    }
  }

  if (!response) {
    const suffix = lastNetworkError ? ' (erro de rede ao tentar endpoints Google).' : '.';
    throw new Error(`Não foi possível conectar na API (${baseUrl})${suffix} Verifique rede e firewall.`);
  }

  if (!response.ok) {
    const detailedMessage =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message
          : null;

    if (detailedMessage) {
      throw new Error(detailedMessage);
    }

    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  return {
    accessToken: payload.accessToken,
    profile: normalizeApiProfile(payload?.profile),
  };
}

async function parseAuthError(response: Response) {
  const payload = await response.json().catch(() => null);

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload?.message) && payload.message.length > 0) {
    return String(payload.message[0] ?? '').trim() || null;
  }

  if (typeof payload?.details === 'string' && payload.details.trim()) {
    return payload.details;
  }

  return null;
}

function extractApiMessage(payload: any) {
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload?.message) && payload.message.length > 0) {
    return String(payload.message[0] ?? '').trim() || null;
  }

  if (typeof payload?.details === 'string' && payload.details.trim()) {
    return payload.details;
  }

  return null;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  if (!response.ok) {
    const errorMessage = await parseAuthError(response);
    throw new Error(errorMessage ?? 'Falha na autenticação com e-mail e senha.');
  }

  const payload = (await response.json()) as {
    accessToken: string;
    profile: ApiProfile;
  };

  return {
    accessToken: payload.accessToken,
    profile: normalizeApiProfile(payload?.profile),
  };
}

export async function registerWithEmailPassword(params: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        fullName: params.fullName,
      }),
    });
  } catch {
    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  if (!response.ok) {
    const errorMessage = await parseAuthError(response);
    throw new Error(errorMessage ?? 'Falha ao criar conta com e-mail e senha.');
  }

  const payload = (await response.json()) as {
    accessToken: string;
    profile: ApiProfile;
  };

  return {
    accessToken: payload.accessToken,
    profile: normalizeApiProfile(payload?.profile),
  };
}

export async function changePasswordLocal(params: {
  currentPassword: string;
  newPassword: string;
}) {
  const accessToken = await getStoredAccessToken();

  if (!accessToken) {
    throw new Error('Usuário não autenticado.');
  }

  const baseUrl = getAuthBaseUrl();
  const response = await fetch(`${baseUrl}/auth/password/change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: params.currentPassword,
      newPassword: params.newPassword,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    error?: string;
    details?: string;
  } | null;

  if (!response.ok) {
    const message = extractApiMessage(payload);
    throw new Error(message ?? 'Não foi possível alterar a senha.');
  }

  if (payload?.success === false) {
    const message = extractApiMessage(payload);
    throw new Error(message ?? 'Não foi possível alterar a senha.');
  }

  return payload;
}

export async function forgotPassword(email: string) {
  const baseUrl = getAuthBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/auth/password/forgot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    error?: string;
    details?: string;
  } | null;

  if (!response.ok) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível iniciar a recuperação de senha.');
  }

  if (payload?.success === false) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível iniciar a recuperação de senha.');
  }

  return payload;
}

export async function resetPassword(params: { token: string; newPassword: string }) {
  const baseUrl = getAuthBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/auth/password/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: params.token, newPassword: params.newPassword }),
    });
  } catch {
    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    accessToken?: string;
    tokenType?: string;
    error?: string;
    details?: string;
  } | null;

  if (!response.ok) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível redefinir a senha.');
  }

  if (payload?.success === false) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível redefinir a senha.');
  }

  return payload;
}

export async function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}) {
  if (!params.email.trim()) {
    throw new Error('Campo email é obrigatório para reset por código.');
  }

  const baseUrl = getAuthBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/auth/password/reset/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email.trim(),
        code: params.code,
        newPassword: params.newPassword,
      }),
    });
  } catch {
    throw new Error(`Não foi possível conectar na API (${baseUrl}). Verifique rede e firewall.`);
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    accessToken?: string;
    tokenType?: string;
    error?: string;
    details?: string;
  } | null;

  if (!response.ok) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível redefinir a senha com código.');
  }

  if (payload?.success === false) {
    throw new Error(extractApiMessage(payload) ?? 'Não foi possível redefinir a senha com código.');
  }

  return payload;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  let raw: string | null = null;
  try {
    raw = isWeb
      ? await localStore.getItemAsync(AUTH_SESSION_KEY)
      : await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  } catch (error) {
    reportSecureStoreError('getItemAsync', error);
    return memorySessionFallback;
  }
  if (!raw) {
    return memorySessionFallback;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken) {
      return memorySessionFallback;
    }
    return parsed;
  } catch {
    return memorySessionFallback;
  }
}

export async function saveStoredSession(session: AuthSession) {
  memorySessionFallback = session;
  try {
    if (isWeb) {
      await localStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
    }
  } catch (error) {
    reportSecureStoreError('setItemAsync', error);
  }
}

export async function clearStoredSession() {
  memorySessionFallback = null;
  try {
    if (isWeb) {
      await localStore.deleteItemAsync(AUTH_SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    }
  } catch (error) {
    reportSecureStoreError('deleteItemAsync', error);
  }
}

export async function getStoredAccessToken() {
  const session = await getStoredSession();
  return session?.accessToken ?? null;
}