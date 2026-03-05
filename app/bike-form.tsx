import { Picker } from '@react-native-picker/picker';
import { useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type BikeFormParams = {
  id?: string;
  ativo?: boolean;
  apelido?: string;
  totalKm?: number;
  principal?: boolean;
  cor?: string;
  tamanhoRoda?: number;
  ano?: number;
  peso?: number;
  numeroSerie?: string;
  visivel?: boolean;
  marcaId?: string;
  modelo?: string;
  tipoBikeId?: string;
};

import { useLocalSearchParams } from 'expo-router';


import { apiFetchAuth } from '@/services/api-client';

type TipoBike = { id: string; descricao: string; sigla?: string };
type Marca = { id: string; nome: string };

export default function BikeFormScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams() as Partial<BikeFormParams>;

  const [ativo, setAtivo] = useState(params.ativo ?? true);
  const [apelido, setApelido] = useState(params.apelido || '');
  const [totalKm, setTotalKm] = useState(params.totalKm ? String(params.totalKm) : '');
  const [principal, setPrincipal] = useState(
    params.principal === true
      ? true
      : false
  );
  const [cor, setCor] = useState(params.cor || '');
  const [tamanhoRoda, setTamanhoRoda] = useState(params.tamanhoRoda ? String(params.tamanhoRoda) : '');
  const [ano, setAno] = useState(params.ano ? String(params.ano) : '');
  const [peso, setPeso] = useState(params.peso ? String(params.peso) : '');
  const [numeroSerie, setNumeroSerie] = useState(params.numeroSerie ?? null);
  const [visivel, setVisivel] = useState(params.visivel ?? true);
  const [marcaId, setMarcaId] = useState(params.marcaId || '');
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [marcasLoading, setMarcasLoading] = useState(false);
  const [modelo, setModelo] = useState(params.modelo || '');
  const [tipoBikeId, setTipoBikeId] = useState(params.tipoBikeId || '');
  const [tiposBike, setTiposBike] = useState<TipoBike[]>([]);
  const [tiposLoading, setTiposLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setTiposLoading(true);
    apiFetchAuth('/tipoBike')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted && Array.isArray(data)) setTiposBike(data);
      })
      .finally(() => { if (isMounted) setTiposLoading(false); });

    setMarcasLoading(true);
    apiFetchAuth('/marca')
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          Alert.alert('Erro ao buscar marcas', errorText);
          return;
        }
        const data = await response.json();
        if (isMounted && Array.isArray(data)) setMarcas(data);
      })
      .finally(() => { if (isMounted) setMarcasLoading(false); });

    return () => { isMounted = false; };
  }, []);
  const isEdit = Boolean(params.id);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!apelido.trim()) {
      Alert.alert('Preencha o apelido da bike.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ativo: Boolean(ativo),
        apelido,
        totalKm: totalKm ? Number(totalKm) : null,
        principal: Boolean(principal),
        cor,
        tamanhoRoda: tamanhoRoda ? parseFloat(tamanhoRoda.replace(',', '.')) : null,
        ano: ano ? Number(ano) : null,
        peso: peso ? Number(peso) : null,
        numeroSerie: numeroSerie || null,
        visivel: Boolean(visivel),
        marcaId: !marcaId || marcaId === 'null' ? null : marcaId,
        modelo: modelo || null,
        tipoBikeId: !tipoBikeId || tipoBikeId === 'null' ? null : tipoBikeId,
      };
      // Exibe o payload enviado em um alerta para debug
      Alert.alert('Payload enviado', JSON.stringify(payload, null, 2));
      let response;
      if (isEdit && params.id) {
        response = await apiFetchAuth(`/bikes/${params.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiFetchAuth('/bikes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      let responseBody = '';
      try {
        responseBody = await response.text();
        // Exibe a resposta da API em um alerta para debug
        Alert.alert('Resposta da API', `Status: ${response.status}\n${responseBody}`);
      } catch (e) {
        Alert.alert('Erro ao ler resposta da API', String(e));
      }
      if (!response.ok) {
        Alert.alert('Erro ao salvar bike', responseBody || 'Erro desconhecido');
        setLoading(false);
        return;
      }
      setLoading(false);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro ao salvar bike', err?.message || 'Erro desconhecido');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{apelido.trim() ? apelido : (isEdit ? 'Bike' : 'Nova Bike')}</Text>
      <Text style={styles.label}>Apelido</Text>
      <TextInput style={styles.input} value={apelido} onChangeText={setApelido} placeholder="Nome da bike" />

      <Text style={styles.label}>Quilometragem total</Text>
      <TextInput style={styles.input} value={totalKm} onChangeText={setTotalKm} placeholder="Ex: 1234.5" keyboardType="numeric" />

      <Text style={styles.label}>Cor</Text>
      <TextInput style={styles.input} value={cor} onChangeText={setCor} placeholder="Cor da bike" />

      <Text style={styles.label}>Tamanho da roda</Text>
      <TextInput
        style={styles.input}
        value={tamanhoRoda}
        onChangeText={setTamanhoRoda}
        placeholder="Ex: 29.5"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Ano</Text>
      <TextInput style={styles.input} value={ano} onChangeText={setAno} placeholder="Ex: 2022" keyboardType="numeric" />

      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput style={styles.input} value={peso} onChangeText={setPeso} placeholder="Ex: 12.5" keyboardType="numeric" />

      <Text style={styles.label}>Número de série</Text>
      <TextInput style={styles.input} value={numeroSerie ?? ''} onChangeText={setNumeroSerie} placeholder="Número de série" />

      <View style={styles.checkRow}>
        <CheckBox label="Ativo" checked={ativo} onChange={setAtivo} />
        <CheckBox label="Principal" checked={principal} onChange={setPrincipal} />
        <CheckBox label="Visível" checked={visivel} onChange={setVisivel} />
      </View>
      <Text style={styles.label}>Marca</Text>
      <View style={styles.input}>
        <Picker
          selectedValue={marcaId}
          onValueChange={setMarcaId}
          enabled={!marcasLoading}
        >
          <Picker.Item label={marcasLoading ? 'Carregando...' : 'Selecione a marca'} value="" />
          {marcas.map((marca) => (
            <Picker.Item key={marca.id} label={marca.nome} value={marca.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Modelo</Text>
      <TextInput style={styles.input} value={modelo} onChangeText={setModelo} placeholder="Modelo da bike" />

          <Text style={styles.label}>Tipo de Bike</Text>
          <View style={styles.input}>
            <Picker
              selectedValue={tipoBikeId}
              onValueChange={setTipoBikeId}
              enabled={!tiposLoading}
            >
              <Picker.Item label={tiposLoading ? 'Carregando...' : 'Selecione o tipo'} value="" />
              {tiposBike.map((tipo) => (
                <Picker.Item key={tipo.id} label={tipo.descricao} value={tipo.id} />
              ))}
            </Picker>
          </View>
      <View style={styles.buttonRow}>
        <Button title="Salvar" onPress={handleSave} disabled={loading} />
        <Button title="Cancelar" onPress={() => navigation.goBack()} color="#888" />
      </View>
    </View>
  );
}

function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      style={styles.checkBox}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkIcon, checked && styles.checkIconChecked]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginTop: 12,
      marginBottom: 8,
    },
    checkBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    checkIcon: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: '#2563eb',
      backgroundColor: '#fff',
      marginRight: 4,
    },
    checkIconChecked: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
    },
    checkLabel: {
      fontSize: 15,
      color: '#222',
      fontWeight: '500',
    },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 16,
  },
});
