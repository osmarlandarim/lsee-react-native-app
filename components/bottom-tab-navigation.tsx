import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetchAuth } from '@/services/api-client';
import { getAuthBaseUrl, type AuthSession } from '@/services/auth';

type RootTabParamList = {
  Home: undefined;
  Busca: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type BottomTabNavigationProps = {
  session: AuthSession;
  onSignOut: () => void;
};

function HomeScreen({ session }: Pick<BottomTabNavigationProps, 'session'>) {
  const userName = session.profile.name?.trim() || 'Usuário';
  const [apiStatus, setApiStatus] = useState('Validando API...');

  useEffect(() => {
    let isMounted = true;

    async function validateApi() {
      try {
        const response = await apiFetchAuth('/auth/status');

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setApiStatus(`API respondeu ${response.status}`);
          return;
        }

        setApiStatus('API autenticada conectada');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Erro ao validar API';
        setApiStatus(message);
      }
    }

    validateApi();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.homeGreeting}>Olá, {userName}</Text>
      <Text style={styles.apiStatusText}>{apiStatus}</Text>
    </View>
  );
}

function BuscaScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Busca</Text>
    </View>
  );
}

function PerfilScreen({ session, onSignOut }: BottomTabNavigationProps) {
  const { profile } = session;
  const [stravaStatus, setStravaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [stravaFeedback, setStravaFeedback] = useState<string | null>(null);

  const loadStravaStatus = useCallback(async () => {
    try {
      const response = await apiFetchAuth('/strava/status?returnTo=/inicio');

      if (!response.ok) {
        setStravaStatus('disconnected');
        setStravaFeedback('Não foi possível consultar status do Strava.');
        return;
      }

      const payload = (await response.json()) as { authenticated?: boolean };
      setStravaStatus(payload.authenticated ? 'connected' : 'disconnected');
    } catch {
      setStravaStatus('disconnected');
      setStravaFeedback('Erro ao consultar status do Strava.');
    }
  }, []);

  const processStravaCallbackUrl = useCallback((url: string) => {
    const [, queryString = ''] = url.split('?');
    const params = new URLSearchParams(queryString);
    const stravaState = params.get('strava');

    if (stravaState === 'connected') {
      setStravaFeedback('Strava conectado com sucesso.');
      setStravaStatus('connected');
      void loadStravaStatus();
      return;
    }

    if (stravaState === 'error') {
      const reason = params.get('reason');
      setStravaFeedback(reason ? `Falha ao conectar com Strava (${reason}).` : 'Falha ao conectar com Strava.');
      setStravaStatus('disconnected');
      return;
    }

    if (stravaState === 'disconnected') {
      setStravaFeedback('Strava desconectado.');
      setStravaStatus('disconnected');
    }
  }, [loadStravaStatus]);

  useEffect(() => {
    let isMounted = true;

    void loadStravaStatus();

    const subscription = Linking.addEventListener('url', (event) => {
      if (!isMounted) {
        return;
      }

      processStravaCallbackUrl(event.url);
    });

    void Linking.getInitialURL().then((initialUrl) => {
      if (!isMounted || !initialUrl) {
        return;
      }

      processStravaCallbackUrl(initialUrl);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [processStravaCallbackUrl, loadStravaStatus]);

  async function handleStravaLogin() {
    try {
      setStravaFeedback(null);

      const authUrl = `${getAuthBaseUrl()}/strava/auth?userToken=${encodeURIComponent(session.accessToken)}&returnTo=${encodeURIComponent('/inicio')}`;

      await Linking.openURL(authUrl);
    } catch {
      setStravaFeedback('Não foi possível abrir o login do Strava.');
    }
  }

  return (
    <View style={styles.profileScreen}>
      {profile.picture ? <Image source={{ uri: profile.picture }} style={styles.avatar} /> : null}
      <Text style={styles.title}>{profile.name ?? 'Usuário'}</Text>
      <Text style={styles.profileEmail}>{profile.email ?? 'E-mail não disponível'}</Text>

      <Pressable
        onPress={handleStravaLogin}
        style={({ pressed }) => [styles.stravaButton, pressed && styles.stravaButtonPressed]}>
        <Text style={styles.stravaButtonText}>
          {stravaStatus === 'connected' ? 'Conectado ao Strava' : stravaStatus === 'loading' ? 'Verificando Strava...' : 'Conectar com Strava'}
        </Text>
      </Pressable>

      {stravaFeedback ? <Text style={styles.profileFeedback}>{stravaFeedback}</Text> : null}

      <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
        <Text style={styles.signOutButtonText}>Sair</Text>
      </Pressable>
    </View>
  );
}

export default function BottomTabNavigation({ session, onSignOut }: BottomTabNavigationProps) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: 'home-outline' | 'search-outline' | 'person-outline';

          if (route.name === 'Home') {
            iconName = 'home-outline';
          } else if (route.name === 'Busca') {
            iconName = 'search-outline';
          } else {
            iconName = 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Home">{() => <HomeScreen session={session} />}</Tab.Screen>
      <Tab.Screen name="Busca" component={BuscaScreen} />
      <Tab.Screen name="Perfil">
        {() => <PerfilScreen session={session} onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111111',
  },
  homeGreeting: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
  },
  apiStatusText: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
  },
  profileScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
  },
  profileEmail: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  stravaButton: {
    marginTop: 18,
    height: 44,
    minWidth: 220,
    borderRadius: 8,
    backgroundColor: '#FC4C02',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  stravaButtonPressed: {
    opacity: 0.9,
  },
  stravaButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  profileFeedback: {
    marginTop: 10,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: 24,
    height: 44,
    minWidth: 140,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  signOutButtonPressed: {
    opacity: 0.9,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});