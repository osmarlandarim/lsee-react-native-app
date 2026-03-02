import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import BottomTabNavigation from '@/components/bottom-tab-navigation';
import {
    clearStoredSession,
    getAuthBaseUrl,
    getStoredSession,
    saveStoredSession,
    signInWithGoogleMobile,
    type AuthSession,
} from '@/services/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_ID;
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE = IS_EXPO_GO
  ? GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_ID
  : GOOGLE_ANDROID_CLIENT_ID;

export default function IndexScreen() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE ?? 'MISSING_ANDROID_CLIENT_ID',
    iosClientId: GOOGLE_IOS_CLIENT_ID ?? 'MISSING_IOS_CLIENT_ID',
    webClientId: GOOGLE_WEB_CLIENT_ID ?? 'MISSING_WEB_CLIENT_ID',
  });

  const authBaseUrl = useMemo(() => getAuthBaseUrl(), []);

  useEffect(() => {
    async function hydrateSession() {
      try {
        const storedSession = await getStoredSession();

        if (storedSession) {
          setSession(storedSession);
        }
      } finally {
        setIsHydrating(false);
      }
    }

    hydrateSession();
  }, []);

  useEffect(() => {
    async function handleAuthResponse() {
      if (!response || response.type !== 'success') {
        return;
      }

      const idToken = response.params?.id_token;

      if (!idToken) {
        Alert.alert('Falha no login', 'Não foi possível obter idToken do Google.');
        return;
      }

      try {
        setIsAuthenticating(true);

        const nextSession = await signInWithGoogleMobile(idToken);

        await saveStoredSession(nextSession);
        setSession(nextSession);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado de autenticação.';

        Alert.alert('Falha no login', message);
      } finally {
        setIsAuthenticating(false);
      }
    }

    handleAuthResponse();
  }, [response]);

  async function handleSignOut() {
    await clearStoredSession();
    setSession(null);
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

  const isGoogleConfigMissing = !GOOGLE_ANDROID_CLIENT_ID_EFFECTIVE;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={56} color="#1F2937" />
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.subtitle}>Faça login com sua conta Google para continuar.</Text>

        <Pressable
          disabled={!request || isAuthenticating || isGoogleConfigMissing}
          onPress={() => promptAsync()}
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

        <Text style={styles.baseUrlText}>API: {authBaseUrl}/auth/google/mobile</Text>

        {isGoogleConfigMissing ? (
          <Text style={styles.warningText}>
            {IS_EXPO_GO
              ? 'No Expo Go, defina EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (ou EXPO_PUBLIC_GOOGLE_CLIENT_ID).'
              : 'Defina EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (ou EXPO_PUBLIC_GOOGLE_CLIENT_ID) no app para habilitar login Google no Android.'}
          </Text>
        ) : null}
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
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
  },
  googleButton: {
    marginTop: 8,
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
  baseUrlText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningText: {
    marginTop: 4,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
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