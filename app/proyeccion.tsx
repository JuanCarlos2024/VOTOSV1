import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { supabase, Pregunta, Candidato } from '../lib/supabase';
import { C } from '../lib/theme';
import Logo from '../components/Logo';

type VotoResumen = {
  respuesta: string;
  peso: number;
  asociaciones: number;
};

type VotanteInfo = {
  id: string;
  nombre_usuario: string;
  votos_disponibles: number;
  respuesta: string | null; // null = no ha votado
};

const { width } = Dimensions.get('window');
const ES_WEB = width > 600;

// La pantalla de proyección usa fondo oscuro para mejor visibilidad en proyector
const PROJ_BG   = '#1A1A1A';
const PROJ_CARD = '#242424';
const PROJ_BORDE = '#3A3A3A';

const COLOR_REG: Record<string, { color: string; bg: string; icono: string }> = {
  Apruebo:  { color: '#4ADE80', bg: '#052e16', icono: '✅' },
  Rechazo:  { color: '#F87171', bg: '#2d0707', icono: '❌' },
  Abstengo: { color: '#CBD5E1', bg: '#1c2a3a', icono: '⬜' },
};

export default function ProyeccionScreen() {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [votos, setVotos] = useState<VotoResumen[]>([]);
  const [votantes, setVotantes] = useState<VotanteInfo[]>([]);
  const [totalPresidentes, setTotalPresidentes] = useState(0);
  const [totalVotaron, setTotalVotaron] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(new Date());
  // Unanimidad special screen
  const [mostrarUnanimidad, setMostrarUnanimidad] = useState(false);
  const [textoUnanimidad, setTextoUnanimidad] = useState('');
  const preguntaActivaRef = useRef<(Pregunta & { unanimidad?: boolean }) | null>(null);
  const unanimidadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    cargar();

    const ch = supabase
      .channel('proyeccion-votos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votos' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preguntas' }, () => cargar())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  async function cargar() {
    const [{ count }, { data: usuarios }] = await Promise.all([
      supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'presidente'),
      supabase.from('usuarios').select('id, nombre_usuario, votos_disponibles').eq('rol', 'presidente').order('nombre_usuario'),
    ]);
    setTotalPresidentes(count ?? 0);

    const { data: preg } = await supabase
      .from('preguntas').select('*').eq('estado', 'activa').maybeSingle();

    if (!preg) {
      // Detect if last active question was closed by unanimidad → show special screen
      const ultima = preguntaActivaRef.current;
      if (ultima?.unanimidad === true && !mostrarUnanimidad) {
        setTextoUnanimidad(ultima.texto);
        setMostrarUnanimidad(true);
        if (unanimidadTimerRef.current) clearTimeout(unanimidadTimerRef.current);
        unanimidadTimerRef.current = setTimeout(() => setMostrarUnanimidad(false), 10000);
      }
      preguntaActivaRef.current = null;
      setPregunta(null);
      setVotos([]);
      setCandidatos([]);
      setVotantes([]);
      setTotalVotaron(0);
      setCargando(false);
      return;
    }

    preguntaActivaRef.current = preg as Pregunta;
    setPregunta(preg as Pregunta);

    const { data: rawVotos } = await supabase
      .from('votos')
      .select('usuario_id, candidato_id, respuesta, peso')
      .eq('pregunta_id', preg.id);

    const votadosSet = new Set((rawVotos ?? []).map((v: any) => v.usuario_id));
    setTotalVotaron(votadosSet.size);

    // Construir tabla de votantes (para reglamento mostramos qué votaron)
    const infoVotantes: VotanteInfo[] = (usuarios ?? []).map((u: any) => {
      const voto = (rawVotos ?? []).find((v: any) => v.usuario_id === u.id);
      return {
        id: u.id,
        nombre_usuario: u.nombre_usuario,
        votos_disponibles: u.votos_disponibles ?? 1,
        respuesta: preg.tipo === 'reglamento' ? (voto?.respuesta ?? null) : (voto ? '✓' : null),
      };
    });
    setVotantes(infoVotantes);

    if (preg.tipo === 'reglamento') {
      const agrupado: Record<string, { peso: number; asocs: Set<string> }> = {};
      for (const v of rawVotos ?? []) {
        if (!agrupado[v.respuesta]) agrupado[v.respuesta] = { peso: 0, asocs: new Set() };
        agrupado[v.respuesta].peso += v.peso ?? 1;
        agrupado[v.respuesta].asocs.add(v.usuario_id);
      }
      const opciones = ['Apruebo', 'Rechazo', 'Abstengo'];
      setVotos(opciones.map(op => ({
        respuesta: op,
        peso: agrupado[op]?.peso ?? 0,
        asociaciones: agrupado[op]?.asocs.size ?? 0,
      })));
      setCandidatos([]);
    } else {
      const { data: cands } = await supabase
        .from('candidatos').select('*').eq('pregunta_id', preg.id);
      setCandidatos((cands ?? []) as Candidato[]);

      const agrupado: Record<string, { peso: number; asocs: Set<string> }> = {};
      for (const v of rawVotos ?? []) {
        const key = v.candidato_id ?? v.respuesta;
        if (!agrupado[key]) agrupado[key] = { peso: 0, asocs: new Set() };
        agrupado[key].peso += v.peso ?? 1;
        agrupado[key].asocs.add(v.usuario_id);
      }
      const ranking = (cands ?? []).map((c: any) => ({
        respuesta: c.id,
        peso: agrupado[c.id]?.peso ?? 0,
        asociaciones: agrupado[c.id]?.asocs.size ?? 0,
      })).sort((a, b) => b.peso - a.peso);
      setVotos(ranking);
    }

    setCargando(false);
  }

  const maxPeso = Math.max(...votos.map(v => v.peso), 1);
  const totalPeso = votos.reduce((s, v) => s + v.peso, 0);
  const pctVotaron = totalPresidentes > 0 ? Math.round((totalVotaron / totalPresidentes) * 100) : 0;
  const horaStr = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // ── Pantalla especial de Unanimidad (10 segundos) ──────────
  if (mostrarUnanimidad) {
    return (
      <View style={styles.unanimidadBg}>
        <Text style={styles.unanimidadIcono}>✅</Text>
        <Text style={styles.unanimidadTitulo}>APROBADO POR UNANIMIDAD</Text>
        <Text style={styles.unanimidadTexto}>{textoUnanimidad}</Text>
        <Text style={styles.unanimidadSub}>Federación del Rodeo Chileno</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={[styles.contenido, ES_WEB && styles.contenidoWeb]}
    >
      {/* Encabezado */}
      {/* Botón volver discreto */}
      <TouchableOpacity
        style={styles.btnVolver}
        onPress={() => router.push('/admin/preguntas')}
        activeOpacity={0.7}
      >
        <Text style={styles.btnVolverTxt}>← Volver al Panel</Text>
      </TouchableOpacity>

      <View style={styles.encabezado}>
        <Logo size={56} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.encTitulo}>SISTEMA DE VOTOS</Text>
          <Text style={styles.encSub}>Federación del Rodeo Chileno</Text>
        </View>
        <Text style={styles.encHora}>{horaStr}</Text>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <Text style={styles.txtEspera}>Cargando...</Text>
        </View>
      ) : !pregunta ? (
        <View style={styles.centrado}>
          <Logo size={180} style={{ marginBottom: 32 }} />
          <Text style={styles.txtEspera}>FEDERACIÓN DEL RODEO CHILENO</Text>
          <Text style={styles.txtEsperaSub}>Esperando el inicio de la votación...</Text>
        </View>
      ) : (
        <>
          {/* Pregunta */}
          <View style={styles.preguntaCard}>
            <View style={[styles.badge, { backgroundColor: pregunta.tipo === 'reglamento' ? C.rojo : '#4F46E5' }]}>
              <Text style={styles.badgeTxt}>
                {pregunta.tipo === 'reglamento' ? '📜 REGLAMENTO' : '🗳 ELECCIÓN'}
              </Text>
            </View>
            <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>
          </View>

          {/* Contador de participación */}
          <View style={styles.participacionCard}>
            <Text style={styles.partTitulo}>PARTICIPACIÓN</Text>
            <View style={styles.partRow}>
              <Text style={styles.partNumVerde}>{totalVotaron}</Text>
              <Text style={styles.partDivisor}>/</Text>
              <Text style={styles.partNumBlanco}>{totalPresidentes}</Text>
              <Text style={styles.partLabel}>asociaciones han votado</Text>
              <Text style={styles.partPct}>{pctVotaron}%</Text>
            </View>
            <View style={styles.barraFondo}>
              <View style={[styles.barraRelleno, { width: `${pctVotaron}%` }]} />
            </View>
          </View>

          {/* Resultados */}
          <Text style={styles.resultadosTitulo}>
            {pregunta.tipo === 'reglamento' ? 'RESULTADOS' : 'RANKING DE CANDIDATOS'}
          </Text>

          {pregunta.tipo === 'reglamento' ? (
            <View style={styles.regGrid}>
              {votos.map(v => {
                const meta = COLOR_REG[v.respuesta] ?? { color: '#FFF', bg: '#222', icono: '•' };
                const pct = totalPeso > 0 ? Math.round((v.peso / totalPeso) * 100) : 0;
                return (
                  <View key={v.respuesta} style={[styles.regCaja, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                    <Text style={styles.regIcono}>{meta.icono}</Text>
                    <Text style={[styles.regOpcion, { color: meta.color }]}>
                      {v.respuesta.toUpperCase()}
                    </Text>
                    <Text style={[styles.regVotos, { color: meta.color }]}>{v.peso}</Text>
                    <Text style={styles.regVotosLabel}>votos</Text>
                    <View style={[styles.regBarraFondo, { borderColor: meta.color }]}>
                      <View style={[styles.regBarraRelleno, { height: `${pct}%`, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={[styles.regPct, { color: meta.color }]}>{pct}%</Text>
                    <Text style={styles.regAsoc}>{v.asociaciones} asoc.</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.eleccionLista}>
              {votos.map((v, i) => {
                const cand = candidatos.find(c => c.id === v.respuesta);
                if (!cand) return null;
                const pct = maxPeso > 0 ? (v.peso / maxPeso) * 100 : 0;
                const medallas = ['🥇', '🥈', '🥉'];
                const esGanador = i === 0 && v.peso > 0;
                return (
                  <View key={v.respuesta} style={[styles.elecFila, esGanador && styles.elecFilaGanador]}>
                    <Text style={styles.elecMedalla}>{medallas[i] ?? `#${i + 1}`}</Text>
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={styles.elecHeaderRow}>
                        <Text style={[styles.elecNombre, esGanador && { color: '#FCD34D' }]}>
                          {cand.nombre}
                        </Text>
                        <Text style={[styles.elecVotos, esGanador && { color: '#FCD34D' }]}>
                          {v.peso} votos · {v.asociaciones} asoc.
                        </Text>
                      </View>
                      <View style={styles.elecBarraFondo}>
                        <View
                          style={[
                            styles.elecBarraRelleno,
                            { width: `${pct}%`, backgroundColor: esGanador ? '#FCD34D' : C.rojo },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              {votos.length === 0 && (
                <Text style={styles.sinVotos}>Aún no se han registrado votos</Text>
              )}
            </View>
          )}

          {/* Tabla: quién ha votado */}
          <Text style={styles.tablaTitulo}>
            {pregunta.tipo === 'reglamento' ? 'REGISTRO DE VOTOS' : 'REGISTRO DE PARTICIPACIÓN'}
          </Text>
          <View style={styles.tablaCard}>
            {/* Cabecera */}
            <View style={styles.tablaFila}>
              <Text style={[styles.tablaCelda, styles.tablaCabecera, { flex: 2 }]}>ASOCIACIÓN</Text>
              <Text style={[styles.tablaCelda, styles.tablaCabecera, { flex: 1, textAlign: 'center' }]}>PESO</Text>
              <Text style={[styles.tablaCelda, styles.tablaCabecera, { flex: 1, textAlign: 'center' }]}>
                {pregunta.tipo === 'reglamento' ? 'VOTO' : 'ESTADO'}
              </Text>
            </View>
            {votantes.map((u, i) => {
              const votado = u.respuesta !== null;
              const metaColor = pregunta.tipo === 'reglamento' && u.respuesta
                ? (COLOR_REG[u.respuesta]?.color ?? '#CBD5E1')
                : votado ? '#4ADE80' : '#6B7280';
              return (
                <View
                  key={u.id}
                  style={[
                    styles.tablaFila,
                    i % 2 === 0 ? styles.tablaFilaPar : styles.tablaFilaImpar,
                    votado && styles.tablaFilaVotada,
                  ]}
                >
                  <Text style={[styles.tablaCelda, { flex: 2, color: C.blanco }]} numberOfLines={1}>
                    {u.nombre_usuario}
                  </Text>
                  <Text style={[styles.tablaCelda, { flex: 1, textAlign: 'center', color: '#CBD5E1' }]}>
                    {u.votos_disponibles}
                  </Text>
                  <Text style={[styles.tablaCelda, { flex: 1, textAlign: 'center', color: metaColor, fontWeight: '800' }]}>
                    {u.respuesta ?? '—'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Live indicator */}
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>ACTUALIZÁNDOSE EN TIEMPO REAL</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: PROJ_BG },
  contenido: { padding: 24, paddingBottom: 60 },
  contenidoWeb: { maxWidth: 1100, alignSelf: 'center', width: '100%' },

  btnVolver: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  btnVolverTxt: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },

  encabezado: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: C.rojo,
  },
  encTitulo: { color: C.blanco, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  encSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  encHora: { color: 'rgba(255,255,255,0.6)', fontSize: 22, fontWeight: '700' },

  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  esperaIcono: { fontSize: 80, marginBottom: 20 },
  txtEspera: { color: 'rgba(255,255,255,0.4)', fontSize: 32, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  txtEsperaSub: { color: 'rgba(255,255,255,0.3)', fontSize: 20, marginTop: 12, textAlign: 'center' },

  preguntaCard: {
    backgroundColor: PROJ_CARD, borderRadius: 16, padding: 24,
    marginBottom: 20, borderWidth: 2, borderColor: C.rojo,
  },
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 14 },
  badgeTxt: { color: C.blanco, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  preguntaTxt: { color: C.blanco, fontSize: 34, fontWeight: '700', lineHeight: 44 },

  participacionCard: {
    backgroundColor: PROJ_CARD, borderRadius: 16, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: PROJ_BORDE, gap: 10,
  },
  partTitulo: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  partRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  partNumVerde: { color: '#4ADE80', fontSize: 52, fontWeight: '900' },
  partDivisor: { color: 'rgba(255,255,255,0.3)', fontSize: 40 },
  partNumBlanco: { color: C.blanco, fontSize: 52, fontWeight: '900' },
  partLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 22, flex: 1 },
  partPct: { color: '#4ADE80', fontSize: 36, fontWeight: '900' },
  barraFondo: { height: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6 },
  barraRelleno: { height: 12, backgroundColor: '#4ADE80', borderRadius: 6 },

  resultadosTitulo: {
    color: C.rojo, fontSize: 15, fontWeight: '900', letterSpacing: 3, marginBottom: 16,
  },

  // Reglamento
  regGrid: { flexDirection: ES_WEB ? 'row' : 'column', gap: 14, marginBottom: 24 },
  regCaja: {
    flex: 1, borderRadius: 16, padding: 20, alignItems: 'center',
    borderWidth: 2, gap: 4,
  },
  regIcono: { fontSize: 44, marginBottom: 4 },
  regOpcion: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  regVotos: { fontSize: 60, fontWeight: '900', lineHeight: 68 },
  regVotosLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  regBarraFondo: {
    width: '100%', height: 80, borderRadius: 8, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'flex-end',
    overflow: 'hidden', marginVertical: 4,
  },
  regBarraRelleno: { width: '100%', borderRadius: 6 },
  regPct: { fontSize: 32, fontWeight: '900' },
  regAsoc: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  // Elección
  eleccionLista: { gap: 12, marginBottom: 24 },
  elecFila: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: PROJ_CARD, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: PROJ_BORDE,
  },
  elecFilaGanador: { borderColor: '#FCD34D', backgroundColor: '#2A2000' },
  elecMedalla: { fontSize: 36, width: 50, textAlign: 'center' },
  elecHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  elecNombre: { color: C.blanco, fontSize: 26, fontWeight: '800', flex: 1 },
  elecVotos: { color: C.rojo, fontSize: 20, fontWeight: '800' },
  elecBarraFondo: { height: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 7 },
  elecBarraRelleno: { height: 14, borderRadius: 7 },
  sinVotos: { color: 'rgba(255,255,255,0.3)', fontSize: 20, textAlign: 'center', paddingVertical: 40 },

  // Tabla votantes
  tablaTitulo: {
    color: C.rojo, fontSize: 15, fontWeight: '900', letterSpacing: 3,
    marginBottom: 12, marginTop: 8,
  },
  tablaCard: {
    backgroundColor: PROJ_CARD, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: PROJ_BORDE, marginBottom: 24,
  },
  tablaFila: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  tablaFilaPar: { backgroundColor: 'rgba(255,255,255,0.02)' },
  tablaFilaImpar: { backgroundColor: 'rgba(255,255,255,0.05)' },
  tablaFilaVotada: { borderLeftWidth: 3, borderLeftColor: '#4ADE80' },
  tablaCelda: { fontSize: 16, color: '#CBD5E1' },
  tablaCabecera: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12,
    fontWeight: '800', letterSpacing: 1.5,
    borderBottomWidth: 1, borderBottomColor: PROJ_BORDE, paddingBottom: 10,
  },

  liveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', marginTop: 8,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80' },
  liveTxt: { color: '#4ADE80', fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Unanimidad fullscreen
  unanimidadBg: {
    flex: 1, backgroundColor: '#1B5E20',
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  unanimidadIcono: { fontSize: 120, marginBottom: 24 },
  unanimidadTitulo: {
    color: '#FFFFFF', fontSize: 48, fontWeight: '900',
    textAlign: 'center', letterSpacing: 2, lineHeight: 58, marginBottom: 24,
  },
  unanimidadTexto: {
    color: 'rgba(255,255,255,0.85)', fontSize: 28, fontWeight: '600',
    textAlign: 'center', lineHeight: 38, marginBottom: 32,
  },
  unanimidadSub: {
    color: 'rgba(255,255,255,0.5)', fontSize: 18, letterSpacing: 2, textAlign: 'center',
  },
});
