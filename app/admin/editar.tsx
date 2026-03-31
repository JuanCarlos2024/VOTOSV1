import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import { registrar } from '../../lib/auditoria';

export default function EditarPreguntaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [texto, setTexto] = useState('');
  const [textoOriginal, setTextoOriginal] = useState('');
  const [tipo, setTipo] = useState<'reglamento' | 'eleccion'>('reglamento');
  const [maxSelecciones, setMaxSelecciones] = useState('1');
  const [candidatos, setCandidatos] = useState<string[]>(['', '']);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [modalExito, setModalExito] = useState(false);

  useEffect(() => {
    if (!id) return;
    cargarDatos();
  }, [id]);

  async function cargarDatos() {
    setCargando(true);
    const [{ data: pregunta }, { data: cands }] = await Promise.all([
      supabase.from('preguntas').select('*').eq('id', id!).single(),
      supabase.from('candidatos').select('nombre').eq('pregunta_id', id!).order('nombre'),
    ]);

    if (!pregunta) {
      setMsgError('No se encontró la pregunta.');
      setCargando(false);
      return;
    }

    setTexto(pregunta.texto);
    setTextoOriginal(pregunta.texto);
    setTipo(pregunta.tipo);
    setMaxSelecciones(String(pregunta.max_selecciones ?? 1));
    if (pregunta.tipo === 'eleccion' && cands && cands.length >= 2) {
      setCandidatos(cands.map((c: any) => c.nombre));
    } else if (pregunta.tipo === 'eleccion') {
      setCandidatos(['', '']);
    }
    setCargando(false);
  }

  function agregarCandidato() {
    setCandidatos(prev => [...prev, '']);
  }

  function quitarCandidato(index: number) {
    if (candidatos.length <= 2) {
      setMsgError('Se requieren mínimo 2 candidatos.');
      return;
    }
    setCandidatos(prev => prev.filter((_, i) => i !== index));
  }

  function actualizarCandidato(index: number, valor: string) {
    setCandidatos(prev => prev.map((c, i) => (i === index ? valor : c)));
  }

  async function guardar() {
    setMsgError('');
    if (!texto.trim()) {
      setMsgError('Escribe el texto de la pregunta.');
      return;
    }

    if (tipo === 'eleccion') {
      const validos = candidatos.filter(c => c.trim().length > 0);
      if (validos.length < 2) {
        setMsgError('Agrega al menos 2 candidatos con nombre.');
        return;
      }
      const max = parseInt(maxSelecciones) || 1;
      if (max < 1 || max > validos.length) {
        setMsgError(`El máximo debe ser entre 1 y ${validos.length}.`);
        return;
      }
    }

    setGuardando(true);
    try {
      const max = tipo === 'eleccion' ? parseInt(maxSelecciones) || 1 : 1;

      const { error } = await supabase
        .from('preguntas')
        .update({ texto: texto.trim(), tipo, max_selecciones: max })
        .eq('id', id!);

      if (error) {
        setMsgError(`No se pudo actualizar la pregunta.\n${error.message}`);
        return;
      }

      if (tipo === 'eleccion') {
        await supabase.from('candidatos').delete().eq('pregunta_id', id!);
        const filas = candidatos
          .filter(c => c.trim().length > 0)
          .map(nombre => ({ pregunta_id: id!, nombre: nombre.trim(), imagen_url: null }));
        const { error: errorCands } = await supabase.from('candidatos').insert(filas);
        if (errorCands) {
          setMsgError('No se pudieron guardar los candidatos.');
          return;
        }
      } else {
        await supabase.from('candidatos').delete().eq('pregunta_id', id!);
      }

      // Audit EDITAR
      const detalle = textoOriginal !== texto.trim()
        ? `Texto anterior: "${textoOriginal.slice(0, 80)}" → Nuevo: "${texto.trim().slice(0, 80)}"`
        : `Tipo actualizado a ${tipo}`;
      await registrar('EDITAR', 'admin', detalle, {
        pregunta_id: id!,
        pregunta_texto: texto.trim().slice(0, 120),
      });

      setModalExito(true);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color={C.azul} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Error inline */}
        {msgError !== '' && (
          <TouchableOpacity onPress={() => setMsgError('')} activeOpacity={0.8}>
            <View style={styles.msgError}>
              <Text style={styles.msgErrorTxt}>⚠️ {msgError}</Text>
              <Text style={styles.msgErrorCerrar}>✕</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Texto */}
        <Text style={styles.etiqueta}>TEXTO DE LA PREGUNTA</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Escribe la pregunta o punto a votar..."
          placeholderTextColor={C.txtTercero}
          value={texto}
          onChangeText={setTexto}
          multiline
          numberOfLines={3}
        />

        {/* Tipo */}
        <Text style={styles.etiqueta}>TIPO DE VOTACIÓN</Text>
        <View style={styles.tipoSelector}>
          <TouchableOpacity
            style={[styles.tipoOpcion, tipo === 'reglamento' && styles.tipoActivo]}
            onPress={() => setTipo('reglamento')}
            activeOpacity={0.8}
          >
            <Text style={styles.tipoIcono}>📜</Text>
            <Text style={[styles.tipoTitulo, tipo === 'reglamento' && { color: C.azul, fontWeight: '900' }]}>
              Reglamento
            </Text>
            <Text style={styles.tipoDesc}>Apruebo / Rechazo / Abstengo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tipoOpcion, tipo === 'eleccion' && styles.tipoActivo]}
            onPress={() => setTipo('eleccion')}
            activeOpacity={0.8}
          >
            <Text style={styles.tipoIcono}>🗳</Text>
            <Text style={[styles.tipoTitulo, tipo === 'eleccion' && { color: C.azul, fontWeight: '900' }]}>
              Elección
            </Text>
            <Text style={styles.tipoDesc}>Selección de candidatos</Text>
          </TouchableOpacity>
        </View>

        {/* Campos de elección */}
        {tipo === 'eleccion' && (
          <>
            <Text style={styles.etiqueta}>MÁX. CANDIDATOS A ELEGIR POR ASOCIACIÓN</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 3"
              placeholderTextColor={C.txtTercero}
              value={maxSelecciones}
              onChangeText={setMaxSelecciones}
              keyboardType="number-pad"
            />

            <Text style={styles.etiqueta}>CANDIDATOS</Text>
            {candidatos.map((c, i) => (
              <View key={i} style={styles.candidatoRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder={`Candidato ${i + 1}`}
                  placeholderTextColor={C.txtTercero}
                  value={c}
                  onChangeText={val => actualizarCandidato(i, val)}
                />
                <TouchableOpacity
                  style={styles.btnQuitar}
                  onPress={() => quitarCandidato(i)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnQuitarTexto}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.btnAgregar}
              onPress={agregarCandidato}
              activeOpacity={0.8}
            >
              <Text style={styles.btnAgregarTexto}>+ Agregar Candidato</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.botonGuardar, guardando && { opacity: 0.6 }]}
          onPress={guardar}
          disabled={guardando}
          activeOpacity={0.8}
        >
          {guardando ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.botonGuardarTexto}>GUARDAR CAMBIOS</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal éxito */}
      <Modal visible={modalExito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>✅</Text>
            <Text style={styles.modalTitulo}>¡Guardado!</Text>
            <Text style={styles.modalMsg}>La pregunta fue actualizada correctamente.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setModalExito(false); router.replace('/admin/preguntas'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.fondo },
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 20, paddingTop: 20 },
  msgError: {
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#DC2626',
    borderRadius: 10, padding: 12, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  msgErrorTxt: { color: '#DC2626', fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  msgErrorCerrar: { color: '#DC2626', fontSize: 16, fontWeight: '900', paddingLeft: 8 },
  etiqueta: {
    fontSize: 12, fontWeight: '800', color: C.azul,
    letterSpacing: 1.5, marginBottom: 10, marginTop: 6,
  },
  input: {
    backgroundColor: C.blanco, borderWidth: 1.5, borderColor: C.borde,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: C.txtPrimario, marginBottom: 20,
  },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  tipoSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tipoOpcion: {
    flex: 1, backgroundColor: C.tarjeta, borderRadius: 12,
    padding: 16, borderWidth: 2, borderColor: C.borde, alignItems: 'center',
  },
  tipoActivo: { borderColor: C.azul, backgroundColor: '#EEF2FF' },
  tipoIcono: { fontSize: 28, marginBottom: 6 },
  tipoTitulo: { fontSize: 15, fontWeight: '700', color: C.txtSecundario, marginBottom: 4 },
  tipoDesc: { fontSize: 11, color: C.txtTercero, textAlign: 'center' },
  candidatoRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  btnQuitar: {
    backgroundColor: C.rojoBg, borderRadius: 8,
    width: 46, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.rojo,
  },
  btnQuitarTexto: { color: C.rojo, fontSize: 18, fontWeight: '700' },
  btnAgregar: {
    borderWidth: 1.5, borderColor: C.borde, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginBottom: 24, borderStyle: 'dashed',
  },
  btnAgregarTexto: { color: C.txtSecundario, fontWeight: '700', fontSize: 15 },
  botonGuardar: {
    backgroundColor: C.azul, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 8, minHeight: 60,
  },
  botonGuardarTexto: { color: C.blanco, fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalCard: {
    backgroundColor: C.blanco, borderRadius: 20, padding: 32,
    alignItems: 'center', width: '100%', gap: 14,
  },
  modalIcono: { fontSize: 48 },
  modalTitulo: { fontSize: 22, fontWeight: '900', color: C.azul },
  modalMsg: { fontSize: 15, color: C.txtSecundario, textAlign: 'center' },
  modalBtn: {
    backgroundColor: C.azul, borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 40, alignItems: 'center', marginTop: 4,
  },
  modalBtnTxt: { color: C.blanco, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
