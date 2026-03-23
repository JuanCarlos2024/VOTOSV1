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

  async function liberar(pregunta: Pregunta) {
    const { data: activas } = await supabase
      .from('preguntas').select('id').eq('estado', 'activa');

    if (activas && activas.length > 0) {
      setMsgError('Ya existe una votación activa. Ciérrala primero antes de activar otra.');
      return;
    }

    confirmar({
      titulo: 'Liberar Votación',
      mensaje: `¿Activar esta votación?\n\n"${pregunta.texto}"\n\nLos presidentes podrán votar inmediatamente.`,
      btnTexto: 'Sí, Liberar',
      btnColor: '#15803D',
      onConfirmar: async () => {
        const { error } = await supabase
          .from('preguntas').update({ estado: 'activa' }).eq('id', pregunta.id);
        if (error) {
          setMsgError(`No se pudo liberar la votación: ${error.message}`);
          return;
        }
        await registrar('LIBERAR', 'admin', pregunta.texto.slice(0, 80));
        cargar();
      },
    });
  }

  async function cerrar(pregunta: Pregunta) {
    confirmar({
      titulo: 'Cerrar Votación',
      mensaje: `¿Cerrar esta votación?\n\n"${pregunta.texto}"\n\nLos presidentes que no hayan votado ya no podrán hacerlo.`,
      btnTexto: 'Sí, Cerrar',
      btnColor: '#374151',
      onConfirmar: async () => {
        const { error } = await supabase
          .from('preguntas').update({ estado: 'cerrada' }).eq('id', pregunta.id);
        if (error) {
          setMsgError(`No se pudo cerrar la votación: ${error.message}`);
          return;
        }
        await registrar('CERRAR', 'admin', pregunta.texto.slice(0, 80));
        cargar();
        mostrarResumen(pregunta);
      },
    });
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
    if (estado === 'activa') return '#16A34A';
    if (estado === 'cerrada') return '#6B7280';
    return '#D97706';
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
          {item.estado === 'borrador' && (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#1D4ED8' }]}
                onPress={() => router.push(`/admin/editar?id=${item.id}`)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#15803D' }]}
                onPress={() => liberar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>▶ Liberar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#9F1239' }]}
                onPress={() => eliminar(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTexto}>🗑</Text>
              </TouchableOpacity>
            </>
          )}
          {item.estado === 'activa' && (
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
                <Text style={styles.btnTexto}>🗑</Text>
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
    backgroundColor: C.tarjeta,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borde,
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
  msgError: {
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#DC2626',
    borderRadius: 10, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  msgErrorTxt: { color: '#DC2626', fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  msgErrorCerrar: { color: '#DC2626', fontSize: 16, fontWeight: '900', paddingLeft: 8 },

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
