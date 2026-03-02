import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoLinking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

type DadosPessoaisForm = {
  apelido: string;
  dataNascimento: string;
  idGenero: string;
  altura: string;
  peso: string;
  idTipoContato: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
};

type DadosPessoaisApi = {
  id?: string;
  apelido?: string | null;
  dataNascimento?: string | null;
  idGenero?: string | null;
  altura?: string | number | null;
  peso?: string | number | null;
  listaContato?: Array<{
    idTipoContato?: string | null;
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
  }>;
};

type LookupOption = {
  id: string;
  codigo: string;
  descricao: string;
};

function createEmptyDadosPessoaisForm(): DadosPessoaisForm {
  return {
    apelido: '',
    dataNascimento: '',
    idGenero: '',
    altura: '',
    peso: '',
    idTipoContato: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTelefone: '',
  };
}

function mapDadosPessoaisToForm(data: DadosPessoaisApi): DadosPessoaisForm {
  const firstContato = Array.isArray(data.listaContato) && data.listaContato.length > 0 ? data.listaContato[0] : null;
  const dataNascimento = typeof data.dataNascimento === 'string' ? data.dataNascimento : '';

  return {
    apelido: data.apelido ?? '',
    dataNascimento: formatDateToDisplay(dataNascimento),
    idGenero: data.idGenero ?? '',
    altura: data.altura !== undefined && data.altura !== null ? String(data.altura) : '',
    peso: data.peso !== undefined && data.peso !== null ? String(data.peso) : '',
    idTipoContato: firstContato?.idTipoContato ?? '',
    contatoNome: firstContato?.nome ?? '',
    contatoEmail: firstContato?.email ?? '',
    contatoTelefone: firstContato?.telefone ?? '',
  };
}

function formatDateToDisplay(value: string) {
  if (!value) {
    return '';
  }

  const rawDate = value.includes('T') ? value.split('T')[0] : value;
  const [year, month, day] = rawDate.split('-');

  if (!year || !month || !day) {
    return '';
  }

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

function formatDateToApi(value: string) {
  const [day, month, year] = value.split('/');

  if (!day || !month || !year) {
    return null;
  }

  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseDisplayDate(value: string) {
  const apiDate = formatDateToApi(value);

  if (!apiDate) {
    return null;
  }

  const parsed = new Date(`${apiDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateFromPicker(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day}/${month}/${year}`;
}

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
  const [accountView, setAccountView] = useState<'menu' | 'connected-apps' | 'personal-data'>('menu');
  const [stravaStatus, setStravaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [stravaFeedback, setStravaFeedback] = useState<string | null>(null);
  const [coverPhotoUri, setCoverPhotoUri] = useState<string | null>(null);
  const [personalDataId, setPersonalDataId] = useState<string | null>(null);
  const [personalDataForm, setPersonalDataForm] = useState<DadosPessoaisForm>(createEmptyDadosPessoaisForm);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [birthDatePickerValue, setBirthDatePickerValue] = useState<Date>(new Date(2000, 0, 1));
  const [generoOptions, setGeneroOptions] = useState<LookupOption[]>([]);
  const [tipoContatoOptions, setTipoContatoOptions] = useState<LookupOption[]>([]);
  const [isLoadingPersonalData, setIsLoadingPersonalData] = useState(false);
  const [isLoadingLookupOptions, setIsLoadingLookupOptions] = useState(false);
  const [isSavingPersonalData, setIsSavingPersonalData] = useState(false);
  const [personalDataFeedback, setPersonalDataFeedback] = useState<string | null>(null);
  const coverPhotoStorageKey = `lsee.cover_photo.${profile.usuarioId}`;
  const stravaReturnTo = useMemo(() => ExpoLinking.createURL('/'), []);

  const loadStravaStatus = useCallback(async () => {
    try {
      const response = await apiFetchAuth(`/strava/status?returnTo=${encodeURIComponent(stravaReturnTo)}`);

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
  }, [stravaReturnTo]);

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

      if (stravaStatus === 'connected') {
        const shouldLogout = await new Promise<boolean>((resolve) => {
          Alert.alert('Desconectar Strava', 'Tem certeza?', [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Desconectar',
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ]);
        });

        if (!shouldLogout) {
          return;
        }

        const response = await apiFetchAuth('/strava/logout', {
          method: 'POST',
        });

        if (!response.ok) {
          setStravaFeedback('Não foi possível desconectar do Strava.');
          return;
        }

        setStravaStatus('disconnected');
        setStravaFeedback('Strava desconectado.');
        return;
      }

      const authUrl = `${getAuthBaseUrl()}/strava/auth?userToken=${encodeURIComponent(session.accessToken)}&returnTo=${encodeURIComponent(stravaReturnTo)}`;

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

  const loadPersonalData = useCallback(async () => {
    try {
      setIsLoadingPersonalData(true);
      setPersonalDataFeedback(null);

      const response = await apiFetchAuth('/dados-pessoais');

      if (!response.ok) {
        setPersonalDataFeedback('Não foi possível carregar Dados Pessoais.');
        return;
      }

      const payload = (await response.json()) as Array<Record<string, any>>;
      const firstItem = Array.isArray(payload) && payload.length > 0 ? payload[0] : null;

      if (!firstItem) {
        setPersonalDataId(null);
        setPersonalDataForm(createEmptyDadosPessoaisForm());
        setBirthDatePickerValue(new Date(2000, 0, 1));
        setPersonalDataFeedback('Nenhum dado pessoal encontrado para este usuário.');
        return;
      }

      const id = firstItem.id;
      setPersonalDataId(id !== undefined && id !== null ? String(id) : null);
      const mapped = mapDadosPessoaisToForm(firstItem as DadosPessoaisApi);
      setPersonalDataForm(mapped);
      setBirthDatePickerValue(parseDisplayDate(mapped.dataNascimento) ?? new Date(2000, 0, 1));
    } catch {
      setPersonalDataFeedback('Erro ao carregar Dados Pessoais.');
    } finally {
      setIsLoadingPersonalData(false);
    }
  }, []);

  const loadLookupOptions = useCallback(async () => {
    async function loadFromRoute(route: string) {
      try {
        const response = await apiFetchAuth(route);

        if (!response.ok) {
          return [] as LookupOption[];
        }

        const payload = (await response.json()) as unknown;
        const list = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as any).items)
            ? (payload as any).items
            : [];

        return list
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const raw = item as Record<string, unknown>;
            return {
              id: String(raw.id ?? ''),
              codigo: String(raw.codigo ?? ''),
              descricao: String(raw.descricao ?? ''),
            } as LookupOption;
          })
          .filter((item) => item.id);
      } catch {
        return [] as LookupOption[];
      }
    }

    try {
      setIsLoadingLookupOptions(true);
      const [generos, tiposContato] = await Promise.all([
        loadFromRoute('/genero'),
        loadFromRoute('/tipo-contato'),
      ]);

      setGeneroOptions(generos);
      setTipoContatoOptions(tiposContato);
    } finally {
      setIsLoadingLookupOptions(false);
    }
  }, []);

  async function handleSavePersonalData() {
    try {
      setIsSavingPersonalData(true);
      setPersonalDataFeedback(null);

      if (
        !personalDataForm.apelido.trim() ||
        !personalDataForm.dataNascimento.trim() ||
        !personalDataForm.idGenero.trim() ||
        !personalDataForm.altura.trim() ||
        !personalDataForm.peso.trim()
      ) {
        setPersonalDataFeedback('Preencha apelido, dataNascimento, idGenero, altura e peso.');
        return;
      }

      const normalizedBirthDate = formatDateToApi(personalDataForm.dataNascimento.trim());

      if (!normalizedBirthDate) {
        setPersonalDataFeedback('Data de nascimento inválida. Use o calendário para selecionar a data.');
        return;
      }

      const hasAnyContato =
        personalDataForm.idTipoContato.trim() ||
        personalDataForm.contatoNome.trim() ||
        personalDataForm.contatoEmail.trim() ||
        personalDataForm.contatoTelefone.trim();

      if (
        hasAnyContato &&
        (!personalDataForm.idTipoContato.trim() ||
          !personalDataForm.contatoNome.trim() ||
          !personalDataForm.contatoEmail.trim() ||
          !personalDataForm.contatoTelefone.trim())
      ) {
        setPersonalDataFeedback('Para salvar contato, preencha idTipoContato, nome, email e telefone.');
        return;
      }

      const payload: Record<string, unknown> = {
        apelido: personalDataForm.apelido.trim(),
        dataNascimento: normalizedBirthDate,
        idGenero: personalDataForm.idGenero.trim(),
        altura: personalDataForm.altura.trim(),
        peso: personalDataForm.peso.trim(),
      };

      if (hasAnyContato) {
        payload.listaContato = [
          {
            idTipoContato: personalDataForm.idTipoContato.trim(),
            nome: personalDataForm.contatoNome.trim(),
            email: personalDataForm.contatoEmail.trim(),
            telefone: personalDataForm.contatoTelefone.trim(),
          },
        ];
      }

      const response = personalDataId
        ? await apiFetchAuth(`/dados-pessoais/${personalDataId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetchAuth('/dados-pessoais', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message =
          typeof errorPayload?.error === 'string'
            ? errorPayload.error
            : 'Não foi possível salvar Dados Pessoais.';
        setPersonalDataFeedback(message);
        return;
      }

      const saved = (await response.json()) as DadosPessoaisApi;
      const savedId = saved?.id;

      if (savedId !== undefined && savedId !== null) {
        setPersonalDataId(String(savedId));
      }

      const mapped = mapDadosPessoaisToForm(saved);
      setPersonalDataForm(mapped);
      setBirthDatePickerValue(parseDisplayDate(mapped.dataNascimento) ?? new Date(2000, 0, 1));
      setPersonalDataFeedback('Dados Pessoais salvos com sucesso.');
    } catch {
      setPersonalDataFeedback('Erro ao salvar Dados Pessoais.');
    } finally {
      setIsSavingPersonalData(false);
    }
  }

  function openPersonalDataScreen() {
    setAccountView('personal-data');
    void loadPersonalData();
    void loadLookupOptions();
  }

  function handleBirthDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setBirthDatePickerVisible(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setBirthDatePickerValue(selectedDate);
    setPersonalDataForm((prev) => ({
      ...prev,
      dataNascimento: formatDateFromPicker(selectedDate),
    }));
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

            <Pressable
              onPress={openPersonalDataScreen}
              style={({ pressed }) => [styles.accountMenuItem, pressed && styles.accountMenuItemPressed]}>
              <Text style={styles.accountMenuText}>Dados Pessoais</Text>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
            <Text style={styles.signOutButtonText}>Sair</Text>
          </Pressable>
        </>
      ) : accountView === 'connected-apps' ? (
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
              {stravaStatus === 'connected' ? 'Desconectar do Strava' : stravaStatus === 'loading' ? 'Verificando Strava...' : 'Conectar com Strava'}
            </Text>
          </Pressable>

          {stravaFeedback ? <Text style={styles.profileFeedback}>{stravaFeedback}</Text> : null}
        </View>
      ) : (
        <View style={styles.connectedAppsScreen}>
          <View style={styles.connectedAppsHeader}>
            <Pressable onPress={() => setAccountView('menu')} style={styles.connectedAppsBackButton}>
              <Ionicons name="chevron-back" size={20} color="#111827" />
            </Pressable>
            <Text style={styles.connectedAppsTitle}>Dados Pessoais</Text>
          </View>

          {isLoadingPersonalData ? (
            <View style={styles.personalDataLoadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.personalDataInfoText}>Carregando dados...</Text>
            </View>
          ) : (
            <View style={styles.personalDataFormContainer}>
              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>apelido</Text>
                <TextInput
                  value={personalDataForm.apelido}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, apelido: text }))}
                  style={styles.personalDataInput}
                  placeholder="Informe o apelido"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>dataNascimento (dd/MM/yyyy)</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webDatePickerBlock}>
                    <DateTimePicker
                      mode="date"
                      display="default"
                      value={birthDatePickerValue}
                      maximumDate={new Date()}
                      onChange={handleBirthDateChange}
                    />
                    <Text style={styles.personalDataDateValue}>{personalDataForm.dataNascimento || 'dd/MM/yyyy'}</Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      onPress={() => setBirthDatePickerVisible(true)}
                      style={({ pressed }) => [styles.personalDataDateInput, pressed && styles.personalDataDateInputPressed]}>
                      <Text
                        style={
                          personalDataForm.dataNascimento
                            ? styles.personalDataDateValue
                            : styles.personalDataDatePlaceholder
                        }>
                        {personalDataForm.dataNascimento || 'dd/MM/yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                    </Pressable>

                    {birthDatePickerVisible ? (
                      <DateTimePicker
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        value={birthDatePickerValue}
                        maximumDate={new Date()}
                        onChange={handleBirthDateChange}
                      />
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>idGenero</Text>
                {isLoadingLookupOptions ? (
                  <Text style={styles.personalDataInfoText}>Carregando opções de gênero...</Text>
                ) : generoOptions.length > 0 ? (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={personalDataForm.idGenero}
                      onValueChange={(value) => setPersonalDataForm((prev) => ({ ...prev, idGenero: String(value ?? '') }))}>
                      <Picker.Item label="Selecione" value="" />
                      {generoOptions.map((item) => (
                        <Picker.Item key={item.id} label={item.descricao || item.codigo} value={item.id} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <TextInput
                    value={personalDataForm.idGenero}
                    onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, idGenero: text }))}
                    style={styles.personalDataInput}
                    placeholder="UUID do gênero"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>altura</Text>
                <TextInput
                  value={personalDataForm.altura}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, altura: text }))}
                  style={styles.personalDataInput}
                  placeholder="Ex.: 1.75"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>peso</Text>
                <TextInput
                  value={personalDataForm.peso}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, peso: text }))}
                  style={styles.personalDataInput}
                  placeholder="Ex.: 72.5"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.personalDataSectionTitle}>Contato (opcional)</Text>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>idTipoContato</Text>
                {isLoadingLookupOptions ? (
                  <Text style={styles.personalDataInfoText}>Carregando tipos de contato...</Text>
                ) : tipoContatoOptions.length > 0 ? (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={personalDataForm.idTipoContato}
                      onValueChange={(value) => setPersonalDataForm((prev) => ({ ...prev, idTipoContato: String(value ?? '') }))}>
                      <Picker.Item label="Selecione" value="" />
                      {tipoContatoOptions.map((item) => (
                        <Picker.Item key={item.id} label={item.descricao || item.codigo} value={item.id} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <TextInput
                    value={personalDataForm.idTipoContato}
                    onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, idTipoContato: text }))}
                    style={styles.personalDataInput}
                    placeholder="UUID do tipo de contato"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>nome</Text>
                <TextInput
                  value={personalDataForm.contatoNome}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, contatoNome: text }))}
                  style={styles.personalDataInput}
                  placeholder="Nome do contato"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>email</Text>
                <TextInput
                  value={personalDataForm.contatoEmail}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, contatoEmail: text }))}
                  style={styles.personalDataInput}
                  placeholder="email@dominio.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>telefone</Text>
                <TextInput
                  value={personalDataForm.contatoTelefone}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, contatoTelefone: text }))}
                  style={styles.personalDataInput}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>

              <Pressable
                onPress={handleSavePersonalData}
                disabled={isSavingPersonalData}
                style={({ pressed }) => [
                  styles.personalDataSaveButton,
                  pressed && styles.personalDataSaveButtonPressed,
                  isSavingPersonalData && styles.personalDataSaveButtonDisabled,
                ]}>
                <Text style={styles.personalDataSaveButtonText}>
                  {isSavingPersonalData ? 'Salvando...' : 'Salvar'}
                </Text>
              </Pressable>

              {personalDataFeedback ? <Text style={styles.profileFeedback}>{personalDataFeedback}</Text> : null}
            </View>
          )}
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
    marginBottom: 10,
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
  personalDataLoadingContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 24,
    gap: 10,
  },
  personalDataFormContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  personalDataInfoText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  personalDataFieldBlock: {
    marginBottom: 14,
  },
  personalDataFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  personalDataSectionTitle: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  webDatePickerBlock: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  personalDataInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  personalDataDateInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personalDataDateInputPressed: {
    opacity: 0.85,
  },
  personalDataDateValue: {
    fontSize: 14,
    color: '#111827',
  },
  personalDataDatePlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  personalDataSaveButton: {
    marginTop: 8,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalDataSaveButtonPressed: {
    opacity: 0.9,
  },
  personalDataSaveButtonDisabled: {
    opacity: 0.7,
  },
  personalDataSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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