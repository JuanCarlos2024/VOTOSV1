import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { C, SIZES, VOTO_COLORS, SHADOWS } from '../../lib/theme';
import { hapticImpact } from '../../lib/haptics';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
  resetInactividad: () => void;
  onSeleccionar: (opcion: string) => void;
};

const OPCIONES = ['Apruebo', 'Rechazo', 'Abstengo'] as const;

export default function VotarReglamento({
  pregunta, resetInactividad, onSeleccionar, ...headerProps
}: Props) {
  return (
    <View style={styles.container}>
      <PresHeader {...headerProps} />

      {/* Card pregunta */}
      <View style={styles.preguntaCard}>
        <View style={styles.tipoBadge}>
          <Text style={styles.tipoBadgeTxt}>📜 REGLAMENTO</Text>
        </View>
        <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>
      </View>

      <Text style={styles.instruccion}>ELIGE UNA OPCIÓN</Text>

      {OPCIONES.map(op => {
        const col = VOTO_COLORS[op];
        return (
          <TouchableOpacity
            key={op}
            style={[styles.opcionBtn, { borderColor: col.border, backgroundColor: col.bg }]}
            onPress={() => {
              hapticImpact();
              resetInactividad();
              onSeleccionar(op);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.opcionIcono}>{col.icon}</Text>
            <Text style={[styles.opcionTxt, { color: col.text }]}>{op.toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}

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
  preguntaCard: {
    backgroundColor: C.tarjeta, borderRadius: SIZES.radiusMd,
    padding: 20, marginBottom: 24, borderWidth: 2, borderColor: C.azul,
  },
  tipoBadge: {
    backgroundColor: C.rojo, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12,
  },
  tipoBadgeTxt: { color: C.blanco, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  preguntaTxt: {
    fontSize: 20, fontWeight: '900', color: C.txtPrimario, lineHeight: 28,
  },
  instruccion: {
    color: C.azul, fontSize: SIZES.txtBadge, fontWeight: '800',
    letterSpacing: 2, marginBottom: 18,
  },
  opcionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 2.5, borderRadius: 18,
    paddingVertical: 18, paddingHorizontal: 24,
    marginBottom: 16, minHeight: SIZES.touchMin,
    ...SHADOWS.card,
  },
  opcionIcono: { fontSize: 26 },
  opcionTxt: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  btnHistorial: {
    backgroundColor: C.azul, borderRadius: SIZES.radiusMd,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 6, minHeight: SIZES.touchMin, justifyContent: 'center',
  },
  btnHistorialTxt: {
    color: C.blanco, fontSize: SIZES.txtBody, fontWeight: '900', letterSpacing: 1,
  },
});
