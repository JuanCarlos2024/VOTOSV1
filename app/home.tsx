import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Modal, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import type { Pregunta, Candidato, Usuario } from '../lib/supabase';
import { obtenerUsuario, cerrarSesion } from '../lib/auth';
import { C } from '../lib/theme';
import { registrar } from '../lib/auditoria';
import { hapticSuccess } from '../lib/haptics';
import { useInactividad } from '../lib/hooks/useInactividad';
import { useConexion } from '../lib/hooks/useConexion';
import { useVotoPendiente, PENDING_KEY, type VotoPendiente } from '../lib/hooks/useVotoPendiente';

import PantallaEspera from '../components/presidente/PantallaEspera';
import PantallaPresentacion from '../components/presidente/PantallaPresentacion';
import VotarReglamento from '../components/presidente/VotarReglamento';
import VotarEleccion from '../components/presidente/VotarEleccion';
import ConfirmacionReglamento from '../components/presidente/ConfirmacionReglamento';
import ConfirmacionEleccion from '../components/presidente/ConfirmacionEleccion';
import YaVoto from '../components/presidente/YaVoto';
import VotoCompletado from '../components/presidente/VotoCompletado';

type Estado =
  | 'cargando' | 'sin-pregunta'
  | 'proyectada'
  | 'votando-reglamento' | 'confirmando-reglamento'
  | 'votando-eleccion'  | 'confirmando-eleccion'
  | 'completado'
  | 'ya-voto-reglamento' | 'ya-voto-eleccion';

export default function HomeScreen() {
  // ── Hooks ──────────────────────────────────────────────
  const usuarioRef = useRef<Usuario | null>(null);
  const { modalWarning, setModalWarning, resetInactividad, limpiarTimers } = useInactividad(usuarioRef);
  const { conectado } = useConexion();
  const { msgPendiente, setMsgPendiente } = useVotoPendiente(conectado, () => cargar());

  // ── State ──────────────────────────────────────────────
  const [estado, setEstado]                   = useState<Estado>('cargando');
  const [usuario, setUsuario]                 = useState<Usuario | null>(null);
  const [pregunta, setPregunta]               = useState<Pregunta | null>(null);
  const [candidatos, setCandidatos]           = useState<Candidato[]>([]);
  const [seleccionados, setSeleccionados]     = useState<string[]>([]);
  const [opcionPendiente, setOpcionPendiente] = useState('');
  const [opcionConfirmada, setOpcionConfirmada] = useState('');
  const [miRespuesta, setMiRespuesta]         = useState('');
  const [enviando, setEnviando]               = useState(false);
  const [contador, setContador]               = useState(3);
  const [candidatosVotados, setCandidatosVotados] = useState<Candidato[]>([]);
  const [modalCerrado, setModalCerrado]       = useState(false);

  const preguntaIdRef = useRef<string | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const estadoRef     = useRef<Estado>('cargando');

  // Mantener estadoRef siempre fresco (evita stale closures en el intervalo)
  estadoRef.current = estado;

  // ── Effects ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Polling único persistente cada 3s — lee estadoRef.current (siempre fresco)
  // No depende de [estado] → nunca se recrea, nunca reinicia su cuenta regresiva
  useEffect(() => {
    const ESTADOS_ESPERA: Estado[]    = ['sin-pregunta'];
    const ESTADOS_PROYECTADA: Estado[] = ['proyectada'];
    const ESTADOS_VOTANDO: Estado[]   = [
      'votando-reglamento', 'confirmando-reglamento',
      'votando-eleccion',   'confirmando-eleccion',
    ];

    pollRef.current = setInterval(async () => {
      const est = estadoRef.current;

      if (ESTADOS_ESPERA.includes(est)) {
        // Detectar cuando el admin proyecta o abre una votación
        const { data } = await supabase
          .from('preguntas').select('id').in('estado', ['proyectada', 'abierta']).maybeSingle();
        if (data) cargar();

      } else if (ESTADOS_PROYECTADA.includes(est)) {
        // Detectar cambios de texto o de estado mientras está proyectada
        const id = preguntaIdRef.current;
        if (!id) return;
        const { data } = await supabase
          .from('preguntas').select('estado, texto').eq('id', id).maybeSingle();
        if (!data || data.estado === 'pendiente') {
          preguntaIdRef.current = null;
          setEstado('sin-pregunta');
        } else if (data.estado === 'abierta') {
          cargar();
        } else if (data.estado === 'proyectada') {
          // Actualizar texto en tiempo real si el admin lo editó
          setPregunta(prev => prev ? { ...prev, texto: data.texto } : prev);
        }

      } else if (ESTADOS_VOTANDO.includes(est)) {
        // Detectar si el admin cerró la votación mientras el presidente vota
        const id = preguntaIdRef.current;
        if (!id) return;
        const { data } = await supabase
          .from('preguntas').select('estado').eq('id', id).maybeSingle();
        if (data?.estado === 'cerrada') setModalCerrado(true);
      }
    }, 3000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  // Realtime: detectar cambios de pregunta
  useEffect(() => {
    const ch = supabase
      .channel('home-preguntas-cambios')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'preguntas' }, payload => {
        const nueva = payload.new as any;

        // Pregunta que el presidente está viendo o votando
        if (nueva.id === preguntaIdRef.current) {
          if (nueva.estado === 'cerrada') {
            setModalCerrado(true);
          } else if (nueva.estado === 'abierta' && estadoRef.current === 'proyectada') {
            // Admin liberó la votación — pasar a flujo de voto
            cargar();
          } else if (nueva.estado === 'pendiente' && estadoRef.current === 'proyectada') {
            // Admin retiró la proyección
            preguntaIdRef.current = null;
            setEstado('sin-pregunta');
          } else if (nueva.estado === 'proyectada') {
            // Admin editó el texto mientras estaba proyectada
            setPregunta(prev => prev ? { ...prev, texto: nueva.texto } : prev);
          }
        }

        // Nueva pregunta proyectada o abierta — detectar desde espera
        if ((nueva.estado === 'proyectada' || nueva.estado === 'abierta') &&
            estadoRef.current === 'sin-pregunta') {
          cargar();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      resetInactividad();
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        limpiarTimers();
      };
    }, [])
  );

  // ── Carga ──────────────────────────────────────────────
  async function cargar() {
    setEstado('cargando');
    const u = await obtenerUsuario();
    if (!u) { router.replace('/'); return; }
    setUsuario(u);
    usuarioRef.current = u;
    setSeleccionados([]);
    setOpcionPendiente('');

    // Buscar pregunta proyectada o abierta
    const { data: pregVisible } = await supabase
      .from('preguntas').select('*')
      .in('estado', ['proyectada', 'abierta'])
      .maybeSingle();

    if (!pregVisible) {
      // Si el usuario estaba votando y la pregunta desapareció → admin la cerró
      const estabaVotando: Estado[] = [
        'votando-reglamento', 'confirmando-reglamento',
        'votando-eleccion',   'confirmando-eleccion',
      ];
      if (preguntaIdRef.current && estabaVotando.includes(estadoRef.current)) {
        setModalCerrado(true);
      } else {
        setEstado('sin-pregunta');
      }
      preguntaIdRef.current = null;
      return;
    }

    setPregunta(pregVisible as Pregunta);
    preguntaIdRef.current = pregVisible.id;

    // Si está proyectada → solo mostrar el texto, sin votar
    if (pregVisible.estado === 'proyectada') {
      setEstado('proyectada');
      return;
    }

    // Estado 'abierta' → flujo normal de voto
    const { data: votoExist } = await supabase
      .from('votos').select('respuesta')
      .eq('pregunta_id', pregVisible.id).eq('usuario_id', u.id).limit(1);

    if (votoExist && votoExist.length > 0) {
      if (pregVisible.tipo === 'reglamento') {
        setMiRespuesta(votoExist[0].respuesta);
        setEstado('ya-voto-reglamento');
      } else {
        const { data: misVotos } = await supabase
          .from('votos').select('candidato_id')
          .eq('pregunta_id', pregVisible.id).eq('usuario_id', u.id);
        const ids = (misVotos ?? []).map((v: any) => v.candidato_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: cands } = await supabase.from('candidatos').select('*').in('id', ids);
          setCandidatosVotados((cands ?? []) as Candidato[]);
        } else {
          setCandidatosVotados([]);
        }
        setEstado('ya-voto-eleccion');
      }
      return;
    }

    if (pregVisible.tipo === 'eleccion') {
      const { data: cands } = await supabase
        .from('candidatos').select('*').eq('pregunta_id', pregVisible.id).order('nombre');
      setCandidatos((cands ?? []) as Candidato[]);
      setEstado('votando-eleccion');
    } else {
      setEstado('votando-reglamento');
    }
  }

  // ── Votación ───────────────────────────────────────────
  function iniciarContador(opcionVotada: string) {
    setOpcionConfirmada(opcionVotada);
    setEstado('completado');
    setContador(3);
    countdownRef.current = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); cargar(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function toggleCandidato(id: string) {
    const max = pregunta?.max_selecciones ?? 1;
    setSeleccionados(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function confirmarVotoReglamento() {
    if (!usuario || !pregunta) return;
    resetInactividad();
    setEnviando(true);
    const fila = {
      pregunta_id: pregunta.id, usuario_id: usuario.id,
      respuesta: opcionPendiente, peso: usuario.votos_disponibles,
    };
    try {
      // Verificar que la votación sigue activa antes de insertar
      const { data: estadoActual } = await supabase
        .from('preguntas').select('estado').eq('id', pregunta.id).maybeSingle();
      if (estadoActual?.estado === 'cerrada') {
        setModalCerrado(true);
        return;
      }
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
          setEstado('votando-reglamento');
        }
        return;
      }
      hapticSuccess();
      await registrar('VOTO', usuario.nombre_usuario,
        `Votó: ${opcionPendiente.toUpperCase()}`, {
        usuario_id: usuario.id,
        asociacion_nombre: usuario.nombre_usuario,
        pregunta_id: pregunta.id,
        pregunta_texto: pregunta.texto.slice(0, 120),
      });
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
      pregunta_id: pregunta.id, usuario_id: usuario.id,
      candidato_id: cid,
      respuesta: candidatos.find(c => c.id === cid)?.nombre ?? cid,
      peso: usuario.votos_disponibles,
    }));
    try {
      // Verificar que la votación sigue activa antes de insertar
      const { data: estadoActual } = await supabase
        .from('preguntas').select('estado').eq('id', pregunta.id).maybeSingle();
      if (estadoActual?.estado === 'cerrada') {
        setModalCerrado(true);
        return;
      }
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
          setEstado('votando-eleccion');
        }
        return;
      }
      hapticSuccess();
      await registrar('VOTO', usuario.nombre_usuario,
        `Votó: ${seleccionados.length} candidato(s) seleccionado(s)`, {
        usuario_id: usuario.id,
        asociacion_nombre: usuario.nombre_usuario,
        pregunta_id: pregunta.id,
        pregunta_texto: pregunta.texto.slice(0, 120),
      });
      iniciarContador('eleccion');
    } finally {
      setEnviando(false);
    }
  }

  function handleLogout() {
    limpiarTimers();
    const u = usuarioRef.current;
    if (u) registrar('LOGOUT', u.nombre_usuario, 'Cierre de sesión manual', {
      usuario_id: u.id,
      asociacion_nombre: u.nombre_usuario,
    });
    cerrarSesion().then(() => router.replace('/'));
  }

  // ── Props compartidos para screens con header ─────────
  const headerProps = {
    usuario: usuario!,
    conectado,
    msgPendiente,
    onClearMsg: () => setMsgPendiente(''),
    onLogout: handleLogout,
  };

  // ── Render ─────────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.rojo} size="large" />
        <Text style={styles.txtCargando}>Cargando...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Modales — se renderizan sobre cualquier estado */}
      <Modal visible={modalCerrado} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>🔒</Text>
            <Text style={styles.modalTitulo}>Votación Cerrada</Text>
            <Text style={styles.modalMsg}>
              Esta votación fue cerrada por el administrador.{'\n'}Su voto no ha sido registrado.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setModalCerrado(false); cargar(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>VOLVER AL INICIO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              onPress={() => { resetInactividad(); setModalWarning(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>CONTINUAR SESIÓN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pantallas */}
      {estado === 'sin-pregunta' && (
        <PantallaEspera {...headerProps} />
      )}
      {estado === 'proyectada' && pregunta && (
        <PantallaPresentacion {...headerProps} pregunta={pregunta} />
      )}
      {estado === 'ya-voto-reglamento' && (
        <YaVoto {...headerProps} pregunta={pregunta!} tipo="reglamento"
          miRespuesta={miRespuesta} candidatosVotados={[]} onActualizar={cargar} />
      )}
      {estado === 'ya-voto-eleccion' && (
        <YaVoto {...headerProps} pregunta={pregunta!} tipo="eleccion"
          miRespuesta="" candidatosVotados={candidatosVotados} onActualizar={cargar} />
      )}
      {estado === 'completado' && (
        <VotoCompletado opcionConfirmada={opcionConfirmada} contador={contador} />
      )}
      {estado === 'confirmando-reglamento' && (
        <ConfirmacionReglamento {...headerProps} pregunta={pregunta!}
          opcionPendiente={opcionPendiente} enviando={enviando}
          onConfirmar={confirmarVotoReglamento}
          onVolver={() => setEstado('votando-reglamento')} />
      )}
      {estado === 'confirmando-eleccion' && (
        <ConfirmacionEleccion {...headerProps} pregunta={pregunta!}
          seleccionados={seleccionados} candidatos={candidatos}
          enviando={enviando} onConfirmar={confirmarVotoEleccion}
          onVolver={() => setEstado('votando-eleccion')} />
      )}
      {estado === 'votando-reglamento' && (
        <VotarReglamento {...headerProps} pregunta={pregunta!}
          resetInactividad={resetInactividad}
          onSeleccionar={op => { setOpcionPendiente(op); setEstado('confirmando-reglamento'); }} />
      )}
      {estado === 'votando-eleccion' && (
        <VotarEleccion {...headerProps} pregunta={pregunta!}
          candidatos={candidatos} seleccionados={seleccionados}
          resetInactividad={resetInactividad} onToggle={toggleCandidato}
          onConfirmar={() => setEstado('confirmando-eleccion')} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.fondo, gap: 14,
  },
  txtCargando: { color: C.txtSecundario, fontSize: 18 },
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
