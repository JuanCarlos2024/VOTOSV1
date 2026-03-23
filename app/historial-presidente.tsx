import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { obtenerUsuario } from '../lib/auth';
import type { Usuario } from '../lib/supabase';
import { C } from '../lib/theme';
import { exportarHistorialPresidentePDF, type EntradaHistorial } from '../lib/pdf';

const COLOR_REG: Record<string, string> = {
  Apruebo: '#16A34A',
  Rechazo: '#DC2626',
  Abstengo: '#9CA3AF',
};

export default function HistorialPresidenteScreen() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const u = await obtenerUsuario();
    if (!u) { router.replace('/'); return; }
    setUsuario(u);

    // Fetch all votes for this user
    const { data: votos } = await supabase
      .from('votos')
      .select('respuesta, peso, created_at, pregunta_id')
      .eq('usuario_id', u.id)
      .order('created_at', { ascending: false });

    if (!votos || votos.length === 0) {
      setHistorial([]);
      setCargando(false);
      return;
    }

    // Get unique pregunta_ids
    const preguntaIds = [...new Set(votos.map((v: any) => v.pregunta_id))];

    // Fetch all those preguntas
    const { data: preguntas } = await supabase
      .from('preguntas')
      .select('id, texto, tipo, estado')
      .in('id', preguntaIds);

    // Group votes by pregunta
    // respuesta = candidato name (for eleccion) or Apruebo/Rechazo/Abstengo (for reglamento)
    const grouped: Record<string, EntradaHistorial> = {};
    for (const v of votos) {
      const preg = (preguntas ?? []).find((p: any) => p.id === v.pregunta_id);
      if (!preg) continue;
      if (!grouped[v.pregunta_id]) {
        grouped[v.pregunta_id] = {
          pregunta_id: v.pregunta_id,
          pregunta_texto: preg.texto,
          pregunta_tipo: preg.tipo,
          pregunta_estado: preg.estado,
          fecha: v.created_at,
          respuestas: [],
          candidatosNombres: [],
          peso: v.peso ?? 1,
        };
      }
      grouped[v.pregunta_id].respuestas.push(v.respuesta);
      if (preg.tipo === 'eleccion' && v.respuesta) {
        grouped[v.pregunta_id].candidatosNombres.push(v.respuesta);
      }
    }

    setHistorial(Object.values(grouped));
    setCargando(false);
  }

  async function exportarPDF() {
    if (!usuario || historial.length === 0) {
      Alert.alert('Sin datos', 'No hay votaciones en el historial para exportar.');
      return;
    }
    setExportando(true);
    try {
      await exportarHistorialPresidentePDF(usuario, historial);
    } finally {
      setExportando(false);
    }
  }

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  function renderItem({ item }: { item: EntradaHistorial }) {
    const esReglamento = item.pregunta_tipo === 'reglamento';
    const respuestaUnica = item.respuestas[0] ?? '';
    const colorResp = esReglamento ? (COLOR_REG[respuestaUnica] ?? C.txtSecundario) : C.azul;

    return (
      <View style={[
        styles.tarjeta,
        item.pregunta_estado === 'activa' && styles.tarjetaActiva,
      ]}>
        {/* Badges */}
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: item.pregunta_tipo === 'eleccion' ? '#6D28D9' : '#1E40AF' }]}>
            <Text style={styles.badgeTxt}>{item.pregunta_tipo.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, {
            backgroundColor: item.pregunta_estado === 'activa' ? '#16A34A' :
              item.pregunta_estado === 'cerrada' ? '#6B7280' : '#D97706'
          }]}>
            <Text style={styles.badgeTxt}>{item.pregunta_estado.toUpperCase()}</Text>
          </View>
          <Text style={styles.fecha}>{formatFecha(item.fecha)}</Text>
        </View>

        {/* Pregunta */}
        <Text style={styles.preguntaTxt}>{item.pregunta_texto}</Text>

        {/* Respuesta */}
        <View style={styles.respuestaBox}>
          {esReglamento ? (
            <>
              <Text style={styles.respuestaLabel}>TU VOTO</Text>
              <Text style={[styles.respuestaValor, { color: colorResp }]}>
                {respuestaUnica.toUpperCase()}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.respuestaLabel}>CANDIDATOS SELECCIONADOS</Text>
              {item.candidatosNombres.map((nombre, i) => (
                <View key={i} style={styles.candidatoFila}>
                  <Text style={styles.candidatoDot}>✓</Text>
                  <Text style={[styles.candidatoNombre, { color: C.azul }]}>{nombre}</Text>
                </View>
              ))}
              {item.candidatosNombres.length === 0 && (
                <Text style={styles.respuestaValor}>{item.respuestas.length} candidato(s)</Text>
              )}
            </>
          )}
          <Text style={styles.pesoTxt}>Peso emitido: {item.peso} voto(s)</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Export button */}
      {historial.length > 0 && (
        <TouchableOpacity
          style={[styles.btnExportar, exportando && { opacity: 0.6 }]}
          onPress={exportarPDF}
          disabled={exportando}
          activeOpacity={0.8}
        >
          {exportando
            ? <ActivityIndicator color={C.blanco} />
            : <Text style={styles.btnExportarTxt}>📄 Exportar mi historial</Text>
          }
        </TouchableOpacity>
      )}

      <FlatList
        data={historial}
        keyExtractor={item => item.pregunta_id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          historial.length > 0 ? (
            <Text style={styles.conteo}>
              {historial.length} votación{historial.length !== 1 ? 'es' : ''} participada{historial.length !== 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !cargando ? (
            <View style={styles.vacio}>
              <Text style={styles.vacioIcono}>📭</Text>
              <Text style={styles.vacioTxt}>Aún no has participado en ninguna votación</Text>
              <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={styles.btnVolverTxt}>Volver</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.centro}>
              <ActivityIndicator color={C.azul} size="large" />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 16, paddingTop: 16 },
  centro: { paddingTop: 60, alignItems: 'center' },

  btnExportar: {
    backgroundColor: C.azul,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 60,
  },
  btnExportarTxt: { color: C.blanco, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },

  conteo: {
    fontSize: 12, fontWeight: '700', color: C.txtTercero,
    letterSpacing: 1, marginBottom: 12,
  },

  tarjeta: {
    backgroundColor: C.tarjeta, borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: C.borde, gap: 12,
  },
  tarjetaActiva: { borderColor: '#16A34A', borderWidth: 2 },

  badgesRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { color: C.blanco, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  fecha: { fontSize: 12, color: C.txtTercero, flex: 1, textAlign: 'right' },

  preguntaTxt: { fontSize: 18, fontWeight: '700', color: C.txtPrimario, lineHeight: 26 },

  respuestaBox: {
    backgroundColor: C.blanco, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.borde, gap: 8,
  },
  respuestaLabel: {
    fontSize: 10, fontWeight: '800', color: C.txtTercero,
    letterSpacing: 1.5,
  },
  respuestaValor: { fontSize: 22, fontWeight: '900' },
  pesoTxt: { fontSize: 13, color: C.txtSecundario, marginTop: 4 },

  candidatoFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  candidatoDot: { color: '#16A34A', fontSize: 16, fontWeight: '900' },
  candidatoNombre: { fontSize: 18, fontWeight: '700', flex: 1 },

  vacio: { alignItems: 'center', paddingTop: 80, gap: 16 },
  vacioIcono: { fontSize: 56 },
  vacioTxt: { fontSize: 18, color: C.txtSecundario, textAlign: 'center', lineHeight: 26 },
  btnVolver: {
    borderWidth: 1.5, borderColor: C.borde, borderRadius: 10,
    paddingHorizontal: 32, paddingVertical: 14, backgroundColor: C.tarjeta,
  },
  btnVolverTxt: { color: C.txtSecundario, fontWeight: '700', fontSize: 16 },
});
