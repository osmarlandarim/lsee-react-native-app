import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type ApiProfile = {
  usuarioId: string;
  googleId: string;
  email: string | null;
  name: string | null;
  picture: string | null;
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
  return baseUrl.replace(/\/$/, '');
}

function getHostFromExpo() {
  const fromExpoConfig = Constants.expoConfig?.hostUri;

  if (fromExpoConfig) {
    return fromExpoConfig.split(':')[0];
  }

  return null;
}

export function getAuthBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_AUTH_BASE_URL?.trim();

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

export async function signInWithGoogleMobile(idToken: string): Promise<AuthSession> {
  const response = await fetch(`${getAuthBaseUrl()}/auth/google/mobile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === 'string' ? payload.error : 'Falha na autenticação com Google.';

    throw new Error(errorMessage);
  }

  return {
    accessToken: payload.accessToken,
    profile: payload.profile,
  };
}

export async function getStoredSession(): Promise<AuthSession | null> {
  let raw: string | null = null;

  try {
    raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
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
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    reportSecureStoreError('setItemAsync', error);
  }
}

export async function clearStoredSession() {
  memorySessionFallback = null;

  try {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  } catch (error) {
    reportSecureStoreError('deleteItemAsync', error);
  }
}

export async function getStoredAccessToken() {
  const session = await getStoredSession();
  return session?.accessToken ?? null;
}