import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';

export default function CrearPreguntaScreen() {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'reglamento' | 'eleccion'>('reglamento');
  const [maxSelecciones, setMaxSelecciones] = useState('1');
  const [candidatos, setCandidatos] = useState<string[]>(['', '']);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  function agregarCandidato() {
    setCandidatos(prev => [...prev, '']);
  }

  function quitarCandidato(index: number) {
    if (candidatos.length <= 2) {
      setError('Se necesitan mínimo 2 candidatos.');
      return;
    }
    setError('');
    setCandidatos(prev => prev.filter((_, i) => i !== index));
  }

  function actualizarCandidato(index: number, valor: string) {
    setCandidatos(prev => prev.map((c, i) => (i === index ? valor : c)));
  }

  async function guardar() {
    setError('');
    setExito('');

    if (!texto.trim()) {
      setError('Escribe el texto de la pregunta.');
      return;
    }

    if (tipo === 'eleccion') {
      const validos = candidatos.filter(c => c.trim().length > 0);
      if (validos.length < 2) {
        setError('Agrega al menos 2 candidatos con nombre.');
        return;
      }
      const max = parseInt(maxSelecciones) || 1;
      if (max < 1 || max > validos.length) {
        setError(`El máximo de selecciones debe ser entre 1 y ${validos.length}.`);
        return;
      }
    }

    setGuardando(true);
    try {
      const max = tipo === 'eleccion' ? parseInt(maxSelecciones) || 1 : 1;

      const { data: pregunta, error: errInsert } = await supabase
        .from('preguntas')
        .insert({
          texto: texto.trim(),
          tipo,
          estado: 'pendiente',
          max_selecciones: max,
        })
        .select()
        .single();

      if (errInsert || !pregunta) {
        setError(`No se pudo crear la pregunta: ${errInsert?.message ?? 'Error desconocido'}`);
        return;
      }

      if (tipo === 'eleccion') {
        const filas = candidatos
          .filter(c => c.trim().length > 0)
          .map(nombre => ({
            pregunta_id: pregunta.id,
            nombre: nombre.trim(),
            imagen_url: null,
          }));

        const { error: errCands } = await supabase.from('candidatos').insert(filas);
        if (errCands) {
          setError('La pregunta fue creada pero hubo un error al guardar los candidatos. Edítala para agregarlos.');
          return;
        }
      }

      setExito('✅ Pregunta guardada como pendiente');
      setTimeout(() => router.replace('/admin/preguntas'), 1200);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
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

      {/* Mensajes de error / éxito */}
      {error !== '' && (
        <View style={styles.msgError}>
          <Text style={styles.msgErrorTxt}>⚠️ {error}</Text>
        </View>
      )}
      {exito !== '' && (
        <View style={styles.msgExito}>
          <Text style={styles.msgExitoTxt}>{exito}</Text>
        </View>
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
          <Text style={styles.botonGuardarTexto}>GUARDAR PREGUNTA</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 20, paddingTop: 20 },
  etiqueta: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 6,
  },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 1.5,
    borderColor: C.borde,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.txtPrimario,
    marginBottom: 20,
  },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  tipoSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tipoOpcion: {
    flex: 1,
    backgroundColor: C.tarjeta,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: C.borde,
    alignItems: 'center',
  },
  tipoActivo: { borderColor: C.azul, backgroundColor: '#EEF2FF' },
  tipoIcono: { fontSize: 28, marginBottom: 6 },
  tipoTitulo: { fontSize: 15, fontWeight: '700', color: C.txtSecundario, marginBottom: 4 },
  tipoDesc: { fontSize: 11, color: C.txtTercero, textAlign: 'center' },
  candidatoRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  btnQuitar: {
    backgroundColor: C.rojoBg,
    borderRadius: 8,
    width: 46,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.rojo,
  },
  btnQuitarTexto: { color: C.rojo, fontSize: 18, fontWeight: '700' },
  btnAgregar: {
    borderWidth: 1.5,
    borderColor: C.borde,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 24,
    borderStyle: 'dashed',
  },
  btnAgregarTexto: { color: C.txtSecundario, fontWeight: '700', fontSize: 15 },
  botonGuardar: {
    backgroundColor: C.rojo,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 60,
  },
  botonGuardarTexto: { color: C.blanco, fontWeight: '900', fontSize: 16, letterSpacing: 2 },

  msgError: {
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#DC2626',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  msgErrorTxt: { color: '#DC2626', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  msgExito: {
    backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#16A34A',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  msgExitoTxt: { color: '#16A34A', fontSize: 15, fontWeight: '700' },
});
