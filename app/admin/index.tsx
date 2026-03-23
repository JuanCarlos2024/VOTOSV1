import { Platform, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router, Redirect } from 'expo-router';
import { cerrarSesion } from '../../lib/auth';
import { C } from '../../lib/theme';

export default function AdminDashboard() {
  // En web redirigir directo a preguntas (la sidebar gestiona la navegación)
  if (Platform.OS === 'web') return <Redirect href="/admin/preguntas" />;

  async function handleLogout() {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await cerrarSesion();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>ADMINISTRADOR</Text>
        </View>
        <Text style={styles.titulo}>Panel de Control</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.tarjeta}
          onPress={() => router.push('/admin/preguntas')}
          activeOpacity={0.8}
        >
          <Text style={styles.icono}>📋</Text>
          <Text style={styles.tarjetaTitulo}>Preguntas</Text>
          <Text style={styles.tarjetaDesc}>Gestionar, activar y cerrar votaciones</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tarjeta}
          onPress={() => router.push('/admin/crear')}
          activeOpacity={0.8}
        >
          <Text style={styles.icono}>➕</Text>
          <Text style={styles.tarjetaTitulo}>Crear Pregunta</Text>
          <Text style={styles.tarjetaDesc}>Nueva votación de reglamento o elección</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tarjeta}
          onPress={() => router.push('/admin/historial')}
          activeOpacity={0.8}
        >
          <Text style={styles.icono}>📁</Text>
          <Text style={styles.tarjetaTitulo}>Historial</Text>
          <Text style={styles.tarjetaDesc}>Votaciones cerradas y exportar resultados</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tarjeta}
          onPress={() => router.push('/admin/asociaciones')}
          activeOpacity={0.8}
        >
          <Text style={styles.icono}>👥</Text>
          <Text style={styles.tarjetaTitulo}>Asociaciones</Text>
          <Text style={styles.tarjetaDesc}>Gestionar usuarios, votos y contraseñas</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.botonSalir} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.botonSalirTexto}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.fondo },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: C.azul,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeTexto: {
    color: C.blanco,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 2,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '900',
    color: C.azul,
  },
  grid: {
    gap: 16,
    marginBottom: 24,
  },
  tarjeta: {
    backgroundColor: C.tarjeta,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: C.borde,
  },
  icono: {
    fontSize: 36,
    marginBottom: 12,
  },
  tarjetaTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: C.azul,
    marginBottom: 6,
  },
  tarjetaDesc: {
    fontSize: 14,
    color: C.txtSecundario,
    lineHeight: 20,
  },
  botonSalir: {
    borderWidth: 1.5,
    borderColor: C.rojo,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonSalirTexto: {
    color: C.rojo,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
