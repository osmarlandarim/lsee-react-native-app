import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import BottomTabNavigation from '@/components/bottom-tab-navigation';
import { useAuth } from '@/contexts/auth-context';
import {
    signInWithGoogleMobile,
} from '@/services/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const GOOGLE_WEB_REDIRECT_URI = process.env.EXPO_PUBLIC_GOOGLE_WEB_REDIRECT_URI;
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const IS_WEB = Platform.OS === 'web';

function normalizeWebRedirectUri(value: string) {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);

    if (!parsed.pathname || parsed.pathname === '') {
      parsed.pathname = '/';
    }

    return parsed.toString();
  } catch {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }
}

const GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE = IS_EXPO_GO
  ? GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_ID
  : GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_CLIENT_ID_EFFECTIVE = IS_WEB
  ? GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_ID
  : GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE;

export default function IndexScreen() {
  const router = useRouter();
  const { session, isHydrating, setAuthenticatedSession, signOut } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const googleRedirectUri = useMemo(
    () => {
      if (IS_WEB && GOOGLE_WEB_REDIRECT_URI?.trim()) {
        return normalizeWebRedirectUri(GOOGLE_WEB_REDIRECT_URI);
      }

      return makeRedirectUri({
        scheme: 'lseeapp',
        preferLocalhost: true,
      });
    },
    []
  );

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE ?? 'MISSING_ANDROID_CLIENT_ID',
    iosClientId: GOOGLE_IOS_CLIENT_ID ?? 'MISSING_IOS_CLIENT_ID',
    webClientId: GOOGLE_WEB_CLIENT_ID ?? 'MISSING_WEB_CLIENT_ID',
    redirectUri: googleRedirectUri,
  });

  const completeLoginWithIdToken = useCallback(async (idToken: string) => {
    const nextSession = await signInWithGoogleMobile(idToken);
    await setAuthenticatedSession(nextSession);
  }, [setAuthenticatedSession]);

  const processGoogleAuthResult = useCallback(async (result: any) => {
    if (!result) {
      Alert.alert('Login não concluído', 'Login não retornou resposta do Google. Verifique bloqueio de pop-up no navegador.');
      return;
    }

    if (result.type !== 'success') {
      const providerError = result.params?.error ?? result.error?.message ?? null;
      const providerErrorDescription = result.params?.error_description ?? null;
      const isPermissionBlocked =
        providerError === 'access_denied' ||
        providerError === 'access_blocked' ||
        providerError === 'origin_mismatch' ||
        providerError === 'redirect_uri_mismatch';

      const feedback = isPermissionBlocked
        ? 'Google bloqueou a permissão. Verifique OAuth consent screen (app em Testing + usuário em Test users), Authorized JavaScript origins e Authorized redirect URIs do client Web.'
        : providerError
          ? `Login Google não concluído (${result.type}): ${providerError}`
          : `Login Google não concluído (${result.type}).`;

      const feedbackWithDescription =
        providerErrorDescription && !isPermissionBlocked
          ? `${feedback} ${providerErrorDescription}`
          : feedback;

      Alert.alert('Login não concluído', feedbackWithDescription);
      return;
    }

    const idToken = result.params?.id_token ?? result.authentication?.idToken;

    if (!idToken) {
      Alert.alert('Falha no login', 'Google autenticou, mas não retornou idToken para a API.');
      return;
    }

    try {
      setIsAuthenticating(true);
      await completeLoginWithIdToken(idToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado de autenticação.';
      Alert.alert('Falha no login', message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [completeLoginWithIdToken]);

  const handleGoogleSignInPress = useCallback(async () => {
    try {
      const result = await promptAsync();
      await processGoogleAuthResult(result);
    } catch {
      Alert.alert('Login não concluído', 'Não foi possível iniciar o login Google. Verifique bloqueio de pop-up e tente novamente.');
    }
  }, [processGoogleAuthResult, promptAsync]);

  async function handleSignOut() {
    await signOut();
  }

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Carregando sessão...</Text>
      </SafeAreaView>
    );
  }

  if (session) {
    return <BottomTabNavigation session={session} onSignOut={handleSignOut} />;
  }

  const isGoogleConfigMissing = !GOOGLE_CLIENT_ID_EFFECTIVE;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          disabled={!request || isAuthenticating || isGoogleConfigMissing}
          onPress={handleGoogleSignInPress}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            (!request || isAuthenticating || isGoogleConfigMissing) && styles.googleButtonDisabled,
          ]}>
          <Image
            source={{
              uri: 'https://developers.google.com/identity/images/g-logo.png',
            }}
            style={styles.googleLogo}
          />
          <Text style={styles.googleButtonText}>
            {isAuthenticating ? 'Entrando...' : 'Continuar com Google'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/email-login' as never)}
          style={({ pressed }) => [styles.emailButton, pressed && styles.emailButtonPressed]}>
          <Text style={styles.emailButtonText}>Entrar com email</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  googleButton: {
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonPressed: {
    opacity: 0.8,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emailButton: {
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailButtonPressed: {
    opacity: 0.9,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    color: '#374151',
  },
});