import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/theme';
import type { TipoAudit } from '../../lib/auditoria';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditoriaRow {
  id: string;
  created_at: string;
  tipo: TipoAudit;
  nombre_usuario: string;
  detalle: string;
  plataforma: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPOS_FILTRO: Array<{ label: string; value: string }> = [
  { label: 'TODOS', value: '' },
  { label: 'LOGIN', value: 'LOGIN' },
  { label: 'LOGOUT', value: 'LOGOUT' },
  { label: 'VOTO', value: 'VOTO' },
  { label: 'LIBERAR', value: 'LIBERAR' },
  { label: 'CERRAR', value: 'CERRAR' },
  { label: 'RESET', value: 'RESET' },
  { label: 'TIMEOUT', value: 'TIMEOUT' },
];

const COLOR_TIPO: Record<string, string> = {
  LOGIN:   '#16A34A',
  LOGOUT:  '#6B7280',
  VOTO:    '#1E40AF',
  LIBERAR: '#15803D',
  CERRAR:  '#374151',
  RESET:   '#C8102E',
  TIMEOUT: '#D97706',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  } catch {
    return '—';
  }
}

// ─── Row component ───────────────────────────────────────────────────────────

const AuditoriaItem = React.memo(function AuditoriaItem({
  item,
}: {
  item: AuditoriaRow;
}) {
  const color = COLOR_TIPO[item.tipo] ?? '#6B7280';
  return (
    <View style={styles.fila}>
      {/* Badge de tipo */}
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeTexto}>{item.tipo}</Text>
      </View>

      {/* Contenido central */}
      <View style={styles.filaCentro}>
        <Text style={styles.usuario} numberOfLines={1}>
          {item.nombre_usuario}
        </Text>
        <Text style={styles.detalle} numberOfLines={2}>
          {item.detalle}
        </Text>
        <View style={styles.plataformaRow}>
          <Text style={styles.plataforma}>{item.plataforma}</Text>
        </View>
      </View>

      {/* Fecha */}
      <Text style={styles.fecha}>{formatFecha(item.created_at)}</Text>
    </View>
  );
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AuditoriaScreen() {
  const [registros, setRegistros] = useState<AuditoriaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefrescando(true);
      else setCargando(true);

      try {
        let query = supabase
          .from('auditoria')
          .select('id, created_at, tipo, nombre_usuario, detalle, plataforma')
          .order('created_at', { ascending: false })
          .limit(200);

        if (filtroTipo !== '') {
          query = query.eq('tipo', filtroTipo);
        }

        if (filtroUsuario.trim() !== '') {
          query = query.ilike('nombre_usuario', `%${filtroUsuario.trim()}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          setRegistros(data as AuditoriaRow[]);
        }
      } catch (err) {
        console.error('Error al cargar auditoría:', err);
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [filtroTipo, filtroUsuario]
  );

  // Reload whenever filters change
  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Render ──

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
          keyExtractor={(item) => item.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosTipoLista}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.pill,
                filtroTipo === item.value && styles.pillActiva,
              ]}
              onPress={() => setFiltroTipo(item.value)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pillTexto,
                  filtroTipo === item.value && styles.pillTextoActivo,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Filtro por usuario */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.inputUsuario}
          placeholder="Filtrar por usuario…"
          placeholderTextColor="#9CA3AF"
          value={filtroUsuario}
          onChangeText={setFiltroUsuario}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Nota informativa */}
      <Text style={styles.nota}>
        Tabla 'auditoria' debe existir en Supabase. Si no hay registros, créala primero.
      </Text>

      {/* Lista de registros */}
      <FlatList
        data={registros}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AuditoriaItem item={item} />}
        contentContainerStyle={
          registros.length === 0 ? styles.listaVacia : styles.lista
        }
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
            <Text style={styles.vacioTexto}>No hay registros de auditoría</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separador} />}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    gap: 12,
  },
  cargandoTexto: {
    fontSize: 14,
    color: C.azul,
    fontWeight: '500',
  },

  // Filtros de tipo (pills)
  filtrosTipoWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtrosTipoLista: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  pillActiva: {
    backgroundColor: C.azul,
    borderColor: C.azul,
  },
  pillTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextoActivo: {
    color: '#FFFFFF',
  },

  // Input usuario
  inputWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inputUsuario: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },

  // Nota
  nota: {
    fontSize: 11,
    color: '#9CA3AF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#F8F9FB',
  },

  // Lista
  lista: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 30,
  },
  listaVacia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // Fila individual
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    minWidth: 60,
    alignItems: 'center',
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  filaCentro: {
    flex: 1,
    gap: 3,
  },
  usuario: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  detalle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  plataformaRow: {
    flexDirection: 'row',
  },
  plataforma: {
    fontSize: 10,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  fecha: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginTop: 2,
    whiteSpace: 'nowrap',
  } as any,
  separador: {
    height: 6,
  },

  // Estado vacío
  vacioCont: {
    alignItems: 'center',
    gap: 10,
  },
  vacioIcon: {
    fontSize: 40,
  },
  vacioTexto: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
