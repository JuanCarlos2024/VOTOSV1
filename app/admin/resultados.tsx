import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase, Candidato } from '../../lib/supabase';
import { C } from '../../lib/theme';

type ResultadoReglamento = {
  opcion: string;
  peso: number;
  asociaciones: number;
  color: string;
};

type ResultadoEleccion = {
  candidato_id: string;
  nombre: string;
  peso: number;
  asociaciones: number;
};

const COLORES_REGLAMENTO: Record<string, string> = {
  Apruebo: '#22C55E',
  Rechazo: '#EF4444',
  Abstengo: '#9CA3AF',
};

export default function ResultadosScreen() {
  const { id, texto, tipo } = useLocalSearchParams<{
    id: string;
    texto: string;
    tipo: string;
  }>();

  const [cargando, setCargando] = useState(true);
  const [resultadosReglamento, setResultadosReglamento] = useState<ResultadoReglamento[]>([]);
  const [resultadosEleccion, setResultadosEleccion] = useState<ResultadoEleccion[]>([]);
  const [totalPeso, setTotalPeso] = useState(0);
  const [totalAsociaciones, setTotalAsociaciones] = useState(0);
  const [totalPresidentes, setTotalPresidentes] = useState(0);

  useEffect(() => {
    if (!id) return;
    cargar();

    const channel = supabase
      .channel(`resultados-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votos', filter: `pregunta_id=eq.${id}` },
        () => cargar()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function cargar() {
    if (!id) return;
    setCargando(true);

    // Total de presidentes (para saber cuántos faltan)
    const { count: countPresidentes } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('rol', 'presidente');

    setTotalPresidentes(countPresidentes ?? 0);

    if (tipo === 'reglamento') {
      await cargarReglamento();
    } else {
      await cargarEleccion();
    }

    setCargando(false);
  }

  async function cargarReglamento() {
    const { data: votos } = await supabase
      .from('votos')
      .select('respuesta, peso, usuario_id')
      .eq('pregunta_id', id!);

    const agrupado: Record<string, { peso: number; usuarios: Set<string> }> = {};
    for (const v of votos ?? []) {
      if (!agrupado[v.respuesta]) {
        agrupado[v.respuesta] = { peso: 0, usuarios: new Set() };
      }
      agrupado[v.respuesta].peso += v.peso ?? 1;
      agrupado[v.respuesta].usuarios.add(v.usuario_id);
    }

    const opciones = ['Apruebo', 'Rechazo', 'Abstengo'];
    const resultados: ResultadoReglamento[] = opciones.map(op => ({
      opcion: op,
      peso: agrupado[op]?.peso ?? 0,
      asociaciones: agrupado[op]?.usuarios.size ?? 0,
      color: COLORES_REGLAMENTO[op],
    }));

    const total = resultados.reduce((s, r) => s + r.peso, 0);
    const totalAsoc = new Set((votos ?? []).map((v: any) => v.usuario_id)).size;

    setResultadosReglamento(resultados);
    setTotalPeso(total);
    setTotalAsociaciones(totalAsoc);
  }

  async function cargarEleccion() {
    const [{ data: votos }, { data: candidatos }] = await Promise.all([
      supabase
        .from('votos')
        .select('respuesta, peso, usuario_id')
        .eq('pregunta_id', id!),
      supabase
        .from('candidatos')
        .select('*')
        .eq('pregunta_id', id!),
    ]);

    // Agrupar por candidato_id (respuesta es el candidato_id)
    const agrupado: Record<string, { peso: number; usuarios: Set<string> }> = {};
    for (const v of votos ?? []) {
      if (!agrupado[v.respuesta]) {
        agrupado[v.respuesta] = { peso: 0, usuarios: new Set() };
      }
      agrupado[v.respuesta].peso += v.peso ?? 1;
      agrupado[v.respuesta].usuarios.add(v.usuario_id);
    }

    const resultados: ResultadoEleccion[] = (candidatos as Candidato[] ?? [])
      .map(c => ({
        candidato_id: c.id,
        nombre: c.nombre,
        peso: agrupado[c.id]?.peso ?? 0,
        asociaciones: agrupado[c.id]?.usuarios.size ?? 0,
      }))
      .sort((a, b) => b.peso - a.peso);

    const total = resultados.reduce((s, r) => s + r.peso, 0);
    const totalAsoc = new Set((votos ?? []).map((v: any) => v.usuario_id)).size;

    setResultadosEleccion(resultados);
    setTotalPeso(total);
    setTotalAsociaciones(totalAsoc);
  }

  const maxPeso = tipo === 'reglamento'
    ? Math.max(...resultadosReglamento.map(r => r.peso), 1)
    : Math.max(...resultadosEleccion.map(r => r.peso), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />}
    >
      {/* Encabezado */}
      <View style={styles.headerCard}>
        <View style={styles.tipoBadge}>
          <Text style={styles.tipoBadgeTexto}>
            {tipo === 'reglamento' ? '📜 REGLAMENTO' : '🗳 ELECCIÓN'}
          </Text>
        </View>
        <Text style={styles.preguntaTexto}>{decodeURIComponent(texto ?? '')}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{totalAsociaciones}</Text>
            <Text style={styles.statLabel}>VOTARON</Text>
          </View>
          <View style={styles.divisorV} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: '#EF4444' }]}>
              {totalPresidentes - totalAsociaciones}
            </Text>
            <Text style={styles.statLabel}>PENDIENTES</Text>
          </View>
          <View style={styles.divisorV} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{totalPeso}</Text>
            <Text style={styles.statLabel}>PESO TOTAL</Text>
          </View>
        </View>

        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTexto}>TIEMPO REAL</Text>
        </View>
      </View>

      {/* Resultados */}
      {cargando && totalPeso === 0 ? (
        <ActivityIndicator color="#C8102E" size="large" style={{ marginTop: 40 }} />
      ) : tipo === 'reglamento' ? (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>RESULTADOS PONDERADOS</Text>
          {resultadosReglamento.map((r, i) => {
            const pct = totalPeso > 0 ? (r.peso / totalPeso) * 100 : 0;
            return (
              <View key={r.opcion} style={styles.barraCard}>
                <View style={styles.barraHeaderRow}>
                  <Text style={[styles.barraLabel, { color: r.color }]}>{r.opcion.toUpperCase()}</Text>
                  <View style={styles.barraRight}>
                    <Text style={[styles.barraPeso, { color: r.color }]}>{r.peso} votos</Text>
                    <Text style={styles.barraAsoc}>{r.asociaciones} asoc.</Text>
                  </View>
                </View>
                <View style={styles.barraFondo}>
                  <View
                    style={[
                      styles.barraRelleno,
                      { width: `${pct}%`, backgroundColor: r.color },
                    ]}
                  />
                </View>
                <Text style={[styles.barraPct, { color: r.color }]}>
                  {Math.round(pct)}%
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>RANKING DE CANDIDATOS</Text>
          {resultadosEleccion.map((r, i) => {
            const pct = maxPeso > 0 ? (r.peso / maxPeso) * 100 : 0;
            const esGanador = i === 0 && r.peso > 0;
            return (
              <View key={r.candidato_id} style={[styles.barraCard, esGanador && styles.barraCardGanador]}>
                <View style={styles.rankRow}>
                  <Text style={styles.rankNum}>
                    {esGanador ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </Text>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.barraHeaderRow}>
                      <Text style={[styles.barraLabel, { color: esGanador ? '#B45309' : C.txtPrimario }]}>
                        {r.nombre}
                      </Text>
                      <View style={styles.barraRight}>
                        <Text style={[styles.barraPeso, { color: esGanador ? '#B45309' : C.txtPrimario }]}>
                          {r.peso} votos
                        </Text>
                        <Text style={styles.barraAsoc}>{r.asociaciones} asoc.</Text>
                      </View>
                    </View>
                    <View style={styles.barraFondo}>
                      <View
                        style={[
                          styles.barraRelleno,
                          {
                            width: `${pct}%`,
                            backgroundColor: esGanador ? '#D97706' : C.azul,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {resultadosEleccion.length === 0 && (
            <View style={styles.sinVotos}>
              <Text style={styles.sinVotosTexto}>Aún no se han registrado votos</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 16, paddingTop: 16 },

  headerCard: {
    backgroundColor: C.azul,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    gap: 14,
  },
  tipoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tipoBadgeTexto: { color: C.blanco, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  preguntaTexto: { color: C.blanco, fontSize: 16, fontWeight: '700', lineHeight: 22 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: 26, fontWeight: '900', color: '#4ADE80' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1.5 },
  divisorV: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  liveTexto: { color: '#4ADE80', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  seccion: { gap: 12 },
  seccionTitulo: {
    color: C.azul,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },

  barraCard: {
    backgroundColor: C.tarjeta,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borde,
    gap: 8,
  },
  barraCardGanador: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  barraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barraLabel: { fontSize: 15, fontWeight: '800', color: C.txtPrimario, flex: 1 },
  barraRight: { alignItems: 'flex-end', gap: 2 },
  barraPeso: { fontSize: 14, fontWeight: '800', color: C.txtPrimario },
  barraAsoc: { fontSize: 11, color: C.txtTercero },
  barraFondo: { height: 12, backgroundColor: C.tarjeta2, borderRadius: 6 },
  barraRelleno: { height: 12, borderRadius: 6 },
  barraPct: { fontSize: 12, fontWeight: '700', textAlign: 'right' },

  rankRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rankNum: { fontSize: 24, width: 36, textAlign: 'center' },

  sinVotos: { alignItems: 'center', paddingVertical: 40 },
  sinVotosTexto: { color: C.txtSecundario, fontSize: 15 },
});
