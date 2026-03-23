import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';

export default function NuevaAsociacionScreen() {
  const [nombre, setNombre] = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [votos, setVotos] = useState('1');
  const [guardando, setGuardando] = useState(false);
  const [errorId, setErrorId] = useState('');

  async function guardar() {
    const nombreTrim   = nombre.trim();
    const idTrim       = idUsuario.trim();
    const contrasenaTrim = contrasena.trim();
    const votosNum     = parseInt(votos);

    // Validaciones
    if (!nombreTrim) {
      Alert.alert('Error', 'El nombre de la asociación es obligatorio.');
      return;
    }
    if (!idTrim) {
      Alert.alert('Error', 'El ID de usuario es obligatorio.');
      return;
    }
    if (!contrasenaTrim || contrasenaTrim.length < 4) {
      Alert.alert('Error', 'La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (isNaN(votosNum) || votosNum < 1) {
      Alert.alert('Error', 'La cantidad de votos debe ser un número mayor a 0.');
      return;
    }

    setGuardando(true);
    setErrorId('');
    try {
      // Verificar que el ID no exista
      const { data: existente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id_usuario', idTrim)
        .maybeSingle();

      if (existente) {
        setErrorId('Este ID ya está en uso, elige otro.');
        return;
      }

      const { error } = await supabase.from('usuarios').insert({
        nombre_usuario:   nombreTrim,
        id_usuario:       idTrim,
        contrasena:       contrasenaTrim,
        votos_disponibles: votosNum,
        rol:              'presidente',
      });

      if (error) {
        Alert.alert('Error', `No se pudo crear la asociación.\n${error.message}`);
        return;
      }

      Alert.alert('Asociación creada correctamente ✅', '', [
        { text: 'OK', onPress: () => router.replace('/admin/asociaciones') },
      ]);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Nombre */}
      <Text style={styles.etiqueta}>NOMBRE DE LA ASOCIACIÓN</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Asociación Los Ángeles"
        placeholderTextColor={C.txtTercero}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="words"
      />

      {/* ID usuario */}
      <Text style={styles.etiqueta}>ID DE USUARIO</Text>
      <TextInput
        style={[styles.input, errorId ? styles.inputError : null]}
        placeholder="Número único, ej: 1023"
        placeholderTextColor={C.txtTercero}
        value={idUsuario}
        onChangeText={v => { setIdUsuario(v); setErrorId(''); }}
        keyboardType="number-pad"
      />
      {errorId ? <Text style={styles.errorTxt}>{errorId}</Text> : null}

      {/* Contraseña */}
      <Text style={styles.etiqueta}>CONTRASEÑA</Text>
      <TextInput
        style={styles.input}
        placeholder="Mínimo 4 caracteres"
        placeholderTextColor={C.txtTercero}
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
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
      <Text style={styles.ayuda}>
        Representa el peso de voto ponderado de esta asociación.
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
          : <Text style={styles.btnGuardarTxt}>CREAR ASOCIACIÓN</Text>
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
  inputError: { borderColor: C.rojo },
  errorTxt: {
    color: C.rojo,
    fontSize: 13,
    fontWeight: '700',
    marginTop: -14,
    marginBottom: 16,
  },
  ayuda: { fontSize: 12, color: C.txtTercero, marginTop: -14, marginBottom: 24, lineHeight: 18 },

  btnGuardar: {
    backgroundColor: C.rojo,
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
