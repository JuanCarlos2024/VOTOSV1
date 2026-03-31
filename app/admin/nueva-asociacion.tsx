import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import { registrar } from '../../lib/auditoria';

export default function NuevaAsociacionScreen() {
  const [nombre, setNombre]       = useState('');
  const [idUsuario, setIdUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [votos, setVotos]         = useState('1');
  const [rol, setRol]             = useState<'presidente' | 'administrador'>('presidente');
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError]   = useState('');
  const [modalExito, setModalExito] = useState(false);

  async function guardar() {
    setMsgError('');
    const nombreTrim    = nombre.trim();
    const idTrim        = idUsuario.trim();
    const contrasenaTrim = contrasena.trim();
    const votosNum      = parseInt(votos);

    if (!nombreTrim) { setMsgError('El nombre de la asociación es obligatorio.'); return; }
    if (!idTrim)     { setMsgError('El ID de usuario es obligatorio.'); return; }
    if (!contrasenaTrim || contrasenaTrim.length < 4) {
      setMsgError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (isNaN(votosNum) || votosNum < 1) {
      setMsgError('Los votos de peso deben ser un número mayor a 0.');
      return;
    }

    setGuardando(true);
    try {
      // Verificar que el ID no exista
      const { data: existente } = await supabase
        .from('usuarios').select('id').eq('id_usuario', idTrim).maybeSingle();

      if (existente) {
        setMsgError('Este ID ya está en uso. Elige otro.');
        return;
      }

      const { error } = await supabase.from('usuarios').insert({
        nombre_usuario:    nombreTrim,
        id_usuario:        idTrim,
        contrasena:        contrasenaTrim,
        votos_disponibles: votosNum,
        rol,
        activo:            true,
      });

      if (error) {
        setMsgError(`No se pudo crear el usuario: ${error.message}`);
        return;
      }

      await registrar(
        'CREAR_USUARIO',
        'admin',
        `Admin creó usuario ${nombreTrim} con ID ${idTrim}`,
        { asociacion_nombre: nombreTrim }
      );

      setModalExito(true);
    } finally {
      setGuardando(false);
    }
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
          style={styles.input}
          placeholder="Número único, ej: 1023"
          placeholderTextColor={C.txtTercero}
          value={idUsuario}
          onChangeText={setIdUsuario}
          keyboardType="number-pad"
          autoCorrect={false}
        />

        {/* Contraseña */}
        <Text style={styles.etiqueta}>CONTRASEÑA</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 4 caracteres"
          placeholderTextColor={C.txtTercero}
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry
          autoCapitalize="none"
        />

        {/* Votos */}
        <Text style={styles.etiqueta}>VOTOS DE PESO</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 7"
          placeholderTextColor={C.txtTercero}
          value={votos}
          onChangeText={setVotos}
          keyboardType="number-pad"
        />
        <Text style={styles.ayuda}>
          Representa el peso ponderado del voto de esta asociación.
        </Text>

        {/* Rol */}
        <Text style={styles.etiqueta}>ROL</Text>
        <View style={styles.rolSelector}>
          <TouchableOpacity
            style={[styles.rolOpcion, rol === 'presidente' && styles.rolActivo]}
            onPress={() => setRol('presidente')}
            activeOpacity={0.8}
          >
            <Text style={styles.rolIcono}>👤</Text>
            <Text style={[styles.rolTxt, rol === 'presidente' && { color: C.azul, fontWeight: '900' }]}>
              Presidente
            </Text>
            <Text style={styles.rolDesc}>Puede votar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rolOpcion, rol === 'administrador' && styles.rolActivo]}
            onPress={() => setRol('administrador')}
            activeOpacity={0.8}
          >
            <Text style={styles.rolIcono}>🔐</Text>
            <Text style={[styles.rolTxt, rol === 'administrador' && { color: C.azul, fontWeight: '900' }]}>
              Administrador
            </Text>
            <Text style={styles.rolDesc}>Gestiona el sistema</Text>
          </TouchableOpacity>
        </View>

        {/* Botones */}
        <TouchableOpacity
          style={[styles.btnGuardar, guardando && { opacity: 0.6 }]}
          onPress={guardar}
          disabled={guardando}
          activeOpacity={0.8}
        >
          {guardando
            ? <ActivityIndicator color={C.blanco} />
            : <Text style={styles.btnGuardarTxt}>CREAR USUARIO</Text>
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

      {/* Modal éxito */}
      <Modal visible={modalExito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>✅</Text>
            <Text style={styles.modalTitulo}>¡Usuario creado!</Text>
            <Text style={styles.modalMsg}>El usuario fue registrado correctamente.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setModalExito(false); router.replace('/admin/asociaciones'); }}
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
    letterSpacing: 1.5, marginBottom: 10, marginTop: 4,
  },
  input: {
    backgroundColor: C.blanco, borderWidth: 1.5, borderColor: C.borde,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, color: C.txtPrimario, marginBottom: 20,
  },
  ayuda: { fontSize: 12, color: C.txtTercero, marginTop: -14, marginBottom: 24, lineHeight: 18 },

  rolSelector: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  rolOpcion: {
    flex: 1, backgroundColor: C.tarjeta, borderRadius: 12,
    padding: 16, borderWidth: 2, borderColor: C.borde, alignItems: 'center', gap: 4,
  },
  rolActivo: { borderColor: C.azul, backgroundColor: '#EEF2FF' },
  rolIcono: { fontSize: 28, marginBottom: 4 },
  rolTxt: { fontSize: 14, fontWeight: '700', color: C.txtSecundario },
  rolDesc: { fontSize: 11, color: C.txtTercero, textAlign: 'center' },

  btnGuardar: {
    backgroundColor: C.rojo, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center',
    minHeight: 60, marginBottom: 12,
  },
  btnGuardarTxt: { color: C.blanco, fontWeight: '900', fontSize: 18, letterSpacing: 1 },

  btnCancelar: {
    borderWidth: 1.5, borderColor: C.borde, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    minHeight: 60, backgroundColor: C.tarjeta,
  },
  btnCancelarTxt: { color: C.txtSecundario, fontWeight: '700', fontSize: 17 },

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
