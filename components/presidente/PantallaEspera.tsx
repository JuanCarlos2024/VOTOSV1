import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { C, SIZES, SHADOWS } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';

export default function PantallaEspera(props: PresHeaderProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulso suave de la card
    const cardAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    // Pulso del punto verde
    const dotAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    cardAnim.start();
    dotAnim.start();
    return () => { cardAnim.stop(); dotAnim.stop(); };
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
          <Animated.View style={[styles.listeningDot, { opacity: dotOpacity }]} />
          <Text style={styles.listeningTxt}>Escuchando en tiempo real</Text>
        </View>
      </Animated.View>

      {/* Botón fijo en la parte inferior */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.btnHistorial}
          onPress={() => router.push('/historial-presidente')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.fondo,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.tarjeta,
    borderRadius: SIZES.radiusLg,
    padding: 40,
    borderWidth: 1,
    borderColor: C.borde,
    borderStyle: 'dashed',
    gap: 14,
    marginBottom: 80, // espacio para el botón fijo
  },
  icono: { fontSize: 80 },
  titulo: {
    fontSize: SIZES.txtSubtitulo,
    fontWeight: '900',
    color: '#4B5563',
    letterSpacing: 3,
  },
  msg: {
    fontSize: SIZES.txtBody,
    color: C.txtPrimario,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 28,
  },
  sub: {
    fontSize: SIZES.txtCaption,
    color: C.txtSecundario,
    textAlign: 'center',
    lineHeight: 24,
  },
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  listeningTxt: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomBar: {
    position: 'absolute' as any,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
    backgroundColor: C.fondo,
  },
  btnHistorial: {
    backgroundColor: C.azul,
    borderRadius: SIZES.radiusMd,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: SIZES.touchMin,
    justifyContent: 'center',
    ...SHADOWS.cardAzul,
  },
  btnHistorialTxt: {
    color: C.blanco,
    fontSize: SIZES.txtBody,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
