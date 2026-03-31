import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { C, SIZES, SHADOWS } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
};

export default function PantallaPresentacion({ pregunta, ...headerProps }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.015, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,     duration: 1800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const esTipo = pregunta.tipo === 'reglamento' ? '📜 REGLAMENTO' : '🗳 ELECCIÓN';

  return (
    <View style={styles.container}>
      <PresHeader {...headerProps} />

      {/* Badge estado */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeRevision}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeRevisionTxt}>EN REVISIÓN</Text>
        </View>
        <View style={styles.badgeTipo}>
          <Text style={styles.badgeTipoTxt}>{esTipo}</Text>
        </View>
      </View>

      {/* Card con el texto de la pregunta */}
      <Animated.View style={[styles.card, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.cardLabel}>PRÓXIMA VOTACIÓN</Text>
        <Text style={styles.cardTexto}>{pregunta.texto}</Text>
      </Animated.View>

      {/* Mensaje informativo */}
      <View style={styles.infoBox}>
        <Text style={styles.infoIcono}>ℹ️</Text>
        <Text style={styles.infoTxt}>
          El administrador está presentando esta pregunta.{'\n'}
          La votación aún no ha sido habilitada.
        </Text>
      </View>

      {/* Indicador en vivo */}
      <View style={styles.listeningRow}>
        <View style={styles.listeningDot} />
        <Text style={styles.listeningTxt}>Escuchando en tiempo real</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.fondo,
    paddingHorizontal: 20, paddingTop: 16,
  },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, marginBottom: 14,
  },
  badgeRevision: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1.5, borderColor: '#F59E0B',
  },
  badgeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706',
  },
  badgeRevisionTxt: {
    fontSize: 12, fontWeight: '900', color: '#92400E', letterSpacing: 1.5,
  },
  badgeTipo: {
    backgroundColor: '#EEF2FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  badgeTipoTxt: {
    fontSize: 11, fontWeight: '800', color: '#3730A3', letterSpacing: 0.5,
  },
  card: {
    flex: 1,
    backgroundColor: C.tarjeta,
    borderRadius: SIZES.radiusLg,
    padding: 32,
    borderWidth: 2,
    borderColor: '#F59E0B',
    gap: 16,
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  cardLabel: {
    fontSize: 11, fontWeight: '900', color: '#D97706',
    letterSpacing: 2, textAlign: 'center',
  },
  cardTexto: {
    fontSize: SIZES.txtTitulo ?? 26,
    fontWeight: '800',
    color: C.txtPrimario,
    textAlign: 'center',
    lineHeight: 38,
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F0F9FF', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#BAE6FD',
    marginTop: 16,
  },
  infoIcono: { fontSize: 18, marginTop: 1 },
  infoTxt: {
    flex: 1, fontSize: 14, color: '#0369A1',
    lineHeight: 21, fontWeight: '600',
  },
  listeningRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, justifyContent: 'center',
    marginTop: 16, marginBottom: 8,
  },
  listeningDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#D97706',
  },
  listeningTxt: {
    fontSize: 13, color: '#D97706', fontWeight: '700', letterSpacing: 1,
  },
});
