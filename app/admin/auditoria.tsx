import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import type { TipoAudit } from '../../lib/auditoria';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditoriaRow {
  id: string;
  fecha: string;
  accion: TipoAudit;
  nombre_usuario: string;
  asociacion_nombre: string | null;
  pregunta_texto: string | null;
  detalle: string;
  dispositivo: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS_FILTRO: Array<{ label: string; value: string }> = [
  { label: 'TODOS',       value: '' },
  { label: '🔑 LOGIN',    value: 'LOGIN' },
  { label: '🚪 LOGOUT',   value: 'LOGOUT' },
  { label: '✅ VOTO',     value: 'VOTO' },
  { label: '📺 PROYECTAR', value: 'PROYECTAR' },
  { label: '🔓 LIBERAR',  value: 'LIBERAR' },
  { label: '🔒 CERRAR',   value: 'CERRAR' },
  { label: '✏️ EDITAR',   value: 'EDITAR' },
  { label: '🔄 RESET',    value: 'RESET' },
  { label: '🏆 UNÁNIME',  value: 'UNANIMIDAD' },
  { label: '⏱ TIMEOUT',   value: 'TIMEOUT' },
];

const ICONO_ACCION: Record<string, string> = {
  LOGIN:      '🔑',
  LOGOUT:     '🚪',
  VOTO:       '✅',
  PROYECTAR:  '📺',
  LIBERAR:    '🔓',
  CERRAR:     '🔒',
  EDITAR:     '✏️',
  RESET:      '🔄',
  UNANIMIDAD: '🏆',
  TIMEOUT:    '⏱',
};

const COLOR_ACCION: Record<string, string> = {
  LOGIN:      '#16A34A',
  LOGOUT:     '#6B7280',
  VOTO:       '#1E40AF',
  PROYECTAR:  '#1D4ED8',
  LIBERAR:    '#15803D',
  CERRAR:     '#374151',
  EDITAR:     '#7C3AED',
  UNANIMIDAD: '#D97706',
  RESET:      '#C8102E',
  TIMEOUT:    '#B45309',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const aaaa = d.getFullYear();
    const hh  = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss  = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${aaaa} ${hh}:${min}:${ss}`;
  } catch {
    return '—';
  }
}

// ─── Row component ────────────────────────────────────────────────────────────

const AuditoriaItem = React.memo(function AuditoriaItem({ item }: { item: AuditoriaRow }) {
  const color  = COLOR_ACCION[item.accion] ?? '#6B7280';
  const icono  = ICONO_ACCION[item.accion] ?? '📋';
  const nombre = item.asociacion_nombre || item.nombre_usuario;

  return (
    <View style={styles.fila}>
      {/* Badge acción */}
      <View style={[styles.badgeWrap, { backgroundColor: color + '18', borderColor: color + '40' }]}>
        <Text style={styles.badgeIcono}>{icono}</Text>
        <Text style={[styles.badgeTexto, { color }]}>{item.accion}</Text>
      </View>

      {/* Contenido */}
      <View style={styles.filaCentro}>
        <Text style={styles.usuario} numberOfLines={1}>{nombre}</Text>
        {item.pregunta_texto ? (
          <Text style={styles.preguntaTxt} numberOfLines={1}>
            📋 {item.pregunta_texto}
          </Text>
        ) : null}
        <Text style={styles.detalle} numberOfLines={2}>{item.detalle}</Text>
        {item.dispositivo ? (
          <Text style={styles.dispositivo} numberOfLines={1}>{item.dispositivo}</Text>
        ) : null}
      </View>

      {/* Fecha */}
      <Text style={styles.fecha}>{formatFecha(item.fecha)}</Text>
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuditoriaScreen() {
  const [registros, setRegistros]       = useState<AuditoriaRow[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [refrescando, setRefrescando]   = useState(false);
  const [filtroTipo, setFiltroTipo]     = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefrescando(true);
    else setCargando(true);

    try {
      let query = supabase
        .from('auditoria')
        .select('id, fecha, accion, nombre_usuario, asociacion_nombre, pregunta_texto, detalle, dispositivo')
        .order('fecha', { ascending: false })
        .limit(300);

      if (filtroTipo !== '') {
        query = query.eq('accion', filtroTipo);
      }

      if (filtroUsuario.trim() !== '') {
        const t = filtroUsuario.trim();
        query = query.or(`nombre_usuario.ilike.%${t}%,asociacion_nombre.ilike.%${t}%`);
      }

      const { data, error } = await query;
      if (!error && data) setRegistros(data as AuditoriaRow[]);
    } catch (err) {
      console.error('Error al cargar auditoría:', err);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [filtroTipo, filtroUsuario]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={C.azul} />
        <Text style={styles.cargandoTexto}>Cargando registros…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fondo}>
      {/* Filtros de tipo */}
      <View style={styles.filtrosTipoWrap}>
        <FlatList
          data={TIPOS_FILTRO}
          keyExtractor={item => item.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosTipoLista}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, filtroTipo === item.value && styles.pillActiva]}
              onPress={() => setFiltroTipo(item.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillTexto, filtroTipo === item.value && styles.pillTextoActivo]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Filtro por usuario / asociación */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.inputUsuario}
          placeholder="Filtrar por usuario o asociación…"
          placeholderTextColor="#9CA3AF"
          value={filtroUsuario}
          onChangeText={setFiltroUsuario}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Contador */}
      <Text style={styles.contador}>
        {registros.length} registro{registros.length !== 1 ? 's' : ''}
        {filtroTipo || filtroUsuario.trim() ? ' (filtrado)' : ''}
      </Text>

      {/* Lista */}
      <FlatList
        data={registros}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <AuditoriaItem item={item} />}
        contentContainerStyle={registros.length === 0 ? styles.listaVacia : styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => cargar(true)}
            tintColor={C.azul}
            colors={[C.azul]}
          />
        }
        ListEmptyComponent={
          <View style={styles.vacioCont}>
            <Text style={styles.vacioIcon}>📋</Text>
            <Text style={styles.vacioTexto}>Sin registros de auditoría</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separador} />}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#F8F9FB' },
  centrado: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8F9FB', gap: 12,
  },
  cargandoTexto: { fontSize: 14, color: C.azul, fontWeight: '500' },

  filtrosTipoWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  filtrosTipoLista: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  pill: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6',
  },
  pillActiva: { backgroundColor: C.azul, borderColor: C.azul },
  pillTexto: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  pillTextoActivo: { color: '#FFFFFF' },

  inputWrap: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  inputUsuario: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },

  contador: {
    fontSize: 11, color: '#9CA3AF',
    paddingHorizontal: 14, paddingVertical: 5,
  },

  lista: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 30 },
  listaVacia: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  fila: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderRadius: 10,
    padding: 12, gap: 10,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2,
  },
  badgeWrap: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 6,
    alignItems: 'center', gap: 2,
    minWidth: 64, alignSelf: 'flex-start',
  },
  badgeIcono: { fontSize: 16 },
  badgeTexto: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  filaCentro: { flex: 1, gap: 3 },
  usuario: { fontSize: 13, fontWeight: '700', color: '#111827' },
  preguntaTxt: {
    fontSize: 11, color: '#6B7280', fontStyle: 'italic',
  },
  detalle: { fontSize: 12, color: '#374151', lineHeight: 17 },
  dispositivo: {
    fontSize: 10, color: '#9CA3AF',
    backgroundColor: '#F3F4F6', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 2,
  },

  fecha: {
    fontSize: 10, color: '#9CA3AF', fontWeight: '500',
    alignSelf: 'flex-start', marginTop: 2,
    textAlign: 'right', minWidth: 80,
  } as any,

  separador: { height: 6 },
  vacioCont: { alignItems: 'center', gap: 10 },
  vacioIcon: { fontSize: 40 },
  vacioTexto: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
});
