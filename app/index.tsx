import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, Usuario } from '../lib/supabase';
import { guardarUsuario } from '../lib/auth';
import { C } from '../lib/theme';
import { registrar } from '../lib/auditoria';
import Logo from '../components/Logo';

export default function LoginScreen() {
  const [idUsuario, setIdUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    if (!idUsuario.trim() || !contrasena.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu ID y contraseña.');
      return;
    }

    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', idUsuario.trim())
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Usuario no encontrado.');
        return;
      }

      const usuario = data as Usuario;

      if (usuario.contrasena !== contrasena) {
        Alert.alert('Error', 'Contraseña incorrecta.');
        return;
      }

      await guardarUsuario(usuario);
      await registrar('LOGIN', usuario.nombre_usuario, `Inicio de sesión — ${usuario.rol}`);

      if (usuario.rol === 'administrador') {
        router.replace('/admin');
      } else if (usuario.rol === 'presidente') {
        router.replace('/home');
      } else {
        Alert.alert('Error', 'Rol no reconocido.');
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un problema. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <Logo size={140} style={styles.logoImg} />
          <Text style={styles.titulo}>SISTEMA DE VOTOS</Text>
          <Text style={styles.subtitulo}>Federación del Rodeo Chileno</Text>
        </View>

        <View style={styles.formulario}>
          <Text style={styles.etiqueta}>ID de Usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu ID"
            placeholderTextColor="#666"
            value={idUsuario}
            onChangeText={setIdUsuario}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.etiqueta}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu contraseña"
            placeholderTextColor="#666"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.boton, cargando && styles.botonDesactivado]}
            onPress={handleLogin}
            disabled={cargando}
            activeOpacity={0.8}
          >
            {cargando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.botonTexto}>INGRESAR</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.pie}>votosv1 © 2026</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.fondo,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImg: {
    marginBottom: 16,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '900',
    color: C.azul,
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 14,
    color: C.txtSecundario,
    marginTop: 8,
    letterSpacing: 1,
  },
  formulario: {
    width: '100%',
  },
  etiqueta: {
    fontSize: 14,
    fontWeight: '700',
    color: C.azul,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    color: C.azul,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  boton: {
    backgroundColor: C.rojo,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.rojo,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  botonDesactivado: {
    opacity: 0.6,
  },
  botonTexto: {
    color: C.blanco,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  pie: {
    textAlign: 'center',
    color: C.txtTercero,
    fontSize: 12,
    marginTop: 48,
    letterSpacing: 1,
  },
});
