import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';

export default function EditarAsociacionScreen() {
  const { id, nombre: nombreParam, id_usuario: idUsuarioParam, votos: votosParam } =
    useLocalSearchParams<{
      id: string;
      nombre: string;
      id_usuario: string;
      votos: string;
    }>();

  const [nombre, setNombre] = useState(decodeURIComponent(nombreParam ?? ''));
  const [votos, setVotos] = useState(votosParam ?? '1');
  const [contrasena, setContrasena] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      Alert.alert('Error', 'El nombre no puede estar vacío.');
      return;
    }
    const votosNum = parseInt(votos);
    if (isNaN(votosNum) || votosNum < 1) {
      Alert.alert('Error', 'La cantidad de votos debe ser un número mayor a 0.');
      return;
    }

    setGuardando(true);
    try {
      const cambios: Record<string, any> = {
        nombre_usuario: nombreTrim,
        votos_disponibles: votosNum,
      };

      if (contrasena.trim().length > 0) {
        if (contrasena.trim().length < 4) {
          Alert.alert('Error', 'La contraseña debe tener al menos 4 caracteres.');
          return;
        }
        cambios.contrasena = contrasena.trim();
      }

      const { error } = await supabase
        .from('usuarios')
        .update(cambios)
        .eq('id', id!);

      if (error) {
        Alert.alert('Error', `No se pudo actualizar.\n${error.message}`);
        return;
      }

      Alert.alert('Asociación actualizada correctamente ✅', '', [
        { text: 'OK', onPress: () => router.replace('/admin/asociaciones') },
      ]);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Info de referencia */}
      <View style={styles.idCard}>
        <Text style={styles.idLabel}>ID DE USUARIO</Text>
        <Text style={styles.idValor}>{idUsuarioParam}</Text>
        <Text style={styles.idSub}>El ID no puede modificarse</Text>
      </View>

      {/* Nombre */}
      <Text style={styles.etiqueta}>NOMBRE DE LA ASOCIACIÓN</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre de la asociación"
        placeholderTextColor={C.txtTercero}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="words"
      />

      {/* Votos */}
      <Text style={styles.etiqueta}>VOTOS DISPONIBLES</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 7"
        placeholderTextColor={C.txtTercero}
        value={votos}
        onChangeText={setVotos}
        keyboardType="number-pad"
      />

      {/* Contraseña */}
      <Text style={styles.etiqueta}>NUEVA CONTRASEÑA</Text>
      <TextInput
        style={styles.input}
        placeholder="Dejar vacío para no cambiar"
        placeholderTextColor={C.txtTercero}
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
      />
      <Text style={styles.ayuda}>
        Si dejas este campo vacío, la contraseña actual no se modifica.
      </Text>

      {/* Botones */}
      <TouchableOpacity
        style={[styles.btnGuardar, guardando && { opacity: 0.6 }]}
        onPress={guardar}
        disabled={guardando}
        activeOpacity={0.8}
      >
        {guardando
          ? <ActivityIndicator color={C.blanco} />
          : <Text style={styles.btnGuardarTxt}>GUARDAR CAMBIOS</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnCancelar}
        onPress={() => router.back()}
        disabled={guardando}
        activeOpacity={0.8}
      >
        <Text style={styles.btnCancelarTxt}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 20, paddingTop: 20 },

  idCard: {
    backgroundColor: C.tarjeta,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.borde,
    gap: 4,
  },
  idLabel: { fontSize: 10, fontWeight: '800', color: C.txtTercero, letterSpacing: 2 },
  idValor: { fontSize: 22, fontWeight: '900', color: C.azul },
  idSub: { fontSize: 12, color: C.txtTercero },

  etiqueta: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 1.5,
    borderColor: C.borde,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: C.txtPrimario,
    marginBottom: 20,
  },
  ayuda: { fontSize: 12, color: C.txtTercero, marginTop: -14, marginBottom: 24, lineHeight: 18 },

  btnGuardar: {
    backgroundColor: C.azul,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 60,
    marginBottom: 12,
  },
  btnGuardarTxt: { color: C.blanco, fontWeight: '900', fontSize: 18, letterSpacing: 1 },

  btnCancelar: {
    borderWidth: 1.5,
    borderColor: C.borde,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 60,
    backgroundColor: C.tarjeta,
  },
  btnCancelarTxt: { color: C.txtSecundario, fontWeight: '700', fontSize: 17 },
});
