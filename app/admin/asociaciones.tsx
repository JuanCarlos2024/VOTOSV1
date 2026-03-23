import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';

type Asociacion = {
  id: string;
  nombre_usuario: string;
  id_usuario: string;
  votos_disponibles: number;
};

export default function AsociacionesScreen() {
  const [lista, setLista] = useState<Asociacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_usuario, id_usuario, votos_disponibles')
      .eq('rol', 'presidente')
      .order('nombre_usuario');
    setLista((data ?? []) as Asociacion[]);
    setCargando(false);
  }

  function renderItem({ item, index }: { item: Asociacion; index: number }) {
    return (
      <View style={styles.fila}>
        <View style={styles.filaNumero}>
          <Text style={styles.numero}>{index + 1}</Text>
        </View>
        <View style={styles.filaInfo}>
          <Text style={styles.nombre}>{item.nombre_usuario}</Text>
          <Text style={styles.detalle}>
            ID: {item.id_usuario} · {item.votos_disponibles} voto{item.votos_disponibles !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.btnEditar}
          onPress={() =>
            router.push(
              `/admin/editar-asociacion?id=${item.id}&nombre=${encodeURIComponent(item.nombre_usuario)}&id_usuario=${item.id_usuario}&votos=${item.votos_disponibles}`
            )
          }
          activeOpacity={0.8}
        >
          <Text style={styles.btnEditarTxt}>Editar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cargando && lista.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.azul} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btnNueva}
        onPress={() => router.push('/admin/nueva-asociacion')}
        activeOpacity={0.8}
      >
        <Text style={styles.btnNuevaTxt}>+ Nueva Asociación</Text>
      </TouchableOpacity>

      <Text style={styles.conteo}>
        {lista.length} asociación{lista.length !== 1 ? 'es' : ''} registrada{lista.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={lista}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text style={styles.vacioIcono}>👥</Text>
            <Text style={styles.vacioTxt}>No hay asociaciones registradas</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 16, paddingTop: 16 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo },

  btnNueva: {
    backgroundColor: C.azul,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 60,
  },
  btnNuevaTxt: { color: C.blanco, fontWeight: '800', fontSize: 18, letterSpacing: 1 },

  conteo: {
    fontSize: 12,
    fontWeight: '700',
    color: C.txtTercero,
    letterSpacing: 1,
    marginBottom: 12,
  },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.tarjeta,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borde,
    gap: 12,
  },
  filaNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { color: C.blanco, fontSize: 14, fontWeight: '800' },
  filaInfo: { flex: 1, gap: 4 },
  nombre: { fontSize: 18, fontWeight: '700', color: C.txtPrimario },
  detalle: { fontSize: 13, color: C.txtSecundario },

  btnEditar: {
    backgroundColor: C.azul,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnEditarTxt: { color: C.blanco, fontWeight: '800', fontSize: 14 },

  vacio: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vacioIcono: { fontSize: 48 },
  vacioTxt: { fontSize: 18, color: C.txtSecundario, fontWeight: '700' },
});
