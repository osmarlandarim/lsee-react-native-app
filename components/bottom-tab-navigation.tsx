import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetchAuth } from '@/services/api-client';
import type { AuthSession } from '@/services/auth';

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

  return (
    <View style={styles.profileScreen}>
      {profile.picture ? <Image source={{ uri: profile.picture }} style={styles.avatar} /> : null}
      <Text style={styles.title}>{profile.name ?? 'Usuário'}</Text>
      <Text style={styles.profileEmail}>{profile.email ?? 'E-mail não disponível'}</Text>

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
          let iconName: string;

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