import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetchAuth } from '@/services/api-client';
import { getAuthBaseUrl, type AuthSession } from '@/services/auth';

type RootTabParamList = {
  Home: undefined;
  Busca: undefined;
  MinhaConta: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type BottomTabNavigationProps = {
  session: AuthSession;
  onSignOut: () => void;
};

type BikeItem = {
  id: string;
  apelido?: string | null;
  totalKm?: number | null;
  principal?: boolean | null;
};

function HomeScreen() {
  const [bikes, setBikes] = useState<BikeItem[]>([]);
  const [bikesStatus, setBikesStatus] = useState('Carregando bikes...');

  useEffect(() => {
    let isMounted = true;

    async function validateApi() {
      try {
        const response = await apiFetchAuth('/auth/status');

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setBikesStatus(`API respondeu ${response.status}`);
          return;
        }

        const bikesResponse = await apiFetchAuth('/bikes');

        if (!isMounted) {
          return;
        }

        if (!bikesResponse.ok) {
          setBikesStatus(`Não foi possível carregar bikes (${bikesResponse.status}).`);
          return;
        }

        const bikesPayload = (await bikesResponse.json()) as BikeItem[];
        setBikes(Array.isArray(bikesPayload) ? bikesPayload : []);
        setBikesStatus(
          Array.isArray(bikesPayload) && bikesPayload.length > 0
            ? 'Bikes carregadas'
            : 'Nenhuma bike cadastrada.'
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Erro ao validar API';
        setBikesStatus(message);
        setBikesStatus('Erro ao carregar bikes.');
      }
    }

    validateApi();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.homeScreen}>
      <Text style={styles.title}>Home</Text>

      <Text style={styles.bikesStatusText}>{bikesStatus}</Text>

      <FlatList
        data={bikes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.bikesList}
        renderItem={({ item }) => (
          <View style={styles.bikeCard}>
            <View style={styles.bikeHeaderRow}>
              <Text style={styles.bikeName}>{item.apelido?.trim() || 'Bike sem apelido'}</Text>
              {item.principal ? <Text style={styles.bikePrincipal}>Principal</Text> : null}
            </View>
            <Text style={styles.bikeKm}>{`${Number(item.totalKm ?? 0).toFixed(1)} km`}</Text>
          </View>
        )}
      />
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
  const [accountView, setAccountView] = useState<'menu' | 'connected-apps'>('menu');
  const [stravaStatus, setStravaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [stravaFeedback, setStravaFeedback] = useState<string | null>(null);
  const [coverPhotoUri, setCoverPhotoUri] = useState<string | null>(null);
  const coverPhotoStorageKey = `lsee.cover_photo.${profile.usuarioId}`;

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

  useEffect(() => {
    let isMounted = true;

    async function loadStoredCoverPhoto() {
      try {
        const storedCoverPhotoUri = await SecureStore.getItemAsync(coverPhotoStorageKey);

        if (!isMounted) {
          return;
        }

        setCoverPhotoUri(storedCoverPhotoUri ?? null);
      } catch {
        if (!isMounted) {
          return;
        }

        setCoverPhotoUri(null);
      }
    }

    void loadStoredCoverPhoto();

    return () => {
      isMounted = false;
    };
  }, [coverPhotoStorageKey]);

  async function handleStravaLogin() {
    try {
      setStravaFeedback(null);

      const authUrl = `${getAuthBaseUrl()}/strava/auth?userToken=${encodeURIComponent(session.accessToken)}&returnTo=${encodeURIComponent('/inicio')}`;

      await Linking.openURL(authUrl);
    } catch {
      setStravaFeedback('Não foi possível abrir o login do Strava.');
    }
  }

  async function handleSelectCoverPhoto() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setStravaFeedback('Permita acesso à galeria para selecionar a foto de capa.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
      aspect: [16, 7],
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const nextCoverPhotoUri = result.assets[0].uri;
    setCoverPhotoUri(nextCoverPhotoUri);

    try {
      await SecureStore.setItemAsync(coverPhotoStorageKey, nextCoverPhotoUri);
    } catch {
      setStravaFeedback('A foto de capa foi aplicada, mas não foi possível salvar no dispositivo.');
    }
  }

  async function handleRemoveCoverPhoto() {
    setCoverPhotoUri(null);

    try {
      await SecureStore.deleteItemAsync(coverPhotoStorageKey);
    } catch {
      setStravaFeedback('A foto de capa foi removida, mas não foi possível atualizar o armazenamento local.');
    }
  }

  return (
    <ScrollView style={styles.profileScreen} contentContainerStyle={styles.profileContent}>
      {accountView === 'menu' ? (
        <>
          <View style={styles.coverPhotoContainer}>
            <Pressable
              onPress={handleSelectCoverPhoto}
              style={({ pressed }) => [styles.coverPhotoTouchArea, pressed && styles.coverPhotoTouchAreaPressed]}>
              {coverPhotoUri ? (
                <Image source={{ uri: coverPhotoUri }} style={styles.coverPhotoImage} />
              ) : (
                <View style={styles.coverPhotoPlaceholder}>
                  <Ionicons name="image-outline" size={28} color="#6B7280" />
                  <Text style={styles.coverPhotoPlaceholderText}>Selecionar foto de capa</Text>
                </View>
              )}
            </Pressable>

            {coverPhotoUri ? (
              <Pressable
                onPress={handleRemoveCoverPhoto}
                style={({ pressed }) => [styles.removeCoverIconButton, pressed && styles.removeCoverIconButtonPressed]}>
                <Ionicons name="close" size={16} color="#111827" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.profileHeaderBlock}>
            {profile.picture ? <Image source={{ uri: profile.picture }} style={styles.avatar} /> : null}
            <Text style={styles.title}>{profile.name ?? 'Usuário'}</Text>
            <Text style={styles.profileEmail}>{profile.email ?? 'E-mail não disponível'}</Text>
          </View>

          <View style={styles.accountMenuList}>
            <Pressable
              onPress={() => setAccountView('connected-apps')}
              style={({ pressed }) => [styles.accountMenuItem, pressed && styles.accountMenuItemPressed]}>
              <Text style={styles.accountMenuText}>Aplicativos Conectados</Text>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
            <Text style={styles.signOutButtonText}>Sair</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.connectedAppsScreen}>
          <View style={styles.connectedAppsHeader}>
            <Pressable onPress={() => setAccountView('menu')} style={styles.connectedAppsBackButton}>
              <Ionicons name="chevron-back" size={20} color="#111827" />
            </Pressable>
            <Text style={styles.connectedAppsTitle}>Aplicativos Conectados</Text>
          </View>

          <Pressable
            onPress={handleStravaLogin}
            style={({ pressed }) => [styles.stravaButton, pressed && styles.stravaButtonPressed]}>
            <Text style={styles.stravaButtonText}>
              {stravaStatus === 'connected' ? 'Conectado ao Strava' : stravaStatus === 'loading' ? 'Verificando Strava...' : 'Conectar com Strava'}
            </Text>
          </Pressable>

          {stravaFeedback ? <Text style={styles.profileFeedback}>{stravaFeedback}</Text> : null}
        </View>
      )}
    </ScrollView>
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
          if (route.name === 'MinhaConta' && session.profile.picture) {
            return <Image source={{ uri: session.profile.picture }} style={styles.tabAvatar} />;
          }

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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Busca" component={BuscaScreen} />
      <Tab.Screen
        name="MinhaConta"
        options={{
          title: 'Minha Conta',
          tabBarLabel: () => null,
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}>
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
  homeScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111111',
  },
  bikesStatusText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  bikesList: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  bikeCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  bikeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bikeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  bikePrincipal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bikeKm: {
    marginTop: 8,
    fontSize: 14,
    color: '#374151',
  },
  profileScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  profileContent: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  accountMenuList: {
    width: '100%',
    marginTop: 18,
    paddingHorizontal: 16,
  },
  accountMenuItem: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountMenuItemPressed: {
    opacity: 0.8,
  },
  accountMenuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  connectedAppsScreen: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',
  },
  connectedAppsHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  connectedAppsBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedAppsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  coverPhotoContainer: {
    width: '100%',
    height: 170,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    position: 'relative',
  },
  coverPhotoTouchArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPhotoTouchAreaPressed: {
    opacity: 0.9,
  },
  coverPhotoImage: {
    width: '100%',
    height: '100%',
  },
  coverPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPhotoPlaceholderText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  removeCoverIconButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCoverIconButtonPressed: {
    opacity: 0.8,
  },
  profileHeaderBlock: {
    alignItems: 'center',
    marginTop: -42,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
  },
  tabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
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