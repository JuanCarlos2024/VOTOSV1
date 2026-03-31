import { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack, Slot, usePathname, router } from 'expo-router';
import { cerrarSesion } from '../../lib/auth';
import Logo from '../../components/Logo';

// ── Móvil: Stack estándar ────────────────────────────────────
function MobileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#003087' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Panel Administrador', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="preguntas" options={{ title: 'Gestionar Preguntas' }} />
      <Stack.Screen name="crear" options={{ title: 'Crear Pregunta' }} />
      <Stack.Screen name="seguimiento" options={{ title: 'Seguimiento' }} />
      <Stack.Screen name="resultados" options={{ title: 'Resultados' }} />
      <Stack.Screen name="editar" options={{ title: 'Editar Pregunta' }} />
      <Stack.Screen name="historial" options={{ title: 'Historial de Votaciones' }} />
      <Stack.Screen name="asociaciones" options={{ title: 'Asociaciones' }} />
      <Stack.Screen name="nueva-asociacion" options={{ title: 'Nueva Asociación' }} />
      <Stack.Screen name="editar-asociacion" options={{ title: 'Editar Asociación' }} />
      <Stack.Screen name="auditoria" options={{ title: 'Auditoría del Sistema' }} />
      <Stack.Screen name="config" options={{ title: 'Configuración del Sistema' }} />
    </Stack>
  );
}

// ── Web: Sidebar + contenido ─────────────────────────────────
const NAV = [
  { label: 'Preguntas', path: '/admin/preguntas', icon: '📋', desc: 'Gestionar votaciones' },
  { label: 'Nueva Pregunta', path: '/admin/crear', icon: '➕', desc: 'Crear votación' },
  { label: 'Historial', path: '/admin/historial', icon: '📁', desc: 'Votaciones cerradas' },
  { label: 'Asociaciones', path: '/admin/asociaciones', icon: '👥', desc: 'Usuarios y pesos' },
  { label: 'Auditoría', path: '/admin/auditoria', icon: '🔍', desc: 'Registro de actividad' },
  { label: 'Configuración', path: '/admin/config', icon: '⚙️', desc: 'Reset y sistema' },
];

function WebLayout() {
  const pathname  = usePathname();
  const { width } = useWindowDimensions();
  const esMovil   = width < 768;
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  async function salir() {
    await cerrarSesion();
    router.replace('/');
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + '?');
  }

  function navegar(path: string) {
    router.push(path as any);
    if (esMovil) setSidebarAbierto(false);
  }

  const sidebarVisible = !esMovil || sidebarAbierto;

  return (
    <View style={web.shell}>
      {/* ── Overlay para cerrar sidebar en móvil ── */}
      {esMovil && sidebarAbierto && (
        <TouchableOpacity
          style={web.overlay}
          onPress={() => setSidebarAbierto(false)}
          activeOpacity={1}
        />
      )}

      {/* ── Sidebar ── */}
      {sidebarVisible && (
        <View style={[web.sidebar, esMovil && web.sidebarFloating]}>
          {/* Botón cerrar en móvil */}
          {esMovil && (
            <TouchableOpacity
              style={web.btnCerrarSidebar}
              onPress={() => setSidebarAbierto(false)}
              activeOpacity={0.8}
            >
              <Text style={web.btnCerrarSidebarTxt}>✕</Text>
            </TouchableOpacity>
          )}

          {/* Marca */}
          <View style={web.brand}>
            <Logo size={60} style={{ marginBottom: 6 }} />
            <Text style={web.brandTitulo}>RODEO CHILENO</Text>
            <Text style={web.brandSub}>Panel Administrador</Text>
          </View>

          {/* Navegación */}
          <View style={web.nav}>
            {NAV.map(item => {
              const activo = isActive(item.path);
              return (
                <TouchableOpacity
                  key={item.path}
                  style={[web.navItem, activo && web.navItemActivo]}
                  onPress={() => navegar(item.path)}
                  activeOpacity={0.75}
                >
                  <Text style={web.navIcono}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[web.navLabel, activo && web.navLabelActivo]}>
                      {item.label}
                    </Text>
                    <Text style={web.navDesc}>{item.desc}</Text>
                  </View>
                  {activo && <View style={web.navIndicador} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Separador */}
          <View style={web.divider} />

          {/* Proyección */}
          <TouchableOpacity
            style={web.navItem}
            onPress={() => navegar('/proyeccion')}
            activeOpacity={0.75}
          >
            <Text style={web.navIcono}>📺</Text>
            <View style={{ flex: 1 }}>
              <Text style={web.navLabel}>Ver Proyección</Text>
              <Text style={web.navDesc}>Pantalla para proyector</Text>
            </View>
          </TouchableOpacity>

          {/* Botón salir */}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={web.btnSalir} onPress={salir} activeOpacity={0.8}>
            <Text style={web.btnSalirTxt}>CERRAR SESIÓN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Contenido principal ── */}
      <View style={web.main}>
        {/* Topbar en móvil */}
        {esMovil && (
          <View style={web.topbar}>
            <TouchableOpacity
              style={web.btnHamburger}
              onPress={() => setSidebarAbierto(true)}
              activeOpacity={0.8}
            >
              <Text style={web.btnHamburgerTxt}>☰</Text>
            </TouchableOpacity>
            <Text style={web.topbarTitulo}>Panel Admin</Text>
          </View>
        )}
        <Slot />
      </View>
    </View>
  );
}

export default function AdminLayout() {
  if (Platform.OS === 'web') return <WebLayout />;
  return <MobileLayout />;
}

const AZUL  = '#003087';
const ROJO  = '#C8102E';
const FONDO = '#F3F4F6';

const web = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: FONDO,
    height: '100%' as any,
  },

  // Sidebar
  sidebar: {
    width: 240,
    backgroundColor: AZUL,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 4,
    flexShrink: 0,
  },
  brand: {
    alignItems: 'center',
    paddingBottom: 24,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  brandIcono: { fontSize: 32 },
  brandTitulo: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  brandSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: 1,
  },

  nav: { gap: 4, marginTop: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    position: 'relative',
  },
  navItemActivo: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  navIcono: { fontSize: 20, width: 26, textAlign: 'center' },
  navLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  navLabelActivo: {
    color: '#FFFFFF',
  },
  navDesc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 1,
  },
  navIndicador: {
    position: 'absolute',
    right: 0,
    top: 10,
    bottom: 10,
    width: 3,
    backgroundColor: ROJO,
    borderRadius: 2,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 8,
  },

  btnSalir: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: ROJO,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSalirTxt: {
    color: ROJO,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // Sidebar flotante móvil
  sidebarFloating: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },

  // Overlay oscuro al abrir sidebar en móvil
  overlay: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },

  // Botón cerrar sidebar (móvil)
  btnCerrarSidebar: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 4,
  },
  btnCerrarSidebarTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 20,
    fontWeight: '700',
  },

  // Topbar móvil (barra superior con hamburguesa)
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AZUL,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  btnHamburger: {
    padding: 4,
  },
  btnHamburgerTxt: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  topbarTitulo: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Main content
  main: {
    flex: 1,
    overflow: 'hidden' as any,
  },
});
