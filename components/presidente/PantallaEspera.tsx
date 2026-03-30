import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { C, SIZES, SHADOWS } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';

export default function PantallaEspera(props: PresHeaderProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.container}>
      <PresHeader {...props} />

      <Animated.View style={[styles.card, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.icono}>⏳</Text>
        <Text style={styles.titulo}>EN ESPERA</Text>
        <Text style={styles.msg}>Espera las instrucciones del administrador</Text>
        <Text style={styles.sub}>
          Cuando se abra una votación, aparecerá aquí automáticamente.
        </Text>
        <View style={styles.listeningRow}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningTxt}>Escuchando en tiempo real</Text>
        </View>
      </Animated.View>

      <TouchableOpacity
        style={styles.btnHistorial}
        onPress={() => router.push('/historial-presidente')}
        activeOpacity={0.8}
      >
        <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.fondo,
    paddingHorizontal: 20, paddingTop: 16,
  },
  card: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.tarjeta, borderRadius: SIZES.radiusLg,
    padding: 40, borderWidth: 1, borderColor: C.borde,
    borderStyle: 'dashed', gap: 14,
  },
  icono: { fontSize: 80 },
  titulo: {
    fontSize: SIZES.txtSubtitulo, fontWeight: '900',
    color: C.txtTercero, letterSpacing: 3,
  },
  msg: {
    fontSize: SIZES.txtBody, color: C.txtPrimario,
    textAlign: 'center', fontWeight: '700', lineHeight: 28,
  },
  sub: {
    fontSize: SIZES.txtCaption, color: C.txtSecundario,
    textAlign: 'center', lineHeight: 24,
  },
  listeningRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  listeningDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A',
  },
  listeningTxt: {
    fontSize: 13, color: '#16A34A', fontWeight: '700', letterSpacing: 1,
  },
  btnHistorial: {
    backgroundColor: C.azul, borderRadius: SIZES.radiusMd,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 16, minHeight: SIZES.touchMin,
    justifyContent: 'center', ...SHADOWS.cardAzul,
  },
  btnHistorialTxt: {
    color: C.blanco, fontSize: SIZES.txtBody,
    fontWeight: '900', letterSpacing: 1,
  },
});
