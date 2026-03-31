import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../Logo';
import { C, SIZES, SHADOWS } from '../../lib/theme';
import type { Usuario } from '../../lib/supabase';

export type PresHeaderProps = {
  usuario: Usuario;
  conectado: boolean;
  msgPendiente: string;
  onClearMsg: () => void;
  onLogout: () => void;
};

export default function PresHeader({
  usuario, conectado, msgPendiente, onClearMsg, onLogout,
}: PresHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: C.fondo }}>
      {!conectado && (
        <View style={styles.banner}>
          <Text style={styles.bannerTxt}>🔴 SIN CONEXIÓN — Los cambios pueden no reflejarse</Text>
        </View>
      )}
      {msgPendiente !== '' && (
        <TouchableOpacity onPress={onClearMsg} activeOpacity={0.8}>
          <View style={[
            styles.banner,
            { backgroundColor: msgPendiente.startsWith('✅') ? '#14532D' : '#7F1D1D' },
          ]}>
            <Text style={styles.bannerTxt}>{msgPendiente}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <Logo size={44} style={{ marginRight: 12 }} />

        <View style={styles.info}>
          <Text style={styles.nombre} numberOfLines={2}>{usuario.nombre_usuario}</Text>
          <View style={styles.badges}>
            <View style={styles.pesoBadge}>
              <Text style={styles.pesoTxt}>
                ⚖ {usuario.votos_disponibles} voto{usuario.votos_disponibles !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={[
              styles.conexBadge,
              { backgroundColor: conectado ? '#16A34A' : '#DC2626' },
            ]}>
              <Text style={styles.conexTxt}>
                {conectado ? '● Conectado' : '● Sin conexión'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={onLogout} style={styles.btnSalir} activeOpacity={0.8}>
          <Text style={styles.btnSalirTxt}>Salir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#7F1D1D', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: 8, alignItems: 'center',
  },
  bannerTxt: { color: '#FCA5A5', fontSize: SIZES.txtCaption, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.azul, borderRadius: SIZES.radiusMd,
    padding: 14, marginBottom: 16,
    ...SHADOWS.cardAzul,
  },
  info: { flex: 1 },
  nombre: {
    color: C.blanco, fontSize: SIZES.txtBody,
    fontWeight: '800', lineHeight: 24, marginBottom: 6,
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pesoBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  pesoTxt: { color: C.blanco, fontSize: SIZES.txtBadge, fontWeight: '700' },
  conexBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  conexTxt: { color: C.blanco, fontSize: 12, fontWeight: '600' },
  btnSalir: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    minHeight: SIZES.touchSecondary, justifyContent: 'center', marginLeft: 8,
  },
  btnSalirTxt: { color: C.blanco, fontSize: SIZES.txtCaption, fontWeight: '700' },
});
