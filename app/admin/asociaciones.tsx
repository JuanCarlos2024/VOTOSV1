import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import { registrar } from '../../lib/auditoria';

type Usuario = {
  id: string;
  nombre_usuario: string;
  id_usuario: string;
  votos_disponibles: number;
  rol: string;
  activo: boolean;
};

type ModalConfirm = {
  usuario: Usuario;
  accion: 'desactivar' | 'activar';
};

export default function AsociacionesScreen() {
  const [lista, setLista]           = useState<Usuario[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [modalConfirm, setModalConfirm] = useState<ModalConfirm | null>(null);
  const [ejecutando, setEjecutando] = useState(false);

  useFocusEffect(
    useCallback(() => { cargar(); }, [])
  );

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre_usuario');
    setLista((data ?? []) as Usuario[]);
    setCargando(false);
  }

  async function toggleActivo() {
    if (!modalConfirm) return;
    const { usuario, accion } = modalConfirm;
    setModalConfirm(null);
    setEjecutando(true);
    try {
      const nuevoActivo = accion === 'activar';
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: nuevoActivo })
        .eq('id', usuario.id);

      if (error) return;

      await registrar(
        nuevoActivo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
        'admin',
        `Admin ${nuevoActivo ? 'reactivó' : 'desactivó'} usuario ${usuario.nombre_usuario}`,
        { asociacion_nombre: usuario.nombre_usuario }
      );

      cargar();
    } finally {
      setEjecutando(false);
    }
  }

  const listaFiltrada = lista.filter(u => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      u.nombre_usuario.toLowerCase().includes(q) ||
      u.id_usuario.toLowerCase().includes(q)
    );
  });

  function renderItem({ item, index }: { item: Usuario; index: number }) {
    const inactivo = item.activo === false;
    return (
      <View style={[styles.fila, inactivo && styles.filaInactiva]}>
        {/* Encabezado fila */}
        <View style={styles.filaTop}>
          <View style={[styles.numCirculo, { backgroundColor: inactivo ? '#9CA3AF' : C.azul }]}>
            <Text style={styles.numTxt}>{index + 1}</Text>
          </View>
          <View style={styles.filaInfo}>
            <View style={styles.filaNameRow}>
              <Text style={[styles.nombre, inactivo && { color: C.txtTercero }]} numberOfLines={1}>
                {item.nombre_usuario}
              </Text>
              {inactivo && (
                <View style={styles.badgeInactivo}>
                  <Text style={styles.badgeInactivoTxt}>INACTIVO</Text>
                </View>
              )}
            </View>
            <Text style={styles.detalle}>
              ID: {item.id_usuario} · {item.votos_disponibles} voto{item.votos_disponibles !== 1 ? 's' : ''}
            </Text>
            <View style={[styles.rolBadge, { backgroundColor: item.rol === 'administrador' ? '#FEF3C7' : '#EEF2FF' }]}>
              <Text style={[styles.rolTxt, { color: item.rol === 'administrador' ? '#92400E' : '#3730A3' }]}>
                {item.rol === 'administrador' ? '🔐 ADMIN' : '👤 PRESIDENTE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Botones */}
        <View style={styles.filaBtns}>
          <TouchableOpacity
            style={styles.btnEditar}
            onPress={() => router.push(`/admin/editar-asociacion?id=${item.id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnEditarTxt}>✏️ Editar</Text>
          </TouchableOpacity>

          {inactivo ? (
            <TouchableOpacity
              style={styles.btnActivar}
              onPress={() => setModalConfirm({ usuario: item, accion: 'activar' })}
              disabled={ejecutando}
              activeOpacity={0.8}
            >
              <Text style={styles.btnActivarTxt}>✅ Activar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.btnDesactivar}
              onPress={() => setModalConfirm({ usuario: item, accion: 'desactivar' })}
              disabled={ejecutando}
              activeOpacity={0.8}
            >
              <Text style={styles.btnDesactivarTxt}>⛔ Desactivar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (cargando && lista.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.azul} size="large" />
      </View>
    );
  }

  const totalActivos   = lista.filter(u => u.activo !== false).length;
  const totalInactivos = lista.filter(u => u.activo === false).length;

  return (
    <View style={styles.container}>
      {/* Botón crear */}
      <TouchableOpacity
        style={styles.btnNueva}
        onPress={() => router.push('/admin/nueva-asociacion')}
        activeOpacity={0.8}
      >
        <Text style={styles.btnNuevaTxt}>+ Nuevo Usuario</Text>
      </TouchableOpacity>

      {/* Buscador */}
      <TextInput
        style={styles.buscador}
        placeholder="Buscar por nombre o ID..."
        placeholderTextColor="#9CA3AF"
        value={busqueda}
        onChangeText={setBusqueda}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {/* Contadores */}
      <View style={styles.contadoresRow}>
        <Text style={styles.conteo}>
          {listaFiltrada.length} usuario{listaFiltrada.length !== 1 ? 's' : ''}
          {busqueda.trim() ? ' (filtrado)' : ''}
        </Text>
        {totalInactivos > 0 && (
          <Text style={styles.conteoInactivo}>
            {totalInactivos} inactivo{totalInactivos !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <FlatList
        data={listaFiltrada}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={C.rojo} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text style={styles.vacioIcono}>👥</Text>
            <Text style={styles.vacioTxt}>
              {busqueda.trim() ? 'Sin resultados para esa búsqueda' : 'No hay usuarios registrados'}
            </Text>
          </View>
        }
      />

      {/* Modal confirmación desactivar/activar */}
      <Modal visible={modalConfirm !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcono}>
              {modalConfirm?.accion === 'desactivar' ? '⛔' : '✅'}
            </Text>
            <Text style={styles.modalTitulo}>
              {modalConfirm?.accion === 'desactivar' ? 'Desactivar usuario' : 'Activar usuario'}
            </Text>
            <Text style={styles.modalMsg}>
              {modalConfirm?.accion === 'desactivar'
                ? `¿Desactivar a "${modalConfirm?.usuario.nombre_usuario}"?\n\nNo podrá iniciar sesión hasta que sea reactivado. Sus votos históricos se conservarán.`
                : `¿Reactivar a "${modalConfirm?.usuario.nombre_usuario}"?\n\nPodrá volver a iniciar sesión normalmente.`
              }
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancelar}
                onPress={() => setModalConfirm(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnConfirmar,
                  { backgroundColor: modalConfirm?.accion === 'desactivar' ? '#DC2626' : '#16A34A' },
                ]}
                onPress={toggleActivo}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnConfirmarTxt}>
                  {modalConfirm?.accion === 'desactivar' ? 'Sí, desactivar' : 'Sí, activar'}
                </Text>
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

  btnNueva: {
    backgroundColor: C.azul, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 12, minHeight: 56,
  },
  btnNuevaTxt: { color: C.blanco, fontWeight: '800', fontSize: 16, letterSpacing: 1 },

  buscador: {
    backgroundColor: C.blanco, borderWidth: 1.5, borderColor: C.borde,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.txtPrimario, marginBottom: 10,
  },

  contadoresRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  conteo: { fontSize: 12, fontWeight: '700', color: C.txtTercero, letterSpacing: 0.5 },
  conteoInactivo: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  fila: {
    backgroundColor: C.tarjeta, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: C.borde, gap: 10,
  },
  filaInactiva: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.8 },
  filaTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  numCirculo: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  numTxt: { color: C.blanco, fontSize: 14, fontWeight: '800' },
  filaInfo: { flex: 1, gap: 4 },
  filaNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nombre: { fontSize: 16, fontWeight: '700', color: C.txtPrimario, flex: 1 },
  badgeInactivo: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FECACA',
  },
  badgeInactivoTxt: { fontSize: 10, fontWeight: '900', color: '#DC2626', letterSpacing: 1 },
  detalle: { fontSize: 12, color: C.txtSecundario },
  rolBadge: {
    alignSelf: 'flex-start', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rolTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  filaBtns: { flexDirection: 'row', gap: 8 },
  btnEditar: {
    flex: 1, backgroundColor: C.azul, borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  btnEditarTxt: { color: C.blanco, fontWeight: '800', fontSize: 13 },
  btnDesactivar: {
    flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  btnDesactivarTxt: { color: '#DC2626', fontWeight: '800', fontSize: 13 },
  btnActivar: {
    flex: 1, backgroundColor: '#F0FDF4', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  btnActivarTxt: { color: '#16A34A', fontWeight: '800', fontSize: 13 },

  vacio: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vacioIcono: { fontSize: 48 },
  vacioTxt: { fontSize: 16, color: C.txtSecundario, fontWeight: '700', textAlign: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: C.blanco, borderRadius: 18, padding: 28,
    width: '100%', gap: 14, alignItems: 'center',
  },
  modalIcono: { fontSize: 44 },
  modalTitulo: { fontSize: 20, fontWeight: '900', color: C.txtPrimario, textAlign: 'center' },
  modalMsg: { fontSize: 14, color: C.txtSecundario, textAlign: 'center', lineHeight: 21 },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnCancelar: {
    flex: 1, borderWidth: 1.5, borderColor: C.borde,
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    backgroundColor: C.tarjeta,
  },
  modalBtnCancelarTxt: { color: C.txtSecundario, fontSize: 14, fontWeight: '700' },
  modalBtnConfirmar: {
    flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  modalBtnConfirmarTxt: { color: C.blanco, fontSize: 14, fontWeight: '900' },
});
