import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { exportarResultadosPDF, exportarResumenGeneralPDF } from '../../lib/pdf';
import { supabase } from '../../lib/supabase';
import type { Pregunta } from '../../lib/supabase';
import { C } from '../../lib/theme';

export default function HistorialScreen() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);
  const [exportandoResumen, setExportandoResumen] = useState(false);

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

  async function exportarResumen() {
    setExportandoResumen(true);
    try {
      await exportarResumenGeneralPDF();
    } finally {
      setExportandoResumen(false);
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
      <View style={[styles.tarjeta, item.unanimidad && styles.tarjetaUnanimidad]}>
        <View style={styles.topRow}>
          <View style={[styles.tipoBadge, { backgroundColor: item.tipo === 'eleccion' ? '#6D28D9' : '#1E40AF' }]}>
            <Text style={styles.badgeTexto}>{item.tipo.toUpperCase()}</Text>
          </View>
          {item.unanimidad && (
            <View style={styles.unanimidadBadge}>
              <Text style={styles.unanimidadBadgeTxt}>✅ UNANIMIDAD</Text>
            </View>
          )}
          <Text style={styles.fecha}>{formatFecha(item.created_at)}</Text>
        </View>

        <Text style={styles.preguntaTexto}>{item.texto}</Text>
        {item.unanimidad && (
          <Text style={styles.unanimidadNota}>
            Esta votación fue aprobada por unanimidad por el administrador
          </Text>
        )}

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
        <View style={styles.headerRow}>
          <Text style={styles.titulo}>
            {preguntas.length} votación{preguntas.length !== 1 ? 'es' : ''} cerrada{preguntas.length !== 1 ? 's' : ''}
          </Text>
          {preguntas.length > 0 && (
            <TouchableOpacity
              style={[styles.btnResumen, exportandoResumen && { opacity: 0.6 }]}
              onPress={exportarResumen}
              disabled={exportandoResumen}
              activeOpacity={0.8}
            >
              {exportandoResumen
                ? <ActivityIndicator color={C.blanco} size="small" />
                : <Text style={styles.btnResumenTxt}>📄 Resumen Completo</Text>
              }
            </TouchableOpacity>
          )}
        </View>
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
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8,
  },
  titulo: {
    fontSize: 13, fontWeight: '800', color: C.txtSecundario, letterSpacing: 1,
  },
  btnResumen: {
    backgroundColor: '#065F46', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', minHeight: 40,
  },
  btnResumenTxt: { color: C.blanco, fontWeight: '800', fontSize: 13 },
  tarjeta: {
    backgroundColor: C.blanco, borderRadius: 14, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, gap: 10,
  },
  tarjetaUnanimidad: {
    borderLeftWidth: 4, borderLeftColor: '#F9A825',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { color: C.blanco, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  unanimidadBadge: {
    backgroundColor: '#F9A825', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  unanimidadBadgeTxt: { color: '#1A1A00', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  unanimidadNota: {
    fontSize: 13, color: '#78350F', backgroundColor: '#FEF9C3',
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F9A825', lineHeight: 18,
  },
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
