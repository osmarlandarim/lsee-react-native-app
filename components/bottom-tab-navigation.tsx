import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoLinking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetchAuth } from '@/services/api-client';
import { changePasswordLocal, getAuthBaseUrl, type AuthSession } from '@/services/auth';

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

type BikeResumo = {
  bikesTotalKm: number;
  tempoTotal: string;
  altimetriaTotalBike: number;
  mes: string;
  distanciaMes: number;
  tempoMes: string;
  altimetriaMes: number;
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
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('/')) {
    const [day, month, year] = trimmed.split('/');

    if (!day || !month || !year) {
      return null;
    }

    if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
      return null;
    }

    return `${year}-${month}-${day}`;
  }

  if (trimmed.includes('-')) {
    const [year, month, day] = trimmed.split('-');

    if (!day || !month || !year) {
      return null;
    }

    if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
      return null;
    }

    return `${year}-${month}-${day}`;
  }

  return null;
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

function formatDateInputMask(value: string) {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatDateToDisplay(trimmed);
  }

  const digitsOnly = value.replace(/\D/g, '').slice(0, 8);

  if (digitsOnly.length <= 2) {
    return digitsOnly;
  }

  if (digitsOnly.length <= 4) {
    return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
  }

  return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
}

function formatPhoneInputMask(value: string) {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 11);

  if (digitsOnly.length <= 2) {
    return digitsOnly;
  }

  if (digitsOnly.length <= 6) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
  }

  if (digitsOnly.length <= 10) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
  }

  return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
}

function toDigitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeImageUri(uri: string | null | undefined) {
  const trimmed = typeof uri === 'string' ? uri.trim() : '';

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|file:|content:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const baseUrl = getAuthBaseUrl();

  if (trimmed.startsWith('/')) {
    return `${baseUrl}${trimmed}`;
  }

  return `${baseUrl}/${trimmed}`;
}

function extractFotoCapaFromPayload(payload: any): string | null {
  const visited = new WeakSet<object>();
  const looksLikeCoverPath = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized.includes('/static/') || normalized.includes('/uploads/') || normalized.includes('capa');
  };

  function search(node: any): string | null {
    if (typeof node === 'string' && node.trim()) {
      return looksLikeCoverPath(node) ? node : null;
    }

    if (!node || typeof node !== 'object') {
      return null;
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);

    const directCamel = node.fotoCapa;
    if (typeof directCamel === 'string' && directCamel.trim()) {
      return directCamel;
    }

    const directSnake = node.foto_capa;
    if (typeof directSnake === 'string' && directSnake.trim()) {
      return directSnake;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const foundInArray = search(item);

        if (foundInArray) {
          return foundInArray;
        }
      }

      return null;
    }

    for (const key of Object.keys(node)) {
      const foundInChild = search(node[key]);

      if (foundInChild) {
        return foundInChild;
      }
    }

    return null;
  }

  return search(payload);
}

async function convertImageUriToDataUrl(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível converter a imagem para data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler imagem selecionada.'));
    reader.readAsDataURL(blob);
  });
}

function normalizeDecimalInput(value: string) {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return '';
  }

  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    return normalized;
  }

  return String(parsed);
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isEmailContactType(option: LookupOption | null) {
  const combined = normalizeLookupText(`${option?.codigo ?? ''} ${option?.descricao ?? ''}`);
  return combined.includes('email') || combined.includes('e-mail') || combined.includes('mail');
}

function isPhoneContactType(option: LookupOption | null) {
  const combined = normalizeLookupText(`${option?.codigo ?? ''} ${option?.descricao ?? ''}`);
  return (
    combined.includes('telefone') ||
    combined.includes('celular') ||
    combined.includes('whatsapp') ||
    combined.includes('what s app') ||
    combined.includes('phone')
  );
}

function HomeScreen() {
  const [bikes, setBikes] = useState<BikeItem[]>([]);
  const [bikesStatus, setBikesStatus] = useState('Carregando bikes...');
  const [selectedBike, setSelectedBike] = useState<BikeItem | null>(null);
  const [syncingBikeId, setSyncingBikeId] = useState<string | null>(null);
  const [syncFeedbackByBikeId, setSyncFeedbackByBikeId] = useState<Record<string, string>>({});

  const validateApi = useCallback(async () => {
    try {
      const response = await apiFetchAuth('/auth/status');
      if (!response.ok) {
        setBikesStatus(`API respondeu ${response.status}`);
        return;
      }
      const bikesResponse = await apiFetchAuth('/bikes');
      if (!bikesResponse.ok) {
        setBikesStatus(`Não foi possível carregar bikes (${bikesResponse.status}).`);
        return;
      }
      const bikesPayload = (await bikesResponse.json()) as BikeItem[];
      setBikes(Array.isArray(bikesPayload) ? bikesPayload : []);
      setBikesStatus(
        Array.isArray(bikesPayload) && bikesPayload.length > 0
          ? 'Minha Bike'
          : 'Nenhuma bike cadastrada.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar API';
      setBikesStatus(message);
      setBikesStatus('Erro ao carregar bikes.');
    }
  }, []);

  useEffect(() => {
    validateApi();
  }, [validateApi]);

  useFocusEffect(
    useCallback(() => {
      validateApi();
    }, [validateApi])
  );

  async function handleSyncBikeActivities(bike: BikeItem) {
    try {
      setSyncingBikeId(bike.id);
      setSyncFeedbackByBikeId((prev) => ({ ...prev, [bike.id]: '' }));

      const response = await apiFetchAuth('/strava/activities/sync', {
        method: 'POST',
        body: JSON.stringify({ bikeId: bike.id }),
      });

      const rawBody = await response.text().catch(() => '');
      let payload: any = null;

      try {
        payload = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        payload = null;
      }

      const messageFromPayload =
        (typeof payload?.message === 'string' && payload.message.trim()) ||
        (Array.isArray(payload?.message) && payload.message.length > 0 && String(payload.message[0]).trim()) ||
        (typeof payload?.error === 'string' && payload.error.trim()) ||
        (typeof payload?.details === 'string' && payload.details.trim()) ||
        null;

      if (!response.ok) {
        setSyncFeedbackByBikeId((prev) => ({
          ...prev,
          [bike.id]: messageFromPayload
            ? `Falha ao sincronizar (${response.status}): ${messageFromPayload}`
            : rawBody
              ? `Falha ao sincronizar (${response.status}): ${rawBody.slice(0, 220)}`
              : `Falha ao sincronizar (${response.status}).`,
        }));
        return;
      }

      setSyncFeedbackByBikeId((prev) => ({
        ...prev,
        [bike.id]: messageFromPayload ?? 'Sincronização concluída com sucesso.',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar atividades do Strava.';
      setSyncFeedbackByBikeId((prev) => ({
        ...prev,
        [bike.id]: message,
      }));
    } finally {
      setSyncingBikeId(null);
    }
  }

  if (selectedBike) {
    return (
      <DetalheBikeScreen
        bike={selectedBike}
        onBack={() => {
          setSelectedBike(null);
        }}
      />
    );
  }

  const navigation = require('expo-router').useNavigation?.() ?? null;
  function handleAddBike() {
    if (navigation) navigation.navigate('bike-form');
  }
  function handleEditBike(bike: BikeItem) {
    if (navigation) navigation.navigate('bike-form', bike);
  }
  return (
    <View style={styles.homeScreen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={styles.title}>Home</Text>
        <Pressable onPress={handleAddBike} style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.7 }]} accessibilityLabel="Adicionar bike">
          <Ionicons name="add-circle" size={28} color="#2563eb" />
        </Pressable>
      </View>

      <Text style={styles.bikesStatusText}>{bikesStatus}</Text>

      <FlatList
        data={bikes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.bikesList}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedBike(item)} style={({ pressed }) => [styles.bikeCard, pressed && styles.bikeCardPressed]}>
            <View style={styles.bikeHeaderRow}>
              <Text style={styles.bikeName}>{item.apelido?.trim() || 'Bike sem apelido'}</Text>
              <View style={styles.bikeHeaderActions}>
                {item.principal === true && (
                  <Text style={styles.bikePrincipal}>Principal</Text>
                )}

                <Pressable
                  onPress={(event) => {
                    (event as any)?.stopPropagation?.();
                    void handleSyncBikeActivities(item);
                  }}
                  accessibilityLabel="Sincronizar com Strava"
                  {...((Platform.OS === 'web' ? { title: 'Sincronizar com Strava' } : {}) as any)}
                  disabled={syncingBikeId === item.id}
                  style={({ pressed }) => [
                    styles.syncBikeIconButton,
                    pressed && styles.syncBikeButtonPressed,
                    syncingBikeId === item.id && styles.syncBikeButtonDisabled,
                  ]}>
                  {syncingBikeId === item.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Image
                      source={{
                        uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Strava_Logo.svg/64px-Strava_Logo.svg.png',
                      }}
                      style={styles.stravaSyncIcon}
                    />
                  )}
                </Pressable>
                <Pressable
                  onPress={(event) => {
                    (event as any)?.stopPropagation?.();
                    handleEditBike(item);
                  }}
                  accessibilityLabel="Editar bike"
                  style={({ pressed }) => [{ marginLeft: 8, padding: 4 }, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="create-outline" size={22} color="#374151" />
                </Pressable>
              </View>
            </View>
            <Text style={styles.bikeKm}>{`${Number(item.totalKm ?? 0).toFixed(1)} km`}</Text>

            {syncFeedbackByBikeId[item.id] ? <Text style={styles.syncBikeFeedback}>{syncFeedbackByBikeId[item.id]}</Text> : null}
          </Pressable>
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


// Converte valor decimal de horas para XhYYm
function formatBikeTime(val: string | number | null | undefined): string {
  if (val == null) return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (!isNaN(num)) {
    const h = Math.trunc(num);
    const m = Math.trunc((num - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}m`;
  }
  return String(val);
}

function DetalheBikeScreen({ bike, onBack }: { bike: BikeItem; onBack: () => void }) {
  const [resumo, setResumo] = useState<BikeResumo | null>(null);
  const [status, setStatus] = useState('Carregando resumo...');

  useEffect(() => {
    let isMounted = true;

    async function loadResumo() {
      try {
        const routes = ['/bikes/obterResumo', '/bikes/obter-resumo', '/bikes/resumo'];
        let payload: any = null;
        let response: Response | null = null;
        let lastErrorMessage: string | null = null;

        for (const route of routes) {
          response = await apiFetchAuth(route);

          if (response.ok) {
            payload = (await response.json().catch(() => null)) as any;
            break;
          }

          const errorPayload = (await response.json().catch(() => null)) as any;
          const detailedError =
            (typeof errorPayload?.message === 'string' && errorPayload.message.trim()) ||
            (Array.isArray(errorPayload?.message) && errorPayload.message[0]) ||
            (typeof errorPayload?.error === 'string' && errorPayload.error.trim()) ||
            null;

          lastErrorMessage = detailedError
            ? `Não foi possível carregar o resumo (${response.status}): ${String(detailedError)}`
            : `Não foi possível carregar o resumo (${response.status}).`;

          continue;
        }

        const source = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
        const now = new Date();
        const mesFallback = now.toLocaleDateString('pt-BR', { month: 'long' });

        if (!isMounted) {
          return;
        }

        if (!response?.ok || !source || typeof source !== 'object') {
          const bikesResponse = await apiFetchAuth('/bikes');

          if (bikesResponse.ok) {
            const bikesPayload = (await bikesResponse.json().catch(() => [])) as BikeItem[];
            const bikesList = Array.isArray(bikesPayload) ? bikesPayload : [];
            const totalDistance = bikesList.reduce((sum, item) => sum + Number(item.totalKm ?? 0), 0);

            setResumo({
              bikesTotalKm: totalDistance,
              tempoTotal: '-',
              altimetriaTotalBike: 0,
              mes: mesFallback,
              distanciaMes: 0,
              tempoMes: '-',
              altimetriaMes: 0,
            });
            setStatus('Resumo parcial carregado (somente distância total).');
            return;
          }

          setStatus(lastErrorMessage ?? 'Resumo indisponível no momento.');
          return;
        }

        const parsedResumo: BikeResumo = {
          bikesTotalKm: Number(source?.bikesTotalKm ?? 0),
          tempoTotal: String(source?.tempoTotal ?? '-'),
          altimetriaTotalBike: Number(source?.altimetriaTotalBike ?? 0),
          mes: String(source?.mes ?? mesFallback),
          distanciaMes: Number(source?.distanciaMes ?? 0),
          tempoMes: String(source?.tempoMes ?? '-'),
          altimetriaMes: Number(source?.altimetriaMes ?? 0),
        };

        setResumo(parsedResumo);
        setStatus('Resumo carregado');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Erro ao carregar resumo da bike.';
        setStatus(message);
      }
    }

    void loadResumo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.bikeDetailScreen} contentContainerStyle={styles.bikeDetailContent}>
      <View style={styles.bikeDetailHeader}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.bikeDetailBackButton, pressed && styles.bikeDetailBackButtonPressed]}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.bikeDetailHeaderTitle}>{bike.apelido?.trim() || 'Bike sem apelido'}</Text>
      </View>

      {status !== 'Resumo carregado' ? <Text style={styles.bikesStatusText}>{status}</Text> : null}

      {resumo ? (
        <View style={styles.resumoCard}>
          <Text style={styles.resumoSectionTitle}>Geral</Text>
          <View style={styles.resumoMetricsRow}>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Distância</Text>
              <Text style={styles.resumoValue}>{`${resumo.bikesTotalKm.toFixed(1)} km`}</Text>
            </View>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Tempo</Text>
              <Text style={styles.resumoValue}>{formatBikeTime(resumo.tempoTotal)}</Text>
            </View>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Altimetria</Text>
              <Text style={styles.resumoValue}>{`${resumo.altimetriaTotalBike.toFixed(0)} m`}</Text>
            </View>
          </View>

          <Text style={styles.resumoSectionTitle}>{resumo.mes ? resumo.mes.charAt(0).toUpperCase() + resumo.mes.slice(1) : ''}</Text>
          <View style={styles.resumoMetricsRow}>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Distância</Text>
              <Text style={styles.resumoValue}>{`${resumo.distanciaMes.toFixed(1)} km`}</Text>
            </View>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Tempo</Text>
              <Text style={styles.resumoValue}>{formatBikeTime(resumo.tempoMes)}</Text>
            </View>
            <View style={styles.resumoMetricItem}>
              <Text style={styles.resumoLabel}>Altimetria</Text>
              <Text style={styles.resumoValue}>{`${resumo.altimetriaMes.toFixed(0)} m`}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function PerfilScreen({ session, onSignOut }: BottomTabNavigationProps) {
  const { profile } = session;
  const defaultCoverPhotoUri = normalizeImageUri('/static/defaults/LSeeCapaDefaut.png');
  const apiCoverPhotoUri =
    normalizeImageUri(profile.fotoCapa ?? (profile as any).foto_capa ?? null) ?? defaultCoverPhotoUri;
  const [accountView, setAccountView] = useState<'menu' | 'connected-apps' | 'personal-data' | 'change-password'>('menu');
  const [stravaStatus, setStravaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [stravaFeedback, setStravaFeedback] = useState<string | null>(null);
  const [coverPhotoUri, setCoverPhotoUri] = useState<string | null>(apiCoverPhotoUri);
  const isCustomCoverPhoto = Boolean(coverPhotoUri && coverPhotoUri !== defaultCoverPhotoUri);
  const [coverPhotoFeedback, setCoverPhotoFeedback] = useState<string | null>(null);
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
  const [tipoContatoLookupFeedback, setTipoContatoLookupFeedback] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordFeedback, setChangePasswordFeedback] = useState<string | null>(null);
  // Para web, defina explicitamente a URL de retorno correta para o frontend
  const stravaReturnTo = useMemo(() => {
    if (Platform.OS === 'web') {
      return 'http://localhost:8081/inicio';
    }
    return ExpoLinking.createURL('/');
  }, []);

  const loadStravaStatus = useCallback(async () => {
    try {
      const response = await apiFetchAuth(`/strava/status?returnTo=${encodeURIComponent(stravaReturnTo)}`);

      if (!response.ok) {
        setStravaStatus('disconnected');
        setStravaFeedback('Não foi possível consultar o status do Strava.');
        return;
      }

      const payload = (await response.json()) as { authenticated?: boolean };
      setStravaStatus(payload.authenticated ? 'connected' : 'disconnected');
    } catch {
      setStravaStatus('disconnected');
      setStravaFeedback('Erro ao consultar o status do Strava.');
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
      setStravaFeedback(reason ? `Falha ao conectar ao Strava (${reason}).` : 'Falha ao conectar ao Strava.');
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

    async function loadCoverPhotoFromApi() {
      const routes = [
        `/usuarios/${profile.usuarioId}/foto-capa`,
        `/usuarios/${profile.usuarioId}`,
        '/usuarios/me',
        '/usuario',
        `/usuario/${profile.usuarioId}`,
        '/auth/status',
      ];

      for (const route of routes) {
        try {
          const response = await apiFetchAuth(route);

          if (!response.ok) {
            if (response.status === 404) {
              continue;
            }

            continue;
          }

          const payload = await response.json().catch(() => null);
          const rawFotoCapa = extractFotoCapaFromPayload(payload);

          if (!rawFotoCapa) {
            continue;
          }

          const normalizedFotoCapa = normalizeImageUri(rawFotoCapa);

          if (!normalizedFotoCapa) {
            continue;
          }

          console.log('[MinhaConta] Foto capa recebida da API', {
            route,
            rawFotoCapa,
            normalizedFotoCapa,
          });

          if (!isMounted) {
            return;
          }

          setCoverPhotoUri(normalizedFotoCapa);
          return;
        } catch {
          continue;
        }
      }
    }

    void loadCoverPhotoFromApi();

    return () => {
      isMounted = false;
    };
  }, [apiCoverPhotoUri, profile.usuarioId]);

  const fetchLatestCoverPhotoFromApi = useCallback(async () => {
    const routes = [
      `/usuarios/${profile.usuarioId}/foto-capa`,
      `/usuarios/${profile.usuarioId}`,
      '/usuarios/me',
      '/usuario',
      `/usuario/${profile.usuarioId}`,
    ];

    for (const route of routes) {
      try {
        const response = await apiFetchAuth(route);

        if (!response.ok) {
          if (response.status === 404) {
            continue;
          }

          continue;
        }

        const payload = await response.json().catch(() => null);
        const rawFotoCapa = extractFotoCapaFromPayload(payload);
        const normalizedFotoCapa = normalizeImageUri(rawFotoCapa);

        if (normalizedFotoCapa) {
          return normalizedFotoCapa;
        }
      } catch {
        continue;
      }
    }

    return null;
  }, [profile.usuarioId]);

  async function handleStravaLogin() {
    try {
      setStravaFeedback(null);

      if (stravaStatus === 'connected') {
        const shouldLogout =
          Platform.OS === 'web'
            ? typeof globalThis.confirm === 'function'
              ? globalThis.confirm('Tem certeza que deseja desconectar do Strava?')
              : false
            : await new Promise<boolean>((resolve) => {
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
      setStravaFeedback('Não foi possível abrir a autenticação do Strava.');
    }
  }

  async function saveCoverPhotoOnApi(nextFotoCapa: string | null) {
    if (nextFotoCapa === null) {
      const removeRoute = `/usuarios/${profile.usuarioId}/foto-capa`;

      try {
        const response = await apiFetchAuth(removeRoute, {
          method: 'DELETE',
        });

        if (response.ok) {
          return { response, failure: null };
        }

        let failureDetails: string | null = null;

        try {
          const text = await response.text();
          failureDetails = text?.slice(0, 220) ?? null;
        } catch {
          failureDetails = null;
        }

        return {
          response,
          failure: {
            method: 'DELETE',
            route: removeRoute,
            status: response.status,
            details: failureDetails,
          },
        };
      } catch {
        return {
          response: null,
          failure: {
            method: 'DELETE',
            route: removeRoute,
            status: 0,
            details: 'network-error',
          },
        };
      }
    }

    if (nextFotoCapa) {
      const uploadRoute = `/usuarios/${profile.usuarioId}/foto-capa/upload`;
      const uploadPayloadCandidates = [
        { imageBase64: nextFotoCapa },
        { dataUrl: nextFotoCapa },
        { base64: nextFotoCapa },
      ];

      let uploadFailure: { method: string; route: string; status: number; details: string | null } | null = null;

      for (const payload of uploadPayloadCandidates) {
        try {
          const response = await apiFetchAuth(uploadRoute, {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            return { response, failure: null };
          }

          let failureDetails: string | null = null;

          try {
            const text = await response.text();
            failureDetails = text?.slice(0, 220) ?? null;
          } catch {
            failureDetails = null;
          }

          uploadFailure = {
            method: 'POST',
            route: uploadRoute,
            status: response.status,
            details: failureDetails,
          };

          if (response.status === 400 || response.status === 404 || response.status === 405 || response.status === 415 || response.status === 422) {
            continue;
          }

          return { response, failure: uploadFailure };
        } catch {
          uploadFailure = {
            method: 'POST',
            route: uploadRoute,
            status: 0,
            details: 'network-error',
          };
        }
      }

      if (uploadFailure) {
        console.log('[MinhaConta] Falha no endpoint de upload de capa, tentando fallback legado', uploadFailure);
      }
    }

    const routes = [
      '/usuario',
      `/usuario/${profile.usuarioId}`,
      '/usuarios/me',
      `/usuarios/${profile.usuarioId}`,
      '/users/me',
      `/users/${profile.usuarioId}`,
      '/auth/me',
    ];
    const methods: Array<'PATCH' | 'PUT' | 'POST'> = ['PATCH', 'PUT', 'POST'];
    const payloadCandidates = [
      { fotoCapa: nextFotoCapa, foto_capa: nextFotoCapa },
      { picture_url: nextFotoCapa, coverPhoto: nextFotoCapa },
      { profile: { fotoCapa: nextFotoCapa, foto_capa: nextFotoCapa } },
      { usuario: { fotoCapa: nextFotoCapa, foto_capa: nextFotoCapa } },
    ];

    let lastFailure: { method: string; route: string; status: number; details: string | null } | null = null;

    for (const method of methods) {
      for (const route of routes) {
        for (const payload of payloadCandidates) {
          let response: Response;

          try {
            response = await apiFetchAuth(route, {
              method,
              body: JSON.stringify(payload),
            });
          } catch {
            lastFailure = {
              method,
              route,
              status: 0,
              details: 'network-error',
            };
            continue;
          }

          if (response.ok) {
            return { response, failure: null };
          }

          let failureDetails: string | null = null;

          try {
            const text = await response.text();
            failureDetails = text?.slice(0, 220) ?? null;
          } catch {
            failureDetails = null;
          }

          lastFailure = {
            method,
            route,
            status: response.status,
            details: failureDetails,
          };

          if (response.status === 404 || response.status === 405) {
            continue;
          }

          if (response.status === 400 || response.status === 422) {
            continue;
          }

          return { response, failure: lastFailure };
        }
      }
    }

    return { response: null, failure: lastFailure };
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
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const selectedAsset = result.assets[0];
    const mimeType = selectedAsset.mimeType ?? 'image/jpeg';
    let fotoCapaPayload: string;

    if (selectedAsset.base64) {
      fotoCapaPayload = `data:${mimeType};base64,${selectedAsset.base64}`;
    } else if (selectedAsset.uri.startsWith('data:')) {
      fotoCapaPayload = selectedAsset.uri;
    } else {
      try {
        fotoCapaPayload = await convertImageUriToDataUrl(selectedAsset.uri);
      } catch {
        setCoverPhotoFeedback('Não foi possível converter a imagem para upload na API.');
        return;
      }
    }

    const nextCoverPhotoUri = normalizeImageUri(fotoCapaPayload) ?? fotoCapaPayload;

    setCoverPhotoUri(nextCoverPhotoUri);
    setCoverPhotoFeedback(null);

    try {
      const saveResult = await saveCoverPhotoOnApi(fotoCapaPayload);
      const saveResponse = saveResult.response;

      if (!saveResponse?.ok) {
        const failureInfo = saveResult.failure
          ? ` (${saveResult.failure.method} ${saveResult.failure.route} -> ${saveResult.failure.status})`
          : '';
        setCoverPhotoFeedback(`A capa foi atualizada localmente, mas não foi possível salvar na API${failureInfo}.`);
        console.log('[MinhaConta] Falha ao salvar capa na API', saveResult.failure);
        return;
      }

      const savePayload = saveResponse ? await saveResponse.json().catch(() => null) : null;
      const savedFotoCapaRaw =
        savePayload?.fotoCapa ??
        savePayload?.foto_capa ??
        savePayload?.profile?.fotoCapa ??
        savePayload?.profile?.foto_capa ??
        fotoCapaPayload;
      const savedCoverPhotoUri = normalizeImageUri(savedFotoCapaRaw) ?? savedFotoCapaRaw;

      setCoverPhotoUri(savedCoverPhotoUri);
    } catch {
      setStravaFeedback('A foto de capa foi aplicada, mas não foi possível confirmar o salvamento na API.');
    }
  }

  async function handleRemoveCoverPhoto() {
    setCoverPhotoUri(defaultCoverPhotoUri);
    setCoverPhotoFeedback(null);

    try {
      const saveResult = await saveCoverPhotoOnApi(null);
      const saveResponse = saveResult.response;

      if (!saveResponse?.ok) {
        const failureInfo = saveResult.failure
          ? ` (${saveResult.failure.method} ${saveResult.failure.route} -> ${saveResult.failure.status})`
          : '';
        setCoverPhotoFeedback(`Não foi possível limpar a capa na API${failureInfo}. Exibindo capa local padrão.`);
        console.log('[MinhaConta] Falha ao limpar capa na API', saveResult.failure);
        return;
      }

      const savePayload = saveResponse ? await saveResponse.json().catch(() => null) : null;
      const savedFotoCapaRaw =
        savePayload?.fotoCapa ??
        savePayload?.foto_capa ??
        savePayload?.profile?.fotoCapa ??
        savePayload?.profile?.foto_capa ??
        defaultCoverPhotoUri;
      const savedCoverPhotoUri = normalizeImageUri(savedFotoCapaRaw) ?? defaultCoverPhotoUri;

      setCoverPhotoUri(savedCoverPhotoUri);

      const latestCoverFromApi = await fetchLatestCoverPhotoFromApi();

      if (latestCoverFromApi && latestCoverFromApi !== defaultCoverPhotoUri) {
        setCoverPhotoUri(latestCoverFromApi);
        setCoverPhotoFeedback('A API ainda retornou uma capa personalizada após excluir.');
        return;
      }

      setCoverPhotoUri(defaultCoverPhotoUri);
    } catch {
      setStravaFeedback('A foto de capa foi removida localmente, mas não foi possível confirmar na API.');
    }
  }

  const loadPersonalData = useCallback(async () => {
    async function fetchPersonalData() {
      const routes = ['/dados-pessoais', '/dadosPessoais'];

      for (const route of routes) {
        const response = await apiFetchAuth(route);

        if (response.ok) {
          return response;
        }

        if (response.status !== 404) {
          return response;
        }
      }

      return apiFetchAuth('/dados-pessoais');
    }

    try {
      setIsLoadingPersonalData(true);
      setPersonalDataFeedback(null);

      const response = await fetchPersonalData();

      if (!response.ok) {
        setPersonalDataFeedback('Não foi possível carregar os dados pessoais.');
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
      setPersonalDataFeedback('Erro ao carregar os dados pessoais.');
    } finally {
      setIsLoadingPersonalData(false);
    }
  }, []);

  const loadLookupOptions = useCallback(async () => {
    async function loadFromRoute(route: string) {
      try {
        const response = await apiFetchAuth(route);

        if (!response.ok) {
          console.warn(`[MinhaConta] Não foi possível carregar lookup em ${route} (status ${response.status}).`);
          return { options: [] as LookupOption[], failed: true };
        }

        const payload = (await response.json()) as unknown;
        const list = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as any).items)
            ? (payload as any).items
            : payload && typeof payload === 'object' && Array.isArray((payload as any).data)
              ? (payload as any).data
              : payload && typeof payload === 'object' && Array.isArray((payload as any).results)
                ? (payload as any).results
            : [];

        const options = list
          .filter((item: any) => item && typeof item === 'object')
          .map((item: any) => {
            const raw = item as Record<string, unknown>;
            const idValue = raw.id ?? raw.uuid ?? raw.value;
            const codigoValue = raw.codigo ?? raw.code ?? raw.sigla ?? raw.tipoContato;
            const descricaoValue = raw.descricao ?? raw.nome ?? raw.label ?? raw.tipoContato ?? raw.codigo;

            return {
              id: String(idValue ?? ''),
              codigo: String(codigoValue ?? ''),
              descricao: String(descricaoValue ?? ''),
            } as LookupOption;
          })
          .filter((item: any) => item.id);

        return { options, failed: false };
      } catch {
        return { options: [] as LookupOption[], failed: true };
      }
    }

    async function loadFromRoutes(routes: string[]) {
      let hadFailure = false;

      for (const route of routes) {
        const result = await loadFromRoute(route);

        if (result.failed) {
          hadFailure = true;
        }

        if (result.options.length > 0) {
          return { options: result.options, hadFailure: false };
        }
      }

      return { options: [] as LookupOption[], hadFailure };
    }

    try {
      setIsLoadingLookupOptions(true);
      setTipoContatoLookupFeedback(null);

      const [generoResult, tiposContatoResult] = await Promise.all([
        loadFromRoute('/genero'),
        loadFromRoutes(['/tipoContato', '/tipo-contato']),
      ]);

      setGeneroOptions(generoResult.options);
      setTipoContatoOptions(tiposContatoResult.options);

      if (tiposContatoResult.options.length === 0 && tiposContatoResult.hadFailure) {
        setTipoContatoLookupFeedback('Não foi possível carregar os tipos de contato no momento.');
      }
    } finally {
      setIsLoadingLookupOptions(false);
    }
  }, []);

  async function handleSavePersonalData() {
    async function savePersonalDataWithFallback(payload: Record<string, unknown>) {
      const routeSets = personalDataId
        ? [
            `/dados-pessoais/${personalDataId}`,
            `/dadosPessoais/${personalDataId}`,
          ]
        : ['/dados-pessoais', '/dadosPessoais'];

      const method = personalDataId ? 'PUT' : 'POST';

      for (const route of routeSets) {
        const response = await apiFetchAuth(route, {
          method,
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return response;
        }

        if (response.status !== 404) {
          return response;
        }
      }

      return apiFetchAuth(routeSets[0], {
        method,
        body: JSON.stringify(payload),
      });
    }

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
        setPersonalDataFeedback('Preencha apelido, data de nascimento, gênero, altura e peso.');
        return;
      }

      const normalizedBirthDate = formatDateToApi(personalDataForm.dataNascimento.trim());

      if (!normalizedBirthDate) {
        setPersonalDataFeedback('Data de nascimento inválida. Use o calendário para selecionar a data.');
        return;
      }

      const normalizedAltura = normalizeDecimalInput(personalDataForm.altura);
      const normalizedPeso = normalizeDecimalInput(personalDataForm.peso);
      const alturaNumber = Number(normalizedAltura);
      const pesoNumber = Number(normalizedPeso);

      if (Number.isNaN(alturaNumber) || alturaNumber < 0.5 || alturaNumber > 2.5) {
        setPersonalDataFeedback('Altura inválida. Informe um valor entre 0,50 e 2,50 metros.');
        return;
      }

      if (Number.isNaN(pesoNumber) || pesoNumber < 20 || pesoNumber > 400) {
        setPersonalDataFeedback('Peso inválido. Informe um valor entre 20 e 400 kg.');
        return;
      }

      const hasAnyContato =
        personalDataForm.idTipoContato.trim() ||
        personalDataForm.contatoNome.trim() ||
        personalDataForm.contatoEmail.trim() ||
        personalDataForm.contatoTelefone.trim();

      if (hasAnyContato && !personalDataForm.idTipoContato.trim()) {
        setPersonalDataFeedback('Para salvar o contato, selecione o tipo de contato.');
        return;
      }

      if (hasAnyContato) {
        const selectedTipoContato = tipoContatoOptions.find(
          (item) => item.id === personalDataForm.idTipoContato.trim()
        ) ?? null;

        if (isEmailContactType(selectedTipoContato) && !personalDataForm.contatoEmail.trim()) {
          setPersonalDataFeedback('Para tipo de contato E-mail, preencha o e-mail.');
          return;
        }

        if (isPhoneContactType(selectedTipoContato) && !personalDataForm.contatoTelefone.trim()) {
          setPersonalDataFeedback('Para tipo de contato Telefone/WhatsApp, preencha o telefone.');
          return;
        }
      }

      const payload: Record<string, unknown> = {
        apelido: personalDataForm.apelido.trim(),
        dataNascimento: `${normalizedBirthDate}T00:00:00.000Z`,
        idGenero: personalDataForm.idGenero.trim(),
        altura: alturaNumber,
        peso: pesoNumber,
      };

      if (hasAnyContato) {
        const contatoPayload: Record<string, string> = {
          idTipoContato: personalDataForm.idTipoContato.trim(),
          nome: personalDataForm.contatoNome.trim() || '',
          email: personalDataForm.contatoEmail.trim() || '',
          telefone: toDigitsOnly(personalDataForm.contatoTelefone) || '',
        };

        payload.listaContato = [contatoPayload];
      }

      const response = await savePersonalDataWithFallback(payload);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const errorPayload = (() => {
          if (!errorText) {
            return null;
          }

          try {
            return JSON.parse(errorText) as any;
          } catch {
            return null;
          }
        })();

        const message =
          typeof errorPayload?.error === 'string'
            ? errorPayload.error
            : typeof errorPayload?.message === 'string'
              ? errorPayload.message
              : Array.isArray(errorPayload?.message)
                ? String(errorPayload.message[0] ?? '') || 'Não foi possível salvar os dados pessoais.'
                : typeof errorPayload?.details === 'string'
                  ? errorPayload.details
                  : errorText || 'Não foi possível salvar os dados pessoais.';
        setPersonalDataFeedback(message || `Não foi possível salvar os dados pessoais (status ${response.status}).`);
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
      setPersonalDataFeedback('Dados pessoais salvos com sucesso.');
    } catch {
      setPersonalDataFeedback('Erro ao salvar os dados pessoais.');
    } finally {
      setIsSavingPersonalData(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setChangePasswordFeedback('Preencha a senha atual, a nova senha e a confirmação.');
      return;
    }

    if (newPassword.trim().length < 6) {
      setChangePasswordFeedback('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangePasswordFeedback('A confirmação da nova senha não confere.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setChangePasswordFeedback(null);

      const payload = await changePasswordLocal({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setChangePasswordFeedback(payload?.message ?? 'Senha alterada com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível alterar a senha.';
      setChangePasswordFeedback(message);
    } finally {
      setIsChangingPassword(false);
    }
  }

  function openPersonalDataScreen() {
    setAccountView('personal-data');
    void loadPersonalData();
    void loadLookupOptions();
  }

  function handleBirthDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android' || Platform.OS === 'web') {
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

  const selectedTipoContatoForUi =
    tipoContatoOptions.find((item) => item.id === personalDataForm.idTipoContato.trim()) ?? null;
  const isContatoEmailRequired = isEmailContactType(selectedTipoContatoForUi);
  const isContatoTelefoneRequired = isPhoneContactType(selectedTipoContatoForUi);

  return (
    <ScrollView style={styles.profileScreen} contentContainerStyle={styles.profileContent}>
      {accountView === 'menu' ? (
        <>
          <View style={styles.coverPhotoContainer}>
            <Pressable
              onPress={handleSelectCoverPhoto}
              style={({ pressed }) => [styles.coverPhotoTouchArea, pressed && styles.coverPhotoTouchAreaPressed]}>
              {coverPhotoUri ? (
                <Image
                  source={{ uri: coverPhotoUri }}
                  style={styles.coverPhotoImage}
                  onError={(event) => {
                    const nativeError = (event.nativeEvent as any)?.error;
                    const currentCoverUri = (coverPhotoUri ?? '').trim();
                    const isUsingLocalCover = /^(data:|blob:|file:|content:)/i.test(currentCoverUri);

                    if (isUsingLocalCover) {
                      setCoverPhotoUri(apiCoverPhotoUri);
                      setCoverPhotoFeedback('A capa local falhou; exibindo capa padrão da API.');
                    } else {
                      const message = `Falha ao carregar capa (${nativeError ?? 'erro desconhecido'}). URL: ${coverPhotoUri}`;
                      setCoverPhotoFeedback(message);
                    }

                    const message = `Falha ao carregar capa (${nativeError ?? 'erro desconhecido'}). URL: ${coverPhotoUri}`;
                    console.log('[MinhaConta] Erro ao carregar capa', {
                      coverPhotoUri,
                      apiCoverPhotoUri,
                      isUsingLocalCover,
                      nativeError,
                      message,
                    });
                  }}
                />
              ) : (
                <View style={styles.coverPhotoPlaceholder}>
                  <Ionicons name="image-outline" size={28} color="#6B7280" />
                  <Text style={styles.coverPhotoPlaceholderText}>Selecionar foto de capa</Text>
                </View>
              )}
            </Pressable>

            {coverPhotoFeedback ? <Text style={styles.profileFeedback}>{coverPhotoFeedback}</Text> : null}

            {isCustomCoverPhoto ? (
              <Pressable
                onPress={handleRemoveCoverPhoto}
                style={({ pressed }) => [styles.removeCoverIconButton, pressed && styles.removeCoverIconButtonPressed]}>
                <Ionicons name="close" size={16} color="#111827" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.profileHeaderBlock}>
            {profile.picture ? (
              <Image
                source={{ uri: profile.picture }}
                style={styles.avatar}
                onError={() => {
                  // Remove a imagem se não carregar
                  profile.picture = null;
                }}
              />
            ) : (
              <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}> 
                <Ionicons name="person-circle-outline" size={48} color="#9CA3AF" />
              </View>
            )}
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

            <Pressable
              onPress={() => {
                setAccountView('change-password');
                setChangePasswordFeedback(null);
              }}
              style={({ pressed }) => [styles.accountMenuItem, pressed && styles.accountMenuItemPressed]}>
              <Text style={styles.accountMenuText}>Trocar senha</Text>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.signOutLinkContainer}>
            <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutLinkPressable, pressed && styles.signOutLinkPressed]}>
              <Text style={styles.signOutLinkText}>Sair</Text>
            </Pressable>
          </View>

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

          {/* Botão para sincronizar dados da bike e percursos do Strava */}
          <Pressable
            onPress={async () => {
              setStravaFeedback(null);
              setStravaFeedback('Sincronizando bikes do Strava...');
              try {
                const bikesResponse = await apiFetchAuth('/strava/gear/bikes/sync', { method: 'POST' });
                if (bikesResponse.ok) {
                  setStravaFeedback('Bikes sincronizadas com sucesso! Agora sincronizando percursos...');
                  const activitiesResponse = await apiFetchAuth('/strava/activities/sync', { method: 'POST' });
                  if (activitiesResponse.ok) {
                    setStravaFeedback('Bikes e percursos sincronizados com sucesso!');
                    void loadStravaStatus();
                  } else {
                    setStravaFeedback('Bikes sincronizadas, mas falha ao sincronizar percursos.');
                  }
                } else {
                  setStravaFeedback('Falha ao sincronizar bikes do Strava.');
                }
              } catch {
                setStravaFeedback('Erro de rede ao sincronizar com o Strava.');
              }
            }}
            style={({ pressed }) => [styles.stravaButton, pressed && styles.stravaButtonPressed, { marginTop: 12 }]}
          >
            <Text style={styles.stravaButtonText}>Sincronizar dados do Strava</Text>
          </Pressable>

          {stravaFeedback ? <Text style={styles.profileFeedback}>{stravaFeedback}</Text> : null}
        </View>
      ) : accountView === 'change-password' ? (
        <View style={styles.connectedAppsScreen}>
          <View style={styles.connectedAppsHeader}>
            <Pressable onPress={() => setAccountView('menu')} style={styles.connectedAppsBackButton}>
              <Ionicons name="chevron-back" size={20} color="#111827" />
            </Pressable>
            <Text style={styles.connectedAppsTitle}>Trocar senha</Text>
          </View>

          <View style={styles.personalDataFormContainer}>
            <View style={styles.personalDataFieldBlock}>
              <Text style={styles.personalDataFieldLabel}>Senha atual</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.personalDataInput}
                placeholder="Digite sua senha atual"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.personalDataFieldBlock}>
              <Text style={styles.personalDataFieldLabel}>Nova senha</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.personalDataInput}
                placeholder="Digite a nova senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.personalDataInfoText}>Mínimo de 6 caracteres.</Text>
            </View>

            <View style={styles.personalDataFieldBlock}>
              <Text style={styles.personalDataFieldLabel}>Confirmar nova senha</Text>
              <TextInput
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                style={styles.personalDataInput}
                placeholder="Repita a nova senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Pressable
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              style={({ pressed }) => [
                styles.personalDataSaveButton,
                pressed && styles.personalDataSaveButtonPressed,
                isChangingPassword && styles.personalDataSaveButtonDisabled,
              ]}>
              <Text style={styles.personalDataSaveButtonText}>
                {isChangingPassword ? 'Alterando...' : 'Salvar nova senha'}
              </Text>
            </Pressable>

            {changePasswordFeedback ? <Text style={styles.profileFeedback}>{changePasswordFeedback}</Text> : null}
          </View>
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
                <Text style={styles.personalDataFieldLabel}>Apelido</Text>
                <TextInput
                  value={personalDataForm.apelido}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, apelido: text }))}
                  style={styles.personalDataInput}
                  placeholder="Informe o apelido"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>Data de nascimento (dd/MM/yyyy)</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webDatePickerBlock}>
                    <TextInput
                      value={personalDataForm.dataNascimento}
                      onChangeText={(text) =>
                        setPersonalDataForm((prev) => ({
                          ...prev,
                          dataNascimento: formatDateInputMask(text),
                        }))
                      }
                      onBlur={() => {
                        const parsedDate = parseDisplayDate(personalDataForm.dataNascimento.trim());

                        if (parsedDate) {
                          setBirthDatePickerValue(parsedDate);
                          setPersonalDataForm((prev) => ({
                            ...prev,
                            dataNascimento: formatDateFromPicker(parsedDate),
                          }));
                        }
                      }}
                      style={styles.personalDataInput}
                      placeholder="dd/MM/yyyy"
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.personalDataInfoText}>No web, informe manualmente no formato dd/MM/yyyy.</Text>
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
                <Text style={styles.personalDataFieldLabel}>Gênero</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    enabled={!isLoadingLookupOptions && generoOptions.length > 0}
                    selectedValue={personalDataForm.idGenero}
                    onValueChange={(value) => setPersonalDataForm((prev) => ({ ...prev, idGenero: String(value ?? '') }))}>
                    {isLoadingLookupOptions ? (
                      <Picker.Item label="Carregando opções de gênero..." value="" />
                    ) : generoOptions.length > 0 ? (
                      <>
                        <Picker.Item label="Selecione" value="" />
                        {generoOptions.map((item) => (
                          <Picker.Item key={item.id} label={item.descricao || item.codigo} value={item.id} />
                        ))}
                      </>
                    ) : (
                      <Picker.Item label="Nenhuma opção de gênero disponível" value="" />
                    )}
                  </Picker>
                </View>
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>Altura</Text>
                <TextInput
                  value={personalDataForm.altura}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, altura: text }))}
                  style={styles.personalDataInput}
                  placeholder="Ex.: 1.75"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.personalDataInfoText}>Faixa permitida: 0,50 a 2,50 m.</Text>
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>Peso</Text>
                <TextInput
                  value={personalDataForm.peso}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, peso: text }))}
                  style={styles.personalDataInput}
                  placeholder="Ex.: 72.5"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.personalDataInfoText}>Faixa permitida: 20 a 400 kg.</Text>
              </View>

              <Text style={styles.personalDataSectionTitle}>Contato (opcional)</Text>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>Tipo de contato</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    enabled={!isLoadingLookupOptions && tipoContatoOptions.length > 0}
                    selectedValue={personalDataForm.idTipoContato}
                    onValueChange={(value) => setPersonalDataForm((prev) => ({ ...prev, idTipoContato: String(value ?? '') }))}>
                    {isLoadingLookupOptions ? (
                      <Picker.Item label="Carregando tipos de contato..." value="" />
                    ) : tipoContatoOptions.length > 0 ? (
                      <>
                        <Picker.Item label="Selecione" value="" />
                        {tipoContatoOptions.map((item) => (
                          <Picker.Item key={item.id} label={item.descricao || item.codigo} value={item.id} />
                        ))}
                      </>
                    ) : (
                      <Picker.Item label="Nenhum tipo de contato disponível" value="" />
                    )}
                  </Picker>
                </View>

                {tipoContatoLookupFeedback ? (
                  <>
                    <Text style={styles.personalDataInfoText}>{tipoContatoLookupFeedback}</Text>
                    <Pressable
                      onPress={() => {
                        void loadLookupOptions();
                      }}
                      disabled={isLoadingLookupOptions}
                      style={({ pressed }) => [
                        styles.retryLookupButton,
                        pressed && styles.retryLookupButtonPressed,
                        isLoadingLookupOptions && styles.retryLookupButtonDisabled,
                      ]}>
                      <Text style={styles.retryLookupButtonText}>
                        {isLoadingLookupOptions ? 'Tentando novamente...' : 'Tentar novamente'}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                <Text style={styles.personalDataInfoText}>
                  Tipo define qual campo é obrigatório.
                </Text>
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>Nome</Text>
                <TextInput
                  value={personalDataForm.contatoNome}
                  onChangeText={(text) => setPersonalDataForm((prev) => ({ ...prev, contatoNome: text }))}
                  style={styles.personalDataInput}
                  placeholder="Nome do contato"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.personalDataFieldBlock}>
                <Text style={styles.personalDataFieldLabel}>
                  {isContatoEmailRequired ? 'Email * (obrigatório)' : 'Email'}
                </Text>
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
                <Text style={styles.personalDataFieldLabel}>
                  {isContatoTelefoneRequired ? 'Telefone * (obrigatório)' : 'Telefone'}
                </Text>
                <TextInput
                  value={personalDataForm.contatoTelefone}
                  onChangeText={(text) =>
                    setPersonalDataForm((prev) => ({
                      ...prev,
                      contatoTelefone: formatPhoneInputMask(text),
                    }))
                  }
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
  bikeDetailScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bikeDetailContent: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
  },
  bikeDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bikeDetailBackButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  bikeDetailBackButtonPressed: {
    opacity: 0.7,
  },
  bikeDetailHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  bikeDetailBikeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
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
  bikeCardPressed: {
    opacity: 0.85,
  },
  syncBikeButton: {
    marginTop: 10,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  syncBikeButtonPressed: {
    opacity: 0.85,
  },
  syncBikeButtonDisabled: {
    opacity: 0.7,
  },
  syncBikeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  syncBikeFeedback: {
    marginTop: 8,
    fontSize: 12,
    color: '#374151',
  },
  resumoCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  resumoSectionTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  resumoMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  resumoMetricItem: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  resumoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  resumoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
  bikeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bikeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  retryLookupButton: {
    marginTop: 8,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLookupButtonPressed: {
    opacity: 0.85,
  },
  retryLookupButtonDisabled: {
    opacity: 0.7,
  },
  retryLookupButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
    width: '100%',
    alignItems: 'flex-start',
    marginTop: -42,
    paddingLeft: 12,
    paddingRight: 12,
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
  syncBikeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FC4C02',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaSyncIcon: {
    width: 16,
    height: 16,
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
  signOutLinkContainer: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  signOutLinkPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  signOutLinkPressed: {
    opacity: 0.7,
  },
  signOutLinkText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
  },
});