import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { registrar } from '../../lib/auditoria';
import { obtenerUsuario } from '../../lib/auth';
import { C } from '../../lib/theme';

export default function ConfigScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [textoConfirmar, setTextoConfirmar] = useState('');
  const [ejecutando, setEjecutando] = useState(false);
  const [msgExito, setMsgExito] = useState('');

  function abrirModal() {
    setMsgExito('');
    setTextoConfirmar('');
    setPaso(1);
    setModalVisible(true);
  }

  function cerrarModal() {
    if (ejecutando) return;
    setModalVisible(false);
    setTextoConfirmar('');
    setPaso(1);
  }

  async function ejecutarReset() {
    if (textoConfirmar !== 'CONFIRMAR') return;
    setEjecutando(true);
    try {
      // Count votos first
      const { count } = await supabase
        .from('votos')
        .select('id', { count: 'exact', head: true });

      // Delete all votos
      await supabase
        .from('votos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset all non-borrador preguntas back to borrador
      await supabase
        .from('preguntas')
        .update({ estado: 'borrador' })
        .in('estado', ['activa', 'cerrada']);

      // Audit log
      const u = await obtenerUsuario();
      await registrar(
        'RESET',
        u?.nombre_usuario ?? 'admin',
        `Eliminados ${count ?? 0} votos`
      );

      setMsgExito(
        `✅ Sistema reseteado. ${count ?? 0} votos eliminados. Listo para la asamblea.`
      );
      setModalVisible(false);
    } catch (err) {
      console.error('Error en reset:', err);
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
      {/* Encabezado */}
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>⚠️ CONFIGURACIÓN DEL SISTEMA</Text>
      </View>

      {/* Tarjeta Resetear Sistema */}
      <View style={styles.tarjeta}>
        <Text style={styles.tarjetaTitulo}>Resetear Sistema</Text>
        <Text style={styles.tarjetaDesc}>
          Elimina TODOS los votos registrados y devuelve todas las preguntas a
          estado borrador. Usa esto solo para pruebas antes de la asamblea real.
        </Text>

        <TouchableOpacity
          style={styles.botonReset}
          onPress={abrirModal}
          activeOpacity={0.8}
        >
          <Text style={styles.botonResetTexto}>🗑 Resetear todos los votos</Text>
        </TouchableOpacity>

        {msgExito !== '' && (
          <Text style={styles.msgExito}>{msgExito}</Text>
        )}
      </View>

      {/* Modal de confirmación */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModal}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {paso === 1 ? (
              <>
                <Text style={styles.modalTitulo}>⚠️ Resetear Sistema</Text>
                <Text style={styles.modalMsg}>
                  {'¿Estás seguro que deseas eliminar TODOS los votos y devolver las preguntas a borrador?\n\nEsta acción NO se puede deshacer.'}
                </Text>
                <TouchableOpacity
                  style={styles.botonAzul}
                  onPress={() => setPaso(2)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.botonTextoBlanco}>Sí, continuar →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botonCancelar}
                  onPress={cerrarModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.botonTextoCancelar}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitulo}>Confirmación final</Text>
                <Text style={styles.modalMsg}>
                  Escribe CONFIRMAR para continuar:
                </Text>
                <TextInput
                  style={styles.input}
                  value={textoConfirmar}
                  onChangeText={setTextoConfirmar}
                  placeholder="CONFIRMAR"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!ejecutando}
                />
                {ejecutando ? (
                  <ActivityIndicator
                    size="large"
                    color={C.rojo}
                    style={{ marginVertical: 12 }}
                  />
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.botonRojo,
                      textoConfirmar !== 'CONFIRMAR' && styles.botonDesactivado,
                    ]}
                    onPress={ejecutarReset}
                    disabled={textoConfirmar !== 'CONFIRMAR'}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.botonTextoBlanco}>EJECUTAR RESET</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.botonCancelar}
                  onPress={cerrarModal}
                  disabled={ejecutando}
                  activeOpacity={0.8}
                >
                  <Text style={styles.botonTextoCancelar}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  encabezado: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.rojo,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: C.rojo,
    letterSpacing: 0.5,
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.rojo,
    padding: 20,
    marginBottom: 20,
  },
  tarjetaTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: C.rojo,
    marginBottom: 10,
  },
  tarjetaDesc: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 20,
  },
  botonReset: {
    backgroundColor: C.rojo,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonResetTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  msgExito: {
    marginTop: 14,
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMsg: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    letterSpacing: 1,
  },
  botonAzul: {
    backgroundColor: C.azul,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  botonRojo: {
    backgroundColor: C.rojo,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  botonDesactivado: {
    opacity: 0.4,
  },
  botonTextoBlanco: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  botonCancelar: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  botonTextoCancelar: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
});
