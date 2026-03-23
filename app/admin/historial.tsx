import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { exportarResultadosPDF } from '../../lib/pdf';
import { supabase } from '../../lib/supabase';
import type { Pregunta } from '../../lib/supabase';
import { C } from '../../lib/theme';

export default function HistorialScreen() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('preguntas')
      .select('*')
      .eq('estado', 'cerrada')
      .order('created_at', { ascending: false });
    setPreguntas((data ?? []) as Pregunta[]);
    setCargando(false);
  }

  async function exportarPDF(pregunta: Pregunta) {
    setExportando(pregunta.id);
    try {
      await exportarResultadosPDF(pregunta);
    } finally {
      setExportando(null);
    }
  }

  function verResultados(pregunta: Pregunta) {
    router.push(
      `/admin/resultados?id=${pregunta.id}&texto=${encodeURIComponent(pregunta.texto)}&tipo=${pregunta.tipo}`
    );
  }

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderItem({ item }: { item: Pregunta }) {
    return (
      <View style={styles.tarjeta}>
        <View style={styles.topRow}>
          <View style={[styles.tipoBadge, { backgroundColor: item.tipo === 'eleccion' ? '#6D28D9' : '#1E40AF' }]}>
            <Text style={styles.badgeTexto}>{item.tipo.toUpperCase()}</Text>
          </View>
          <Text style={styles.fecha}>{formatFecha(item.created_at)}</Text>
        </View>

        <Text style={styles.preguntaTexto}>{item.texto}</Text>

        <View style={styles.acciones}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#1E3A8A' }]}
            onPress={() => verResultados(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnTexto}>📊 Ver Resultados</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#065F46' }]}
            onPress={() => exportarPDF(item)}
            disabled={exportando === item.id}
            activeOpacity={0.8}
          >
            {exportando === item.id ? (
              <ActivityIndicator color={C.blanco} size="small" />
            ) : (
              <Text style={styles.btnTexto}>📄 Exportar PDF</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cargando && preguntas.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.azul} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={preguntas}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />
      }
      contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
      ListHeaderComponent={
        <Text style={styles.titulo}>
          {preguntas.length} votación{preguntas.length !== 1 ? 'es' : ''} cerrada{preguntas.length !== 1 ? 's' : ''}
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.vacio}>
          <Text style={styles.vacioIcono}>📁</Text>
          <Text style={styles.vacioTexto}>Sin historial aún</Text>
          <Text style={styles.vacioSub}>Las votaciones cerradas aparecerán aquí</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 16 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.fondo },
  titulo: {
    fontSize: 13, fontWeight: '800', color: C.txtSecundario,
    letterSpacing: 1, marginBottom: 14,
  },
  tarjeta: {
    backgroundColor: C.tarjeta, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: C.borde, gap: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { color: C.blanco, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  fecha: { fontSize: 12, color: C.txtTercero },
  preguntaTexto: { fontSize: 15, fontWeight: '700', color: C.txtPrimario, lineHeight: 21 },
  acciones: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', minHeight: 46 },
  btnTexto: { color: C.blanco, fontWeight: '700', fontSize: 13 },
  vacio: { alignItems: 'center', paddingTop: 80 },
  vacioIcono: { fontSize: 48, marginBottom: 12 },
  vacioTexto: { color: C.txtPrimario, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  vacioSub: { color: C.txtSecundario, fontSize: 14 },
});
