import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { supabase, Pregunta, Candidato } from '../lib/supabase';
import { obtenerUsuario, cerrarSesion } from '../lib/auth';
import type { Usuario } from '../lib/supabase';
import { C } from '../lib/theme';
import { registrar } from '../lib/auditoria';
import Logo from '../components/Logo';

const PENDING_KEY = '@votosv1:voto_pendiente';
const WARN_MS  = 8 * 60 * 1000;   // 8 minutos
const LOGOUT_MS = 10 * 60 * 1000; // 10 minutos

type VotoPendiente = {
  tipo: 'reglamento' | 'eleccion';
  pregunta_id: string;
  usuario_id: string;
  filas: any[];
};

type Estado =
  | 'cargando'
  | 'sin-pregunta'
  | 'votando-reglamento'
  | 'confirmando-reglamento'
  | 'votando-eleccion'
  | 'confirmando-eleccion'
  | 'completado'
  | 'ya-voto-reglamento'
  | 'ya-voto-eleccion';

const COLOR_OPCION: Record<string, { border: string; bg: string; text: string }> = {
  Apruebo: { border: '#16A34A', bg: '#F0FDF4', text: '#15803D' },
  Rechazo: { border: '#DC2626', bg: '#FEF2F2', text: '#DC2626' },
  Abstengo: { border: '#9CA3AF', bg: '#F9FAFB', text: '#6B7280' },
};

export default function HomeScreen() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [opcionPendiente, setOpcionPendiente] = useState('');
  const [opcionConfirmada, setOpcionConfirmada] = useState('');
  const [miRespuesta, setMiRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [contador, setContador] = useState(3);
  const [candidatosVotados, setCandidatosVotados] = useState<Candidato[]>([]);
  const [conectado, setConectado] = useState(true);
  const [modalCerrado, setModalCerrado] = useState(false);
  const [modalWarning, setModalWarning] = useState(false);
  const [msgPendiente, setMsgPendiente] = useState('');
  const preguntaIdRef = useRef<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usuarioRef = useRef<Usuario | null>(null);

  // ── Inactividad ──────────────────────────────────────────
  function resetInactividad() {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    setModalWarning(false);
    warnTimerRef.current = setTimeout(() => setModalWarning(true), WARN_MS);
    logoutTimerRef.current = setTimeout(async () => {
      const u = usuarioRef.current;
      if (u) await registrar('TIMEOUT', u.nombre_usuario, 'Sesión cerrada por inactividad');
      await cerrarSesion();
      router.replace('/');
    }, LOGOUT_MS);
  }

  function limpiarTimersInactividad() {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }

  // ── Indicador de conexión + retry de voto pendiente ──────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async netState => {
      const ahora = netState.isConnected ?? true;
      setConectado(ahora);
      if (ahora) {
        // Intentar enviar voto pendiente
        try {
          const raw = await AsyncStorage.getItem(PENDING_KEY);
          if (!raw) return;
          const pendiente: VotoPendiente = JSON.parse(raw);
          // Verificar si la pregunta sigue activa
          const { data: preg } = await supabase
            .from('preguntas').select('estado').eq('id', pendiente.pregunta_id).single();
          if (!preg || preg.estado !== 'activa') {
            await AsyncStorage.removeItem(PENDING_KEY);
            setMsgPendiente('Lo sentimos — la votación fue cerrada antes de que pudieras reconectarte.');
            return;
          }
          const { error } = await supabase.from('votos').insert(pendiente.filas);
          if (!error) {
            await AsyncStorage.removeItem(PENDING_KEY);
            setMsgPendiente('✅ Tu voto fue registrado correctamente al recuperar la conexión.');
            cargar();
          }
        } catch { /* ignore */ }
      }
    });
    return () => unsub();
  }, []);

  // Notificación en tiempo real cuando se cierra la votación activa
  useEffect(() => {
    const channel = supabase
      .channel('home-preguntas-cambios')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'preguntas' },
        (payload) => {
          const nueva = payload.new as any;
          // Si la pregunta que estaba activa ahora se cierra
          if (nueva.id === preguntaIdRef.current && nueva.estado === 'cerrada') {
            setModalCerrado(true);
          }
          // Si se activa una nueva pregunta y el usuario está en espera
          if (nueva.estado === 'activa') {
            cargar();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      resetInactividad(); // arrancar timer solo para presidentes
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        limpiarTimersInactividad();
      };
    }, [])
  );

  async function cargar() {
    setEstado('cargando');
    const u = await obtenerUsuario();
    if (!u) { router.replace('/'); return; }
    setUsuario(u);
    usuarioRef.current = u;
    setSeleccionados([]);
    setOpcionPendiente('');

    const { data: preguntaActiva } = await supabase
      .from('preguntas').select('*').eq('estado', 'activa').maybeSingle();

    if (!preguntaActiva) { setEstado('sin-pregunta'); preguntaIdRef.current = null; return; }
    setPregunta(preguntaActiva as Pregunta);
    preguntaIdRef.current = preguntaActiva.id;

    const { data: votoExistente } = await supabase
      .from('votos').select('respuesta')
      .eq('pregunta_id', preguntaActiva.id).eq('usuario_id', u.id).limit(1);

    if (votoExistente && votoExistente.length > 0) {
      if (preguntaActiva.tipo === 'reglamento') {
        setMiRespuesta(votoExistente[0].respuesta);
        setEstado('ya-voto-reglamento');
      } else {
        // Fetch which candidates they actually voted for
        const { data: misVotos } = await supabase
          .from('votos').select('candidato_id')
          .eq('pregunta_id', preguntaActiva.id).eq('usuario_id', u.id);
        const ids = (misVotos ?? []).map((v: any) => v.candidato_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: cands } = await supabase
            .from('candidatos').select('*').in('id', ids);
          setCandidatosVotados((cands ?? []) as Candidato[]);
        } else {
          setCandidatosVotados([]);
        }
        setEstado('ya-voto-eleccion');
      }
      return;
    }

    if (preguntaActiva.tipo === 'eleccion') {
      const { data: cands } = await supabase
        .from('candidatos').select('*').eq('pregunta_id', preguntaActiva.id).order('nombre');
      setCandidatos((cands ?? []) as Candidato[]);
      setEstado('votando-eleccion');
    } else {
      setEstado('votando-reglamento');
    }
  }

  function iniciarContador(opcionVotada: string) {
    setOpcionConfirmada(opcionVotada);
    setEstado('completado');
    setContador(3);
    countdownRef.current = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          cargar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function seleccionarOpcionReglamento(opcion: string) {
    setOpcionPendiente(opcion);
    setEstado('confirmando-reglamento');
  }

  function seleccionarEleccion() {
    if (seleccionados.length === 0) return;
    setEstado('confirmando-eleccion');
  }

  function toggleCandidato(id: string) {
    const max = pregunta?.max_selecciones ?? 1;
    setSeleccionados(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= max) return prev; // silently ignore (UI disables extras)
      return [...prev, id];
    });
  }

  async function confirmarVotoReglamento() {
    if (!usuario || !pregunta) return;
    resetInactividad();
    setEnviando(true);
    const fila = {
      pregunta_id: pregunta.id,
      usuario_id: usuario.id,
      respuesta: opcionPendiente,
      peso: usuario.votos_disponibles,
    };
    try {
      const { error } = await supabase.from('votos').insert(fila);
      if (error) {
        if (!conectado) {
          await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({
            tipo: 'reglamento', pregunta_id: pregunta.id,
            usuario_id: usuario.id, filas: [fila],
          } as VotoPendiente));
          setMsgPendiente('Sin conexión — Tu voto está guardado y se enviará al recuperar el WiFi.');
          setEstado('sin-pregunta');
        } else {
          Alert.alert('Error al votar', 'No se pudo registrar tu voto. Intenta de nuevo.');
          setEstado('votando-reglamento');
        }
        return;
      }
      await registrar('VOTO', usuario.nombre_usuario, `Reglamento: ${opcionPendiente} — ${pregunta.texto.slice(0, 60)}`);
      iniciarContador(opcionPendiente);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarVotoEleccion() {
    if (!usuario || !pregunta || seleccionados.length === 0) return;
    resetInactividad();
    setEnviando(true);
    const filas = seleccionados.map(cid => ({
      pregunta_id: pregunta.id,
      usuario_id: usuario.id,
      candidato_id: cid,
      respuesta: candidatos.find(c => c.id === cid)?.nombre ?? cid,
      peso: usuario.votos_disponibles,
    }));
    try {
      const { error } = await supabase.from('votos').insert(filas);
      if (error) {
        if (!conectado) {
          await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({
            tipo: 'eleccion', pregunta_id: pregunta.id,
            usuario_id: usuario.id, filas,
          } as VotoPendiente));
          setMsgPendiente('Sin conexión — Tu voto está guardado y se enviará al recuperar el WiFi.');
          setEstado('sin-pregunta');
        } else {
          Alert.alert('Error al votar', 'No se pudo registrar tu voto. Intenta de nuevo.');
          setEstado('votando-eleccion');
        }
        return;
      }
      await registrar('VOTO', usuario.nombre_usuario, `Elección: ${seleccionados.length} candidato(s) — ${pregunta.texto.slice(0, 60)}`);
      iniciarContador('eleccion');
    } finally {
      setEnviando(false);
    }
  }

  function handleLogout() {
    limpiarTimersInactividad();
    const u = usuarioRef.current;
    if (u) registrar('LOGOUT', u.nombre_usuario, 'Cierre de sesión manual');
    cerrarSesion().then(() => router.replace('/'));
  }

  // ── Modal advertencia inactividad ────────────────────────
  function ModalWarningInactividad() {
    return (
      <Modal visible={modalWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>⏰</Text>
            <Text style={styles.modalTitulo}>Sesión por cerrarse</Text>
            <Text style={styles.modalMsg}>
              Tu sesión se cerrará en 2 minutos por inactividad.{'\n'}Toca aquí para continuar.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={resetInactividad}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>CONTINUAR SESIÓN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Modal votación cerrada ────────────────────────────────
  function ModalCerrado() {
    return (
      <Modal visible={modalCerrado} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>🔒</Text>
            <Text style={styles.modalTitulo}>Votación Cerrada</Text>
            <Text style={styles.modalMsg}>
              El administrador ha cerrado esta votación.{'\n'}Ya no es posible emitir votos.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setModalCerrado(false); cargar(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Header del presidente ────────────────────────────────
  function PresHeader() {
    if (!usuario) return null;
    return (
      <>
        {!conectado && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineTxt}>🔴 SIN CONEXIÓN — Los cambios pueden no reflejarse</Text>
          </View>
        )}
        {msgPendiente !== '' && (
          <TouchableOpacity onPress={() => setMsgPendiente('')} activeOpacity={0.8}>
            <View style={[styles.offlineBanner, { backgroundColor: msgPendiente.startsWith('✅') ? '#14532D' : '#7F1D1D' }]}>
              <Text style={styles.offlineTxt}>{msgPendiente}</Text>
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.presHeader}>
          <Logo size={44} style={{ marginRight: 10 }} />
          <View style={styles.presInfo}>
            <View style={styles.presNombreRow}>
              <Text style={styles.presNombre}>{usuario.nombre_usuario}</Text>
              <Text style={styles.conectadoDot}>{conectado ? '🟢' : '🔴'}</Text>
            </View>
            <Text style={styles.presPeso}>Peso de voto: {usuario.votos_disponibles}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.presLogout}>
            <Text style={styles.presLogoutTxt}>Salir</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ── Cargando ──────────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color="#C8102E" size="large" />
        <Text style={styles.txtCargando}>Cargando...</Text>
      </View>
    );
  }

  // ── Sin pregunta ──────────────────────────────────────────
  if (estado === 'sin-pregunta') {
    return (
      <View style={styles.container}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={styles.esperaCard}>
          <Text style={styles.esperaIcono}>⏳</Text>
          <Text style={styles.esperaTitulo}>EN ESPERA</Text>
          <Text style={styles.esperaMsg}>
            Espera las instrucciones del administrador
          </Text>
          <Text style={styles.esperaSub}>
            Cuando se abra una votación, aparecerá aquí automáticamente.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.btnHistorial}
          onPress={() => router.push('/historial-presidente')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ya votó (reglamento) ──────────────────────────────────
  if (estado === 'ya-voto-reglamento') {
    const col = COLOR_OPCION[miRespuesta] ?? { border: '#FFF', bg: '#333', text: '#FFF' };
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={[styles.yaVotoCard, { borderColor: col.border, backgroundColor: col.bg }]}>
          <Text style={styles.yaVotoIcono}>✅</Text>
          <Text style={[styles.yaVotoTitulo, { color: col.text }]}>YA EMITISTE TU VOTO</Text>
          {pregunta && (
            <Text style={styles.yaVotoPreguntaTxt}>{pregunta.texto}</Text>
          )}
          <View style={[styles.yaVotoBox, { borderColor: col.border }]}>
            <Text style={styles.yaVotoLabel}>TU VOTO FUE</Text>
            <Text style={[styles.yaVotoValor, { color: col.text }]}>{miRespuesta.toUpperCase()}</Text>
          </View>
          <Text style={styles.yaVotoPeso}>
            Peso emitido: {usuario?.votos_disponibles ?? 0} voto(s)
          </Text>
        </View>
        <TouchableOpacity
          style={styles.btnHistorial}
          onPress={() => router.push('/historial-presidente')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Ya votó (elección) ────────────────────────────────────
  if (estado === 'ya-voto-eleccion') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={[styles.yaVotoCard, { borderColor: '#003087', backgroundColor: '#EEF2FF' }]}>
          <Text style={styles.yaVotoIcono}>🔒</Text>
          <Text style={[styles.yaVotoTitulo, { color: '#003087' }]}>YA EMITISTE TU VOTO</Text>
          {pregunta && (
            <Text style={[styles.yaVotoPreguntaTxt, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              {pregunta.texto}
            </Text>
          )}
          <View style={[styles.yaVotoBox, { borderColor: '#003087' }]}>
            <Text style={styles.yaVotoLabel}>CANDIDATOS SELECCIONADOS</Text>
            {candidatosVotados.length > 0 ? (
              candidatosVotados.map(c => (
                <View key={c.id} style={styles.yaVotoCandFila}>
                  <Text style={styles.yaVotoCandCheck}>✓</Text>
                  <Text style={styles.yaVotoCandNombre}>{c.nombre}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.yaVotoValor, { color: '#003087', fontSize: 18 }]}>
                Voto confidencial
              </Text>
            )}
          </View>
          <Text style={styles.yaVotoPeso}>
            Peso emitido: {usuario?.votos_disponibles ?? 0} voto(s) por candidato
          </Text>
        </View>
        <TouchableOpacity
          style={styles.btnHistorial}
          onPress={() => router.push('/historial-presidente')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Voto completado (countdown) ───────────────────────────
  if (estado === 'completado') {
    const esElec = opcionConfirmada === 'eleccion';
    const col = esElec ? { border: '#22C55E', text: '#22C55E' } : (COLOR_OPCION[opcionConfirmada] ?? { border: '#22C55E', text: '#22C55E' });
    return (
      <View style={styles.container}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <View style={[styles.completadoCard, { borderColor: col.border }]}>
          <Text style={styles.completadoIcono}>✅</Text>
          <Text style={[styles.completadoTitulo, { color: col.text }]}>
            ¡VOTO REGISTRADO CON ÉXITO!
          </Text>
          {!esElec && (
            <View style={[styles.completadoOpcionBox, { borderColor: col.border }]}>
              <Text style={[styles.completadoOpcion, { color: col.text }]}>
                {opcionConfirmada.toUpperCase()}
              </Text>
            </View>
          )}
          {esElec && (
            <Text style={styles.completadoSecreto}>Tu voto fue registrado de forma confidencial.</Text>
          )}
          <Text style={styles.completadoContador}>
            Cerrando en {contador} segundo{contador !== 1 ? 's' : ''}...
          </Text>
        </View>
      </View>
    );
  }

  // ── Confirmación reglamento ───────────────────────────────
  if (estado === 'confirmando-reglamento') {
    const col = COLOR_OPCION[opcionPendiente] ?? { border: '#FFF', bg: '#333', text: '#FFF' };
    return (
      <View style={styles.container}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={styles.confirmarCard}>
          <Text style={styles.confirmarPregunta}>{pregunta?.texto}</Text>

          <Text style={styles.confirmarTitulo}>¿Estás seguro/a?</Text>
          <Text style={styles.confirmarSub}>
            Quieres votar:
          </Text>

          <View style={[styles.confirmarOpcionBox, { borderColor: col.border, backgroundColor: col.bg }]}>
            <Text style={[styles.confirmarOpcion, { color: col.text }]}>
              {opcionPendiente.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.confirmarAviso}>
            Esta acción no se puede deshacer.
          </Text>

          <TouchableOpacity
            style={[styles.btnConfirmar, { backgroundColor: col.border }, enviando && { opacity: 0.6 }]}
            onPress={confirmarVotoReglamento}
            disabled={enviando}
            activeOpacity={0.8}
          >
            {enviando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnConfirmarTxt}>SÍ, CONFIRMAR MI VOTO</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnVolver}
            onPress={() => setEstado('votando-reglamento')}
            disabled={enviando}
            activeOpacity={0.8}
          >
            <Text style={styles.btnVolverTxt}>NO, VOLVER ATRÁS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Confirmación elección ─────────────────────────────────
  if (estado === 'confirmando-eleccion') {
    const nombresSeleccionados = seleccionados
      .map(id => candidatos.find(c => c.id === id)?.nombre ?? '')
      .filter(Boolean);

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={styles.confirmarCard}>
          <Text style={styles.confirmarPregunta}>{pregunta?.texto}</Text>

          <Text style={styles.confirmarTitulo}>¿Estás seguro/a?</Text>
          <Text style={styles.confirmarSub}>Quieres votar por:</Text>

          <View style={styles.confirmarListaCands}>
            {nombresSeleccionados.map((n, i) => (
              <View key={i} style={styles.confirmarCandFila}>
                <Text style={styles.confirmarCandIcono}>✅</Text>
                <Text style={styles.confirmarCandNombre}>{n}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.confirmarAviso}>Esta acción no se puede deshacer.</Text>

          <TouchableOpacity
            style={[styles.btnConfirmar, { backgroundColor: '#C8102E' }, enviando && { opacity: 0.6 }]}
            onPress={confirmarVotoEleccion}
            disabled={enviando}
            activeOpacity={0.8}
          >
            {enviando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnConfirmarTxt}>SÍ, CONFIRMAR MI VOTO</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnVolver}
            onPress={() => setEstado('votando-eleccion')}
            disabled={enviando}
            activeOpacity={0.8}
          >
            <Text style={styles.btnVolverTxt}>NO, VOLVER ATRÁS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Votando: reglamento ───────────────────────────────────
  if (estado === 'votando-reglamento') {
    return (
      <View style={styles.container}>
        <ModalCerrado />
        <ModalWarningInactividad />
        <PresHeader />
        <View style={styles.preguntaCard}>
          <View style={styles.tipoBadge}>
            <Text style={styles.tipoBadgeTxt}>📜 REGLAMENTO</Text>
          </View>
          <Text style={styles.preguntaTexto}>{pregunta?.texto}</Text>
        </View>

        <Text style={styles.instruccion}>ELIGE UNA OPCIÓN</Text>

        {(['Apruebo', 'Rechazo', 'Abstengo'] as const).map(op => {
          const c = COLOR_OPCION[op];
          const iconos: Record<string, string> = { Apruebo: '✅', Rechazo: '❌', Abstengo: '⬜' };
          return (
            <TouchableOpacity
              key={op}
              style={[styles.opcionBtn, { borderColor: c.border, backgroundColor: c.bg }]}
              onPress={() => { resetInactividad(); seleccionarOpcionReglamento(op); }}
              activeOpacity={0.8}
            >
              <Text style={styles.opcionIcono}>{iconos[op]}</Text>
              <Text style={[styles.opcionTxt, { color: c.text }]}>{op.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.btnHistorial, { marginTop: 8 }]}
          onPress={() => router.push('/historial-presidente')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Votando: elección ─────────────────────────────────────
  const max = pregunta?.max_selecciones ?? 1;
  const limitAlcanzado = seleccionados.length >= max;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <ModalCerrado />
      <PresHeader />

      <View style={[styles.preguntaCard, { borderColor: C.azul }]}>
        <View style={[styles.tipoBadge, { backgroundColor: C.azul }]}>
          <Text style={styles.tipoBadgeTxt}>🗳 ELECCIÓN</Text>
        </View>
        <Text style={styles.preguntaTexto}>{pregunta?.texto}</Text>
      </View>

      <View style={styles.contadorRow}>
        <Text style={styles.instruccion}>SELECCIONA HASTA {max} CANDIDATO(S)</Text>
        <Text style={[styles.contadorChips, { color: limitAlcanzado ? '#16A34A' : C.rojo }]}>
          {seleccionados.length} / {max}
        </Text>
      </View>

      {candidatos.map(c => {
        const sel = seleccionados.includes(c.id);
        const desactivado = !sel && limitAlcanzado;
        return (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.candidatoItem,
              sel && styles.candidatoSel,
              desactivado && styles.candidatoDes,
            ]}
            onPress={() => toggleCandidato(c.id)}
            activeOpacity={desactivado ? 1 : 0.8}
          >
            <View style={[styles.checkbox, sel && styles.checkboxSel]}>
              {sel && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[styles.candidatoNombre, sel && { color: C.azul, fontWeight: '800' }, desactivado && { color: '#BBBBBB' }]}>
              {c.nombre}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.btnConfirmar, { backgroundColor: C.rojo, marginTop: 16 }, seleccionados.length === 0 && { opacity: 0.3 }]}
        onPress={seleccionarEleccion}
        disabled={seleccionados.length === 0}
        activeOpacity={0.8}
      >
        <Text style={styles.btnConfirmarTxt}>CONFIRMAR SELECCIÓN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnHistorial, { marginTop: 12 }]}
        onPress={() => router.push('/historial-presidente')}
        activeOpacity={0.8}
      >
        <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 20, paddingTop: 16 },
  scroll: { flex: 1, backgroundColor: C.fondo },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo, gap: 14 },
  txtCargando: { color: C.txtSecundario, fontSize: 18 },

  // Header presidente
  offlineBanner: {
    backgroundColor: '#7F1D1D', borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 14, marginBottom: 8, alignItems: 'center',
  },
  offlineTxt: { color: '#FCA5A5', fontSize: 13, fontWeight: '700' },
  presHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.azul, borderRadius: 12, padding: 14,
    marginBottom: 16,
  },
  presInfo: { flex: 1 },
  presNombreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presNombre: { color: C.blanco, fontSize: 18, fontWeight: '800' },
  conectadoDot: { fontSize: 14 },
  presPeso: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  presLogout: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, height: 42, justifyContent: 'center',
  },
  presLogoutTxt: { color: C.blanco, fontSize: 13, fontWeight: '700' },

  // Espera
  esperaCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.tarjeta, borderRadius: 20, padding: 40,
    borderWidth: 1, borderColor: C.borde, borderStyle: 'dashed',
  },
  esperaIcono: { fontSize: 80, marginBottom: 20 },
  esperaTitulo: { fontSize: 22, fontWeight: '900', color: C.txtTercero, letterSpacing: 3, marginBottom: 16 },
  esperaMsg: { fontSize: 22, color: C.txtPrimario, textAlign: 'center', fontWeight: '700', marginBottom: 12, lineHeight: 30 },
  esperaSub: { fontSize: 16, color: C.txtSecundario, textAlign: 'center', lineHeight: 24 },

  // Ya votó
  yaVotoCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, padding: 32, borderWidth: 2,
  },
  yaVotoIcono: { fontSize: 80, marginBottom: 16 },
  yaVotoTitulo: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  yaVotoSub: { fontSize: 16, color: C.txtSecundario, marginBottom: 24 },
  yaVotoBox: {
    width: '100%', backgroundColor: C.blanco, borderRadius: 14,
    padding: 20, alignItems: 'center', borderWidth: 2, marginBottom: 16,
  },
  yaVotoLabel: { fontSize: 12, color: C.txtSecundario, letterSpacing: 2, marginBottom: 8 },
  yaVotoValor: { fontSize: 30, fontWeight: '900' },
  yaVotoPreguntaTxt: {
    fontSize: 18, fontWeight: '600', color: C.txtPrimario,
    textAlign: 'center', lineHeight: 26, backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10, padding: 12,
  },
  btnHistorial: {
    backgroundColor: C.azul, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 12, minHeight: 60,
    justifyContent: 'center',
  },
  btnHistorialTxt: { color: C.blanco, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  yaVotoCandFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  yaVotoCandCheck: { color: '#16A34A', fontSize: 20, fontWeight: '900' },
  yaVotoCandNombre: { fontSize: 19, fontWeight: '700', color: C.azul, flex: 1 },
  yaVotoSecreto: { fontSize: 16, color: C.txtSecundario, textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  yaVotoPeso: { fontSize: 13, color: C.txtTercero, textAlign: 'center' },

  // Completado (countdown)
  completadoCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, padding: 32, borderWidth: 3,
    backgroundColor: C.fondo,
  },
  completadoIcono: { fontSize: 100, marginBottom: 20 },
  completadoTitulo: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: 1, marginBottom: 20 },
  completadoOpcionBox: {
    width: '100%', backgroundColor: C.blanco, borderRadius: 14,
    padding: 20, alignItems: 'center', borderWidth: 2, marginBottom: 20,
  },
  completadoOpcion: { fontSize: 32, fontWeight: '900' },
  completadoSecreto: { fontSize: 16, color: C.txtSecundario, textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  completadoContador: { fontSize: 16, color: C.txtTercero, fontStyle: 'italic' },

  // Confirmación
  confirmarCard: {
    flex: 1, backgroundColor: C.tarjeta, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: C.borde, gap: 14,
  },
  confirmarPregunta: { fontSize: 15, color: C.txtSecundario, lineHeight: 22, fontStyle: 'italic' },
  confirmarTitulo: { fontSize: 28, fontWeight: '900', color: C.txtPrimario, textAlign: 'center' },
  confirmarSub: { fontSize: 20, color: C.txtSecundario, textAlign: 'center' },
  confirmarOpcionBox: {
    borderWidth: 3, borderRadius: 16, padding: 24, alignItems: 'center',
  },
  confirmarOpcion: { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  confirmarAviso: { fontSize: 16, color: C.txtSecundario, textAlign: 'center', lineHeight: 22 },
  confirmarListaCands: { gap: 10 },
  confirmarCandFila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.blanco, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.borde,
  },
  confirmarCandIcono: { fontSize: 22 },
  confirmarCandNombre: { fontSize: 20, color: C.txtPrimario, fontWeight: '700', flex: 1 },

  // Botones confirmación
  btnConfirmar: {
    borderRadius: 14, paddingVertical: 22, alignItems: 'center',
    justifyContent: 'center', minHeight: 70,
  },
  btnConfirmarTxt: { color: C.blanco, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  btnVolver: {
    borderWidth: 1.5, borderColor: C.borde, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', minHeight: 60,
    backgroundColor: C.tarjeta,
  },
  btnVolverTxt: { color: C.txtSecundario, fontSize: 17, fontWeight: '700' },

  // Pregunta card
  preguntaCard: {
    backgroundColor: C.tarjeta, borderRadius: 14, padding: 20,
    marginBottom: 20, borderWidth: 2, borderColor: C.azul,
  },
  tipoBadge: {
    backgroundColor: C.rojo, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12,
  },
  tipoBadgeTxt: { color: C.blanco, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  preguntaTexto: { fontSize: 27, fontWeight: '700', color: C.txtPrimario, lineHeight: 36 },

  instruccion: { color: C.azul, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },

  // Opciones reglamento
  opcionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 2.5, borderRadius: 18, paddingVertical: 22,
    paddingHorizontal: 24, marginBottom: 14, minHeight: 70,
  },
  opcionIcono: { fontSize: 32 },
  opcionTxt: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },

  // Candidatos
  contadorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  contadorChips: { fontSize: 20, fontWeight: '900' },
  candidatoItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.blanco,
    borderRadius: 14, padding: 20, marginBottom: 10,
    borderWidth: 2, borderColor: C.borde, gap: 14, minHeight: 70,
  },
  candidatoSel: { borderColor: C.rojo, backgroundColor: C.rojoBg },
  candidatoDes: { opacity: 0.35 },
  checkbox: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 2,
    borderColor: C.txtTercero, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSel: { backgroundColor: C.rojo, borderColor: C.rojo },
  checkMark: { color: C.blanco, fontSize: 18, fontWeight: '900' },
  candidatoNombre: { flex: 1, fontSize: 19, fontWeight: '600', color: C.txtSecundario },

  // Modal votación cerrada
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    backgroundColor: C.blanco, borderRadius: 20, padding: 32,
    alignItems: 'center', width: '100%', gap: 14,
  },
  modalIcono: { fontSize: 56 },
  modalTitulo: { fontSize: 22, fontWeight: '900', color: C.azul, textAlign: 'center' },
  modalMsg: { fontSize: 16, color: C.txtSecundario, textAlign: 'center', lineHeight: 24 },
  modalBtn: {
    backgroundColor: C.azul, borderRadius: 12, paddingVertical: 16,
    paddingHorizontal: 32, alignItems: 'center', marginTop: 4,
  },
  modalBtnTxt: { color: C.blanco, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
