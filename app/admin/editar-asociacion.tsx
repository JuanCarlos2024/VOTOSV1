import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import { registrar } from '../../lib/auditoria';

type UsuarioData = {
  nombre_usuario: string;
  id_usuario: string;
  votos_disponibles: number;
  rol: 'presidente' | 'administrador';
  activo: boolean;
};

export default function EditarAsociacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [original, setOriginal]     = useState<UsuarioData | null>(null);
  const [nombre, setNombre]         = useState('');
  const [idUsuario, setIdUsuario]   = useState('');
  const [contrasena, setContrasena] = useState('');
  const [votos, setVotos]           = useState('1');
  const [rol, setRol]               = useState<'presidente' | 'administrador'>('presidente');
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [msgError, setMsgError]     = useState('');
  const [modalExito, setModalExito] = useState(false);

  useEffect(() => {
    if (!id) return;
    cargarDatos();
  }, [id]);

  async function cargarDatos() {
    setCargando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('nombre_usuario, id_usuario, votos_disponibles, rol, activo')
      .eq('id', id!)
      .single();

    if (!data) {
      setMsgError('No se encontró el usuario.');
      setCargando(false);
      return;
    }

    setOriginal(data as UsuarioData);
    setNombre(data.nombre_usuario);
    setIdUsuario(data.id_usuario);
    setVotos(String(data.votos_disponibles));
    setRol(data.rol as 'presidente' | 'administrador');
    setCargando(false);
  }

  async function guardar() {
    setMsgError('');
    const nombreTrim     = nombre.trim();
    const idTrim         = idUsuario.trim();
    const contrasenaTrim = contrasena.trim();
    const votosNum       = parseInt(votos);

    if (!nombreTrim) { setMsgError('El nombre no puede estar vacío.'); return; }
    if (!idTrim)     { setMsgError('El ID de usuario es obligatorio.'); return; }
    if (isNaN(votosNum) || votosNum < 1) {
      setMsgError('Los votos de peso deben ser un número mayor a 0.');
      return;
    }
    if (contrasenaTrim.length > 0 && contrasenaTrim.length < 4) {
      setMsgError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      // Si cambió el id_usuario, verificar que no exista en otro usuario
      if (idTrim !== original?.id_usuario) {
        const { data: existente } = await supabase
          .from('usuarios').select('id').eq('id_usuario', idTrim).maybeSingle();
        if (existente) {
          setMsgError('Ese ID ya está en uso por otro usuario.');
          return;
        }
      }

      const cambios: Record<string, any> = {
        nombre_usuario:    nombreTrim,
        id_usuario:        idTrim,
        votos_disponibles: votosNum,
        rol,
      };
      if (contrasenaTrim.length >= 4) {
        cambios.contrasena = contrasenaTrim;
      }

      const { error } = await supabase.from('usuarios').update(cambios).eq('id', id!);
      if (error) {
        setMsgError(`No se pudo actualizar: ${error.message}`);
        return;
      }

      // Construir detalle de cambios para auditoría
      const diffs: string[] = [];
      if (original) {
        if (nombreTrim !== original.nombre_usuario)
          diffs.push(`nombre: "${original.nombre_usuario}" → "${nombreTrim}"`);
        if (idTrim !== original.id_usuario)
          diffs.push(`ID: "${original.id_usuario}" → "${idTrim}"`);
        if (votosNum !== original.votos_disponibles)
          diffs.push(`votos: ${original.votos_disponibles} → ${votosNum}`);
        if (rol !== original.rol)
          diffs.push(`rol: ${original.rol} → ${rol}`);
        if (contrasenaTrim.length >= 4)
          diffs.push('contraseña actualizada');
      }

      await registrar(
        'EDITAR_USUARIO',
        'admin',
        `Admin editó usuario ${nombreTrim}. Cambios: ${diffs.length > 0 ? diffs.join(', ') : 'sin cambios detectados'}`,
        { asociacion_nombre: nombreTrim }
      );

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

        {/* ID usuario */}
        <Text style={styles.etiqueta}>ID DE USUARIO</Text>
        <TextInput
          style={styles.input}
          placeholder="ID único"
          placeholderTextColor={C.txtTercero}
          value={idUsuario}
          onChangeText={setIdUsuario}
          keyboardType="number-pad"
          autoCorrect={false}
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

        {/* Contraseña */}
        <Text style={styles.etiqueta}>NUEVA CONTRASEÑA</Text>
        <TextInput
          style={styles.input}
          placeholder="Dejar vacío para no cambiar"
          placeholderTextColor={C.txtTercero}
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={styles.ayuda}>
          Si dejas este campo vacío, la contraseña actual no se modifica.
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

      {/* Modal éxito */}
      <Modal visible={modalExito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>✅</Text>
            <Text style={styles.modalTitulo}>¡Guardado!</Text>
            <Text style={styles.modalMsg}>El usuario fue actualizado correctamente.</Text>
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
  rolIcono: { fontSize: 26, marginBottom: 4 },
  rolTxt: { fontSize: 13, fontWeight: '700', color: C.txtSecundario },

  btnGuardar: {
    backgroundColor: C.azul, borderRadius: 12,
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
