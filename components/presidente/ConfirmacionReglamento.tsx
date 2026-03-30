import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { C, SIZES, VOTO_COLORS } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
  opcionPendiente: string;
  enviando: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
};

export default function ConfirmacionReglamento({
  pregunta, opcionPendiente, enviando, onConfirmar, onVolver, ...headerProps
}: Props) {
  const col = VOTO_COLORS[opcionPendiente] ?? {
    bg: '#F3F4F6', border: '#9CA3AF', text: '#374151', icon: '⬜', bgSolid: '#6B7280',
  };
  const { usuario } = headerProps;

  return (
    <View style={styles.container}>
      <PresHeader {...headerProps} />

      <View style={styles.card}>
        {/* Pregunta */}
        <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>

        {/* Título */}
        <Text style={styles.titulo}>¿Estás seguro/a?</Text>

        {/* Opción elegida — grande y de color */}
        <View style={[styles.opcionBox, { borderColor: col.border, backgroundColor: col.bg }]}>
          <Text style={styles.opcionIcono}>{col.icon}</Text>
          <Text style={[styles.opcionTxt, { color: col.text }]}>
            {opcionPendiente.toUpperCase()}
          </Text>
        </View>

        {/* Peso del voto — prominente */}
        <View style={[styles.pesoBadge, { backgroundColor: col.bgSolid }]}>
          <Text style={styles.pesoTxt}>
            Esto emitirá {usuario.votos_disponibles} voto{usuario.votos_disponibles !== 1 ? 's' : ''} a nombre de tu asociación
          </Text>
        </View>

        <Text style={styles.aviso}>⚠️ Esta acción no se puede deshacer.</Text>

        {/* Botón confirmar */}
        <TouchableOpacity
          style={[styles.btnConfirmar, { backgroundColor: col.bgSolid }, enviando && { opacity: 0.6 }]}
          onPress={onConfirmar}
          disabled={enviando}
          activeOpacity={0.8}
        >
          {enviando
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.btnConfirmarTxt}>SÍ, CONFIRMAR MI VOTO</Text>
          }
        </TouchableOpacity>

        {/* Botón volver */}
        <TouchableOpacity
          style={styles.btnVolver}
          onPress={onVolver}
          disabled={enviando}
          activeOpacity={0.8}
        >
          <Text style={styles.btnVolverTxt}>NO, VOLVER ATRÁS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.fondo,
    paddingHorizontal: 20, paddingTop: 16,
  },
  card: {
    flex: 1, backgroundColor: C.tarjeta, borderRadius: SIZES.radiusLg,
    padding: 24, borderWidth: 1, borderColor: C.borde, gap: 16,
  },
  preguntaTxt: {
    fontSize: SIZES.txtCaption, color: C.txtSecundario,
    lineHeight: 22, fontStyle: 'italic',
  },
  titulo: {
    fontSize: 30, fontWeight: '900', color: C.txtPrimario, textAlign: 'center',
  },
  opcionBox: {
    borderWidth: 3, borderRadius: SIZES.radiusMd,
    padding: 24, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 16,
  },
  opcionIcono: { fontSize: 40 },
  opcionTxt: { fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  pesoBadge: {
    borderRadius: SIZES.radiusSm, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  pesoTxt: {
    color: C.blanco, fontSize: SIZES.txtBody,
    fontWeight: '700', textAlign: 'center', lineHeight: 24,
  },
  aviso: {
    fontSize: SIZES.txtCaption, color: C.txtSecundario,
    textAlign: 'center', lineHeight: 22,
  },
  btnConfirmar: {
    borderRadius: SIZES.radiusMd, paddingVertical: 22,
    alignItems: 'center', justifyContent: 'center', minHeight: SIZES.touchMin,
  },
  btnConfirmarTxt: {
    color: C.blanco, fontSize: SIZES.txtSubtitulo, fontWeight: '900', letterSpacing: 1,
  },
  btnVolver: {
    borderWidth: 1.5, borderColor: C.borde, borderRadius: SIZES.radiusMd,
    paddingVertical: 16, alignItems: 'center',
    minHeight: SIZES.touchSecondary, backgroundColor: C.tarjeta,
  },
  btnVolverTxt: { color: C.txtSecundario, fontSize: SIZES.txtBody, fontWeight: '700' },
});
