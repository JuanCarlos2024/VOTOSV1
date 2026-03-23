import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';

type Fila = {
  id: string;
  nombre_usuario: string;
  votos_disponibles: number;
  ha_votado: boolean;
  respuesta?: string;
};

type CandRanking = { id: string; nombre: string; peso: number };

const COLOR_RESP: Record<string, { color: string; bg: string; border: string; icono: string }> = {
  Apruebo:  { color: '#15803D', bg: '#F0FDF4', border: '#16A34A', icono: '✅' },
  Rechazo:  { color: '#DC2626', bg: '#FEF2F2', border: '#DC2626', icono: '❌' },
  Abstengo: { color: '#6B7280', bg: '#F9FAFB', border: '#9CA3AF', icono: '⬜' },
};

export default function SeguimientoScreen() {
  const { id, texto, tipo } = useLocalSearchParams<{ id: string; texto: string; tipo: string }>();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [resumenReg, setResumenReg] = useState<Record<string, number>>({});
  const [rankingElec, setRankingElec] = useState<CandRanking[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    cargar();

    const ch = supabase
      .channel(`seg-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votos', filter: `pregunta_id=eq.${id}` }, () => cargar())
      .subscribe();

    pollRef.current = setInterval(() => cargar(), 15000);

    return () => {
      supabase.removeChannel(ch);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function cargar() {
    if (!id) return;
    setCargando(true);
    const esReg = tipo === 'reglamento';

    const [{ data: usuarios }, { data: votos }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre_usuario, votos_disponibles').eq('rol', 'presidente').order('nombre_usuario'),
      supabase.from('votos').select('usuario_id, candidato_id, respuesta, peso').eq('pregunta_id', id),
    ]);

    const votosMap: Record<string, string> = {};
    const votadosIds = new Set<string>();
    const resReg: Record<string, number> = {};

    for (const v of votos ?? []) {
      votadosIds.add(v.usuario_id);
      if (esReg) {
        votosMap[v.usuario_id] = v.respuesta;
        resReg[v.respuesta] = (resReg[v.respuesta] || 0) + (v.peso ?? 1);
      }
    }

    if (esReg) {
      setResumenReg(resReg);
    } else {
      const { data: cands } = await supabase.from('candidatos').select('*').eq('pregunta_id', id);
      const pesoPorCand: Record<string, number> = {};
      for (const v of votos ?? []) {
        pesoPorCand[v.candidato_id ?? v.respuesta] = (pesoPorCand[v.candidato_id ?? v.respuesta] || 0) + (v.peso ?? 1);
      }
      const ranking: CandRanking[] = (cands ?? []).map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        peso: pesoPorCand[c.id] || 0,
      })).sort((a, b) => b.peso - a.peso);
      setRankingElec(ranking);
    }

    setFilas((usuarios ?? []).map((u: any) => ({
      id: u.id,
      nombre_usuario: u.nombre_usuario,
      votos_disponibles: u.votos_disponibles,
      ha_votado: votadosIds.has(u.id),
      ...(esReg && { respuesta: votosMap[u.id] }),
    })));
    setCargando(false);
  }

  const totalVotaron = filas.filter(f => f.ha_votado).length;
  const pesosEmitidos = filas.filter(f => f.ha_votado).reduce((s, f) => s + f.votos_disponibles, 0);
  const pesoTotal = filas.reduce((s, f) => s + f.votos_disponibles, 0);
  const maxPesoRanking = Math.max(...rankingElec.map(r => r.peso), 1);
  const totalPesoReg = Object.values(resumenReg).reduce((s, v) => s + v, 0);

  function ResumenReglamento() {
    const opciones = [
      { key: 'Apruebo', icono: '✅', color: '#15803D', bg: '#F0FDF4', border: '#16A34A' },
      { key: 'Rechazo', icono: '❌', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626' },
      { key: 'Abstengo', icono: '⬜', color: '#6B7280', bg: '#F9FAFB', border: '#9CA3AF' },
    ];
    return (
      <View style={styles.resumenRegRow}>
        {opciones.map(o => {
          const votos = resumenReg[o.key] ?? 0;
          const pct = totalPesoReg > 0 ? Math.round((votos / totalPesoReg) * 100) : 0;
          return (
            <View key={o.key} style={[styles.regCaja, { backgroundColor: o.bg, borderColor: o.border }]}>
              <Text style={styles.regIcono}>{o.icono}</Text>
              <Text style={[styles.regOpcion, { color: o.color }]}>{o.key.toUpperCase()}</Text>
              <Text style={[styles.regVotos, { color: o.color }]}>{votos}</Text>
              <Text style={styles.regLabel}>votos</Text>
              <Text style={[styles.regPct, { color: o.color }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    );
  }

  function ResumenEleccion() {
    return (
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitulo}>RANKING ACTUAL</Text>
        {rankingElec.map((c, i) => {
          const pct = maxPesoRanking > 0 ? (c.peso / maxPesoRanking) * 100 : 0;
          const medallas = ['🥇', '🥈', '🥉'];
          return (
            <View key={c.id} style={styles.rankingFila}>
              <Text style={styles.rankingMedalla}>{medallas[i] ?? `#${i + 1}`}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rankingHeaderRow}>
                  <Text style={styles.rankingNombre}>{c.nombre}</Text>
                  <Text style={styles.rankingPeso}>{c.peso} votos</Text>
                </View>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraRelleno, { width: `${pct}%` }]} />
                </View>
              </View>
            </View>
          );
        })}
        {rankingElec.length === 0 && (
          <Text style={styles.sinVotos}>Sin votos aún</Text>
        )}
      </View>
    );
  }

  function ListHeader() {
    const pctVotaron = filas.length > 0 ? Math.round((totalVotaron / filas.length) * 100) : 0;
    return (
      <>
        <View style={styles.resumenCard}>
          <Text style={styles.resumenTitulo} numberOfLines={2}>{decodeURIComponent(texto ?? '')}</Text>
          <View style={styles.contadores}>
            <View style={styles.contador}>
              <Text style={[styles.contadorNum, { color: '#16A34A' }]}>{totalVotaron}</Text>
              <Text style={styles.contadorLabel}>VOTARON</Text>
            </View>
            <View style={styles.divisorV} />
            <View style={styles.contador}>
              <Text style={[styles.contadorNum, { color: C.rojo }]}>{filas.length - totalVotaron}</Text>
              <Text style={styles.contadorLabel}>PENDIENTES</Text>
            </View>
            <View style={styles.divisorV} />
            <View style={styles.contador}>
              <Text style={styles.contadorNum}>{filas.length}</Text>
              <Text style={styles.contadorLabel}>TOTAL</Text>
            </View>
          </View>
          <View style={styles.barraContainer}>
            <View style={styles.barraRow}>
              <Text style={styles.barraTxt}>Pesos emitidos</Text>
              <Text style={styles.barraTxt}>{pesosEmitidos} / {pesoTotal} ({pesoTotal > 0 ? Math.round((pesosEmitidos / pesoTotal) * 100) : 0}%)</Text>
            </View>
            <View style={styles.barraFondo}>
              <View style={[styles.barraRelleno, { width: pesoTotal > 0 ? `${(pesosEmitidos / pesoTotal) * 100}%` : '0%' }]} />
            </View>
          </View>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>TIEMPO REAL</Text>
          </View>
        </View>

        {tipo === 'reglamento' ? <ResumenReglamento /> : <ResumenEleccion />}

        {tipo !== 'reglamento' && (
          <View style={styles.secretoBadge}>
            <Text style={styles.secretoTxt}>🔒 Votación confidencial — no se muestra el candidato elegido</Text>
          </View>
        )}

        <Text style={styles.subtitulo}>ESTADO POR ASOCIACIÓN</Text>
      </>
    );
  }

  function renderFila({ item }: { item: Fila }) {
    const respMeta = item.respuesta ? (COLOR_RESP[item.respuesta] ?? null) : null;

    return (
      <View style={[styles.fila, item.ha_votado ? styles.filaVotada : styles.filaPendiente]}>
        <View style={[styles.estadoCirculo, { backgroundColor: item.ha_votado ? '#F0FDF4' : '#FEF2F2' }]}>
          <Text style={styles.estadoIcono}>{item.ha_votado ? '✅' : '❌'}</Text>
        </View>

        <View style={styles.filaInfo}>
          <Text style={[styles.nombre, { color: item.ha_votado ? C.txtPrimario : C.txtSecundario }]}>
            {item.nombre_usuario}
          </Text>
          <Text style={styles.peso}>{item.votos_disponibles} voto(s) de peso</Text>
        </View>

        {tipo === 'reglamento' ? (
          item.ha_votado && respMeta ? (
            <View style={[styles.tagRespuesta, { backgroundColor: respMeta.bg, borderColor: respMeta.border }]}>
              <Text style={styles.tagIcono}>{respMeta.icono}</Text>
              <Text style={[styles.tagTxt, { color: respMeta.color }]}>
                {item.respuesta!.toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={styles.tagPendiente}>
              <Text style={styles.tagPendienteTxt}>PENDIENTE</Text>
            </View>
          )
        ) : (
          item.ha_votado ? (
            <View style={[styles.tagRespuesta, { backgroundColor: '#F0FDF4', borderColor: '#16A34A' }]}>
              <Text style={[styles.tagTxt, { color: '#16A34A' }]}>VOTÓ</Text>
            </View>
          ) : (
            <View style={styles.tagPendiente}>
              <Text style={styles.tagPendienteTxt}>PENDIENTE</Text>
            </View>
          )
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cargando && filas.length === 0 ? (
        <ActivityIndicator color={C.azul} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filas}
          keyExtractor={item => item.id}
          renderItem={renderFila}
          ListHeaderComponent={<ListHeader />}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.azul} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.vacio}>No hay presidentes registrados</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 14, paddingTop: 14 },

  resumenCard: {
    backgroundColor: C.azul, borderRadius: 14, padding: 16,
    marginBottom: 14, gap: 12,
  },
  resumenTitulo: { color: C.blanco, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  contadores: { flexDirection: 'row', justifyContent: 'space-around' },
  contador: { alignItems: 'center', gap: 3 },
  contadorNum: { fontSize: 26, fontWeight: '900', color: C.blanco },
  contadorLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1.5 },
  divisorV: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  barraContainer: { gap: 5 },
  barraRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barraTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  barraFondo: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4 },
  barraRelleno: { height: 8, backgroundColor: C.blanco, borderRadius: 4 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  liveTxt: { color: '#4ADE80', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  // Reglamento summary
  resumenRegRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  regCaja: {
    flex: 1, borderRadius: 12, padding: 12, alignItems: 'center',
    borderWidth: 1.5, gap: 2,
  },
  regIcono: { fontSize: 24, marginBottom: 2 },
  regOpcion: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  regVotos: { fontSize: 28, fontWeight: '900' },
  regLabel: { color: C.txtTercero, fontSize: 10 },
  regPct: { fontSize: 14, fontWeight: '800' },

  // Election ranking
  rankingContainer: {
    backgroundColor: C.tarjeta, borderRadius: 12, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: C.borde, gap: 10,
  },
  rankingTitulo: { color: C.azul, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  rankingFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankingMedalla: { fontSize: 22, width: 32, textAlign: 'center' },
  rankingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rankingNombre: { color: C.txtPrimario, fontSize: 14, fontWeight: '700', flex: 1 },
  rankingPeso: { color: C.rojo, fontSize: 13, fontWeight: '800' },
  sinVotos: { color: C.txtTercero, fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  secretoBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 14,
  },
  secretoTxt: { color: C.azul, fontSize: 12, textAlign: 'center' },

  subtitulo: { color: C.azul, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },

  // Filas
  fila: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1.5, gap: 10,
  },
  filaVotada: {
    backgroundColor: C.blanco,
    borderColor: '#16A34A',
  },
  filaPendiente: {
    backgroundColor: C.tarjeta,
    borderColor: C.borde,
  },
  estadoCirculo: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  estadoIcono: { fontSize: 22 },
  filaInfo: { flex: 1, gap: 2 },
  nombre: { fontSize: 15, fontWeight: '700' },
  peso: { color: C.txtTercero, fontSize: 11 },

  // Tags de respuesta
  tagRespuesta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagIcono: { fontSize: 14 },
  tagTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  tagPendiente: {
    borderWidth: 1, borderColor: '#D97706', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#FFFBEB',
  },
  tagPendienteTxt: { color: '#B45309', fontSize: 11, fontWeight: '800' },

  vacio: { color: C.txtSecundario, fontSize: 16, textAlign: 'center', paddingTop: 60 },
});
