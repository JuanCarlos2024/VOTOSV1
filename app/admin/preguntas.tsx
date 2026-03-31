import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { exportarResultadosPDF } from '../../lib/pdf';
import { supabase, Pregunta } from '../../lib/supabase';
import { C } from '../../lib/theme';
import { registrar } from '../../lib/auditoria';

type ResumenVoto = {
  opcion: string;
  peso: number;
  asociaciones: number;
  color: string;
};

type ConfirmData = {
  titulo: string;
  mensaje: string;
  btnTexto: string;
  btnColor: string;
  onConfirmar: () => Promise<void>;
};

export default function PreguntasScreen() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalResumen, setModalResumen] = useState(false);
  const [resumenPregunta, setResumenPregunta] = useState<Pregunta | null>(null);
  const [resumenDatos, setResumenDatos] = useState<ResumenVoto[]>([]);
  const [resumenTotal, setResumenTotal] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  // Unanimidad — double confirmation
  const [unanimidadPregunta, setUnanimidadPregunta] = useState<Pregunta | null>(null);
  const [unanimidadPaso, setUnanimidadPaso] = useState<1 | 2>(1);
  const [unanimidadEjecutando, setUnanimidadEjecutando] = useState(false);
  // Cierre con pendientes
  type CierrePendiente = { pregunta: Pregunta; pendientes: string[] };
  const [cierrePendiente, setCierrePendiente] = useState<CierrePendiente | null>(null);
  const [cerrandoForzado, setCerrandoForzado] = useState(false);

  function confirmar(data: ConfirmData) {
    setMsgError('');
    setConfirmData(data);
  }

  async function ejecutarConfirm() {
    if (!confirmData) return;
    setEjecutando(true);
    try {
      await confirmData.onConfirmar();
    } finally {
      setEjecutando(false);
      setConfirmData(null);
    }
  }

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
      .order('created_at', { ascending: false });
    setPreguntas((data ?? []) as Pregunta[]);
    setCargando(false);
  }

  async function proyectar(pregunta: Pregunta) {
    // Verificar que no haya otra proyectada o abierta
    const { data: ocupadas } = await supabase
      .from('preguntas').select('id').in('estado', ['proyectada', 'abierta']);

    if (ocupadas && ocupadas.length > 0) {
      setMsgError('Ya hay una pregunta proyectada o abierta. Ciérrala primero.');
      return;
    }

    confirmar({
      titulo: 'Proyectar Pregunta',
      mensaje: `¿Proyectar esta pregunta a los presidentes?\n\n"${pregunta.texto}"\n\nPodrán ver el texto pero NO votar aún.`,
      btnTexto: 'Sí, Proyectar',
      btnColor: '#1D4ED8',
      onConfirmar: async () => {
        const { error } = await supabase
          .from('preguntas').update({ estado: 'proyectada' }).eq('id', pregunta.id);
        if (error) { setMsgError(`No se pudo proyectar: ${error.message}`); return; }
        await registrar('PROYECTAR', 'admin', 'Pregunta proyectada para revisión', {
          pregunta_id: pregunta.id,
          pregunta_texto: pregunta.texto.slice(0, 120),
        });
        cargar();
      },
    });
  }

  async function despoyectar(pregunta: Pregunta) {
    confirmar({
      titulo: 'Dejar de Proyectar',
      mensaje: `¿Retirar esta pregunta de la proyección?\n\n"${pregunta.texto}"\n\nVolverá al estado pendiente.`,
      btnTexto: 'Sí, Retirar',
      btnColor: '#6B7280',
      onConfirmar: async () => {
        const { error } = await supabase
          .from('preguntas').update({ estado: 'pendiente' }).eq('id', pregunta.id);
        if (error) { setMsgError(`No se pudo retirar: ${error.message}`); return; }
        cargar();
      },
    });
  }

  async function liberar(pregunta: Pregunta) {
    const { data: abiertas } = await supabase
      .from('preguntas').select('id').eq('estado', 'abierta');

    if (abiertas && abiertas.length > 0) {
      setMsgError('Ya existe una votación abierta. Ciérrala primero antes de activar otra.');
      return;
    }

    confirmar({
      titulo: 'Liberar Votación',
      mensaje: `¿Abrir la votación ahora?\n\n"${pregunta.texto}"\n\nLos presidentes podrán votar inmediatamente.`,
      btnTexto: 'Sí, Liberar',
      btnColor: '#15803D',
      onConfirmar: async () => {
        const { error } = await supabase
          .from('preguntas').update({ estado: 'abierta', fecha_apertura: new Date().toISOString() }).eq('id', pregunta.id);
        if (error) {
          setMsgError(`No se pudo liberar la votación: ${error.message}`);
          return;
        }
        await registrar('LIBERAR', 'admin', 'Votación liberada — presidentes pueden votar', {
          pregunta_id: pregunta.id,
          pregunta_texto: pregunta.texto.slice(0, 120),
        });
        cargar();
      },
    });
  }

  async function cerrar(pregunta: Pregunta) {
    if (pregunta.estado !== 'abierta') return;
    // Verificar pendientes antes de mostrar modal
    const [{ data: usuarios }, { data: votos }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre_usuario').eq('rol', 'presidente'),
      supabase.from('votos').select('usuario_id').eq('pregunta_id', pregunta.id),
    ]);
    const votadosIds = new Set((votos ?? []).map((v: any) => v.usuario_id));
    const pendientes = (usuarios ?? [])
      .filter((u: any) => !votadosIds.has(u.id))
      .map((u: any) => u.nombre_usuario as string);

    if (pendientes.length > 0) {
      // Hay pendientes: mostrar modal de advertencia específico
      setCierrePendiente({ pregunta, pendientes });
    } else {
      // Todos votaron: confirmación simple
      confirmar({
        titulo: 'Cerrar Votación',
        mensaje: `¿Cerrar esta votación?\n\n"${pregunta.texto}"\n\nTodas las asociaciones ya emitieron su voto.`,
        btnTexto: 'Sí, Cerrar',
        btnColor: '#374151',
        onConfirmar: () => ejecutarCierre(pregunta, 0),
      });
    }
  }

  async function ejecutarCierre(pregunta: Pregunta, pendientesCount: number) {
    const { error } = await supabase
      .from('preguntas')
      .update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() })
      .eq('id', pregunta.id);
    if (error) {
      setMsgError(`No se pudo cerrar la votación: ${error.message}`);
      return;
    }
    const detalle = pendientesCount > 0
      ? `Pregunta cerrada. ${pendientesCount} asociación(es) con voto pendiente`
      : 'Pregunta cerrada. Todos los votos emitidos';
    await registrar('CERRAR', 'admin', detalle, {
      pregunta_id: pregunta.id,
      pregunta_texto: pregunta.texto.slice(0, 120),
    });
    cargar();
    mostrarResumen(pregunta);
  }

  async function confirmarCierreForzado() {
    if (!cierrePendiente) return;
    const { pregunta, pendientes } = cierrePendiente;
    setCierrePendiente(null);
    setCerrandoForzado(true);
    try {
      await ejecutarCierre(pregunta, pendientes.length);
    } finally {
      setCerrandoForzado(false);
    }
  }

  async function eliminar(pregunta: Pregunta) {
    confirmar({
      titulo: 'Eliminar Pregunta',
      mensaje: `¿ELIMINAR esta pregunta y todos sus votos?\n\n"${pregunta.texto}"\n\nEsta acción NO se puede deshacer.`,
      btnTexto: 'Sí, Eliminar',
      btnColor: C.rojo,
      onConfirmar: async () => {
        const { error } = await supabase.from('preguntas').delete().eq('id', pregunta.id);
        if (error) {
          setMsgError(`No se pudo eliminar la pregunta: ${error.message}`);
          return;
        }
        cargar();
      },
    });
  }

  function abrirUnanimidad(pregunta: Pregunta) {
    setMsgError('');
    setUnanimidadPregunta(pregunta);
    setUnanimidadPaso(1);
  }

  async function ejecutarUnanimidad() {
    if (!unanimidadPregunta) return;
    setUnanimidadEjecutando(true);
    try {
      // 1. Fetch all presidents and existing votes
      const [{ data: presidentes }, { data: votosExistentes }] = await Promise.all([
        supabase.from('usuarios').select('id, votos_disponibles').eq('rol', 'presidente'),
        supabase.from('votos').select('usuario_id').eq('pregunta_id', unanimidadPregunta.id),
      ]);

      // 2. Insert Apruebo for presidents who haven't voted
      const yaVotaron = new Set((votosExistentes ?? []).map((v: any) => v.usuario_id));
      const nuevosVotos = (presidentes ?? [])
        .filter((u: any) => !yaVotaron.has(u.id))
        .map((u: any) => ({
          pregunta_id: unanimidadPregunta.id,
          usuario_id: u.id,
          respuesta: 'Apruebo',
          peso: u.votos_disponibles ?? 1,
        }));

      if (nuevosVotos.length > 0) {
        const { error: errVotos } = await supabase.from('votos').insert(nuevosVotos);
        if (errVotos) {
          setMsgError(`Error al insertar votos: ${errVotos.message}`);
          return;
        }
      }

      // 3. Close question with unanimidad = true
      const { error: errPreg } = await supabase
        .from('preguntas')
        .update({ estado: 'cerrada', unanimidad: true, fecha_cierre: new Date().toISOString() })
        .eq('id', unanimidadPregunta.id);

      if (errPreg) {
        setMsgError(`Error al cerrar la votación: ${errPreg.message}`);
        return;
      }

      // 4. Audit log
      await registrar('UNANIMIDAD', 'admin', 'Aprobado por unanimidad', {
        pregunta_id: unanimidadPregunta.id,
        pregunta_texto: unanimidadPregunta.texto.slice(0, 120),
      });

      setUnanimidadPregunta(null);
      cargar();
    } finally {
      setUnanimidadEjecutando(false);
    }
  }

  async function mostrarResumen(pregunta: Pregunta) {
    const { data: votos } = await supabase
      .from('votos')
      .select('respuesta, peso, usuario_id')
      .eq('pregunta_id', pregunta.id);

    const COLORES: Record<string, string> = {
      Apruebo: '#16A34A',
      Rechazo: '#DC2626',
      Abstengo: '#9CA3AF',
    };

    if (pregunta.tipo === 'reglamento') {
      const agrupado: Record<string, { peso: number; usuarios: Set<string> }> = {};
      for (const v of votos ?? []) {
        if (!agrupado[v.respuesta]) agrupado[v.respuesta] = { peso: 0, usuarios: new Set() };
        agrupado[v.respuesta].peso += v.peso ?? 1;
        agrupado[v.respuesta].usuarios.add(v.usuario_id);
      }
      const opciones = ['Apruebo', 'Rechazo', 'Abstengo'];
      const datos: ResumenVoto[] = opciones.map(op => ({
        opcion: op,
        peso: agrupado[op]?.peso ?? 0,
        asociaciones: agrupado[op]?.usuarios.size ?? 0,
        color: COLORES[op],
      }));
      const total = datos.reduce((s, d) => s + d.peso, 0);
      setResumenDatos(datos);
      setResumenTotal(total);
    } else {
      const [{ data: cands }, { data: votosCand }] = await Promise.all([
        supabase.from('candidatos').select('id, nombre').eq('pregunta_id', pregunta.id),
        supabase.from('votos').select('candidato_id, peso, usuario_id').eq('pregunta_id', pregunta.id),
      ]);
      const agrupado: Record<string, { peso: number; usuarios: Set<string> }> = {};
      for (const v of votosCand ?? []) {
        const key = v.candidato_id;
        if (!key) continue;
        if (!agrupado[key]) agrupado[key] = { peso: 0, usuarios: new Set() };
        agrupado[key].peso += v.peso ?? 1;
        agrupado[key].usuarios.add(v.usuario_id);
      }
      const datos: ResumenVoto[] = (cands ?? [])
        .map((c: any) => ({
          opcion: c.nombre,
          peso: agrupado[c.id]?.peso ?? 0,
          asociaciones: agrupado[c.id]?.usuarios.size ?? 0,
          color: C.azul,
        }))
        .sort((a: any, b: any) => b.peso - a.peso);
      const total = datos.reduce((s, d) => s + d.peso, 0);
      setResumenDatos(datos);
      setResumenTotal(total);
    }

    setResumenPregunta(pregunta);
    setModalResumen(true);
  }

  async function exportarPDF(pregunta: Pregunta) {
    setExportando(true);
    try {
      await exportarResultadosPDF(pregunta);
    } finally {
      setExportando(false);
    }
  }

  function verSeguimiento(pregunta: Pregunta) {
    router.push(
      `/admin/seguimiento?id=${pregunta.id}&texto=${encodeURIComponent(pregunta.texto)}&tipo=${pregunta.tipo}`
    );
  }

  function verResultados(pregunta: Pregunta) {
    router.push(
      `/admin/resultados?id=${pregunta.id}&texto=${encodeURIComponent(pregunta.texto)}&tipo=${pregunta.tipo}`
    );
  }

  function colorEstado(estado: string) {
    if (estado === 'abierta')    return '#16A34A';
    if (estado === 'proyectada') return '#1D4ED8';
    if (estado === 'cerrada')    return '#374151';
    return '#EA580C'; // pendiente
  }

  function renderPregunta({ item }: { item: Pregunta }) {
    return (
      <View style={styles.tarjeta}>
        <View style={styles.badges}>
          <View style={[styles.estadoBadge, { backgroundColor: colorEstado(item.estado) }]}>
            <Text style={styles.badgeTexto}>{item.estado.toUpperCase()}</Text>
          </View>
          <View style={[styles.tipoBadge, { backgroundColor: item.tipo === 'eleccion' ? '#6D28D9' : '#1E40AF' }]}>
            <Text style={styles.badgeTexto}>{item.tipo.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.preguntaTexto}>{item.texto}</Text>

        {item.tipo === 'eleccion' && (
          <Text style={styles.maxSel}>
            Máx. {item.max_selecciones ?? 1} candidato(s) por asociación
          </Text>
        )}

        <View style={styles.acciones}>
          {item.estado === 'pendiente' && (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#1D4ED8' }]}
                onPress={() => proyectar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>📺 Proyectar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#374151' }]}
                onPress={() => router.push(`/admin/editar?id=${item.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#9F1239' }]}
                onPress={() => eliminar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>🗑 Eliminar</Text>
              </TouchableOpacity>
            </>
          )}
          {item.estado === 'proyectada' && (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#15803D' }]}
                onPress={() => liberar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>▶ Liberar Votación</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#1D4ED8' }]}
                onPress={() => router.push(`/admin/editar?id=${item.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#6B7280' }]}
                onPress={() => despoyectar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>⏹ Dejar de Proyectar</Text>
              </TouchableOpacity>
            </>
          )}
          {item.estado === 'abierta' && (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#374151' }]}
                onPress={() => cerrar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>⏹ Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#1E3A8A' }]}
                onPress={() => verSeguimiento(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>👁 Seguimiento</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnUnanimidad]}
                onPress={() => abrirUnanimidad(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnUnanimidadTexto}>✅ Aprobado por Unanimidad</Text>
              </TouchableOpacity>
            </>
          )}
          {item.estado === 'cerrada' && (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#1E3A8A' }]}
                onPress={() => verResultados(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>📊 Resultados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#065F46' }]}
                onPress={() => exportarPDF(item)}
                disabled={exportando}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>📄 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#9F1239' }]}
                onPress={() => eliminar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>🗑 Eliminar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  if (cargando && preguntas.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.rojo} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.botonCrear}
        onPress={() => router.push('/admin/crear')}
        activeOpacity={0.8}
      >
        <Text style={styles.botonCrearTexto}>+ Nueva Pregunta</Text>
      </TouchableOpacity>

      {/* Error inline */}
      {msgError !== '' && (
        <TouchableOpacity onPress={() => setMsgError('')} activeOpacity={0.8}>
          <View style={styles.msgError}>
            <Text style={styles.msgErrorTxt}>⚠️ {msgError}</Text>
            <Text style={styles.msgErrorCerrar}>✕</Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={preguntas}
        keyExtractor={item => item.id}
        renderItem={renderPregunta}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text style={styles.vacioIcono}>📋</Text>
            <Text style={styles.vacioTexto}>No hay preguntas creadas</Text>
            <Text style={styles.vacioSub}>Pulsa "+ Nueva Pregunta" para crear una</Text>
          </View>
        }
      />

      {/* Modal de confirmación (Liberar / Cerrar / Eliminar) */}
      <Modal visible={confirmData !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>{confirmData?.titulo}</Text>
            <Text style={styles.modalSubtitulo}>{confirmData?.mensaje}</Text>
            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: confirmData?.btnColor ?? C.azul }, ejecutando && { opacity: 0.6 }]}
                onPress={ejecutarConfirm}
                disabled={ejecutando}
                activeOpacity={0.8}
              >
                {ejecutando
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.modalBtnTexto}>{confirmData?.btnTexto}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.tarjeta2, borderWidth: 1, borderColor: C.borde }]}
                onPress={() => setConfirmData(null)}
                disabled={ejecutando}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnTexto, { color: C.txtPrimario }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Unanimidad — doble confirmación */}
      <Modal visible={unanimidadPregunta !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderTopWidth: 5, borderTopColor: '#1B5E20' }]}>
            <Text style={[styles.modalTitulo, { color: '#1B5E20' }]}>✅ Unanimidad</Text>

            {unanimidadPaso === 1 ? (
              <>
                <Text style={styles.modalSubtitulo} numberOfLines={4}>
                  ¿Confirmas que esta pregunta fue aprobada por unanimidad?{'\n\n'}
                  "{unanimidadPregunta?.texto}"{'\n\n'}
                  Esta acción cerrará la votación para todos.
                </Text>
                <View style={styles.modalBotones}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#1B5E20' }]}
                    onPress={() => setUnanimidadPaso(2)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalBtnTexto}>Sí, continuar →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: C.tarjeta2, borderWidth: 1, borderColor: C.borde }]}
                    onPress={() => setUnanimidadPregunta(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalBtnTexto, { color: C.txtPrimario }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.unanimidadAviso}>
                  <Text style={styles.unanimidadAvisoIcono}>⚠️</Text>
                  <Text style={styles.unanimidadAvisoTxt}>
                    Esta acción no se puede deshacer.{'\n'}Se insertará un voto APRUEBO por cada asociación que no haya votado.
                  </Text>
                </View>
                <Text style={styles.modalSubtitulo}>¿Confirmar definitivamente?</Text>
                <View style={styles.modalBotones}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#1B5E20' }, unanimidadEjecutando && { opacity: 0.6 }]}
                    onPress={ejecutarUnanimidad}
                    disabled={unanimidadEjecutando}
                    activeOpacity={0.8}
                  >
                    {unanimidadEjecutando
                      ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.modalBtnTexto}>✅ Confirmar Unanimidad</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: C.tarjeta2, borderWidth: 1, borderColor: C.borde }]}
                    onPress={() => { setUnanimidadPregunta(null); }}
                    disabled={unanimidadEjecutando}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalBtnTexto, { color: C.txtPrimario }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal cierre con pendientes */}
      <Modal visible={cierrePendiente !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderTopWidth: 5, borderTopColor: '#D97706' }]}>
            <Text style={[styles.modalTitulo, { color: '#92400E' }]}>⚠️ Votos Pendientes</Text>
            <Text style={styles.modalSubtitulo}>
              {`Aún hay ${cierrePendiente?.pendientes.length} asociación(es) con voto pendiente:`}
            </Text>

            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
              {(cierrePendiente?.pendientes ?? []).map((nombre, i) => (
                <View key={i} style={styles.pendienteFila}>
                  <Text style={styles.pendienteIcono}>⏳</Text>
                  <Text style={styles.pendienteNombre}>{nombre}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.pendienteAviso}>
              <Text style={styles.pendienteAvisoTxt}>
                ¿Estás seguro de cerrar la votación de todas formas?{'\n'}
                Los votos pendientes quedarán sin emitir y no podrán recuperarse.
              </Text>
            </View>

            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#374151' }, cerrandoForzado && { opacity: 0.6 }]}
                onPress={confirmarCierreForzado}
                disabled={cerrandoForzado}
                activeOpacity={0.8}
              >
                {cerrandoForzado
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.modalBtnTexto}>Sí, cerrar de todas formas</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.tarjeta2, borderWidth: 1, borderColor: C.borde }]}
                onPress={() => setCierrePendiente(null)}
                disabled={cerrandoForzado}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnTexto, { color: C.txtPrimario }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de resumen al cerrar */}
      <Modal visible={modalResumen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Votación Cerrada</Text>
            <Text style={styles.modalSubtitulo} numberOfLines={3}>
              {resumenPregunta?.texto}
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {resumenDatos.map((d, i) => {
                const pct = resumenTotal > 0 ? Math.round((d.peso / resumenTotal) * 100) : 0;
                return (
                  <View key={i} style={styles.resumenFila}>
                    <View style={styles.resumenLeft}>
                      <Text style={[styles.resumenOpcion, { color: d.color }]}>{d.opcion}</Text>
                      <Text style={styles.resumenAsoc}>{d.asociaciones} asoc.</Text>
                    </View>
                    <View style={styles.resumenRight}>
                      <Text style={[styles.resumenPeso, { color: d.color }]}>{d.peso} votos</Text>
                      <Text style={[styles.resumenPct, { color: d.color }]}>{pct}%</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.resumenTotalTexto}>Total ponderado: {resumenTotal} votos</Text>

            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.azul }]}
                onPress={() => {
                  setModalResumen(false);
                  if (resumenPregunta) exportarPDF(resumenPregunta);
                }}
              >
                <Text style={styles.modalBtnTexto}>📄 Exportar PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.tarjeta2, borderWidth: 1, borderColor: C.borde }]}
                onPress={() => setModalResumen(false)}
              >
                <Text style={[styles.modalBtnTexto, { color: C.txtPrimario }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 16, paddingTop: 16 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo },
  botonCrear: {
    backgroundColor: C.azul,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  botonCrearTexto: { color: C.blanco, fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  tarjeta: {
    backgroundColor: C.blanco,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { color: C.blanco, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  preguntaTexto: { fontSize: 16, fontWeight: '700', color: C.txtPrimario, marginBottom: 6, lineHeight: 22 },
  maxSel: { fontSize: 12, color: C.txtSecundario, marginBottom: 12 },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center', minHeight: 46, minWidth: 70 },
  btnTexto: { color: C.blanco, fontWeight: '700', fontSize: 13 },
  btnUnanimidad: {
    width: '100%', paddingVertical: 16, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1B5E20', minHeight: 56, marginTop: 4,
    shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  btnUnanimidadTexto: { color: C.blanco, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  unanimidadAviso: {
    backgroundColor: '#FEF9C3', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#F9A825',
  },
  unanimidadAvisoIcono: { fontSize: 22 },
  unanimidadAvisoTxt: { flex: 1, fontSize: 14, color: '#78350F', lineHeight: 20, fontWeight: '600' },
  msgError: {
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#DC2626',
    borderRadius: 10, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  msgErrorTxt: { color: '#DC2626', fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  msgErrorCerrar: { color: '#DC2626', fontSize: 16, fontWeight: '900', paddingLeft: 8 },

  pendienteFila: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  pendienteIcono: { fontSize: 14 },
  pendienteNombre: { fontSize: 14, color: '#374151', fontWeight: '600', flex: 1 },
  pendienteAviso: {
    backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  pendienteAvisoTxt: {
    fontSize: 13, color: '#92400E', fontWeight: '600', lineHeight: 19, textAlign: 'center',
  },
  vacio: { alignItems: 'center', paddingTop: 80 },
  vacioIcono: { fontSize: 48, marginBottom: 12 },
  vacioTexto: { color: C.txtPrimario, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  vacioSub: { color: C.txtSecundario, fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: C.blanco, borderRadius: 18, padding: 24,
    width: '100%', gap: 14,
  },
  modalTitulo: { fontSize: 20, fontWeight: '900', color: C.azul, textAlign: 'center' },
  modalSubtitulo: { fontSize: 14, color: C.txtSecundario, textAlign: 'center', lineHeight: 20 },
  resumenFila: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  resumenLeft: { flex: 1, gap: 2 },
  resumenOpcion: { fontSize: 15, fontWeight: '800' },
  resumenAsoc: { fontSize: 11, color: C.txtTercero },
  resumenRight: { alignItems: 'flex-end', gap: 2 },
  resumenPeso: { fontSize: 16, fontWeight: '900' },
  resumenPct: { fontSize: 12, fontWeight: '700' },
  resumenTotalTexto: { fontSize: 13, color: C.txtSecundario, textAlign: 'center', fontWeight: '700' },
  modalBotones: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnTexto: { color: C.blanco, fontWeight: '800', fontSize: 14 },
});
