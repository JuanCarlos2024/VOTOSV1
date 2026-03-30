import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { C, SIZES, VOTO_COLORS, SHADOWS } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta, Candidato } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
  tipo: 'reglamento' | 'eleccion';
  miRespuesta: string;          // solo para reglamento
  candidatosVotados: Candidato[]; // solo para eleccion
};

export default function YaVoto({
  pregunta, tipo, miRespuesta, candidatosVotados, ...headerProps
}: Props) {
  const esReg = tipo === 'reglamento';
  const col = esReg
    ? (VOTO_COLORS[miRespuesta] ?? { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151', bgSolid: '#6B7280', icon: '⬜' })
    : { bg: '#EEF2FF', border: C.azul, text: C.azul, bgSolid: C.azul, icon: '🔒' };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <PresHeader {...headerProps} />

      <View style={[
        styles.card,
        { borderColor: col.border, backgroundColor: col.bg },
      ]}>
        <Text style={styles.iconoCheck}>{esReg ? '✅' : '🔒'}</Text>
        <Text style={[styles.titulo, { color: col.text }]}>YA EMITISTE TU VOTO</Text>

        {/* Texto de la pregunta siempre visible */}
        <View style={styles.preguntaBox}>
          <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>
        </View>

        {/* Resultado */}
        <View style={[styles.resultadoBox, { borderColor: col.border }]}>
          {esReg ? (
            <>
              <Text style={styles.resultadoLabel}>TU VOTO FUE</Text>
              <Text style={[styles.resultadoValor, { color: col.text }]}>
                {col.icon} {miRespuesta.toUpperCase()}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.resultadoLabel}>CANDIDATOS SELECCIONADOS</Text>
              {candidatosVotados.length > 0 ? (
                candidatosVotados.map(c => (
                  <View key={c.id} style={styles.candFila}>
                    <Text style={styles.candCheck}>✓</Text>
                    <Text style={[styles.candNombre, { color: C.azul }]}>{c.nombre}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.resultadoValor, { color: C.azul, fontSize: 18 }]}>
                  Voto confidencial
                </Text>
              )}
            </>
          )}
          <Text style={styles.pesoTxt}>
            Peso emitido: {headerProps.usuario.votos_disponibles} voto{headerProps.usuario.votos_disponibles !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.btnHistorial}
        onPress={() => router.push('/historial-presidente')}
        activeOpacity={0.8}
      >
        <Text style={styles.btnHistorialTxt}>MI HISTORIAL</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.fondo },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },
  card: {
    alignItems: 'center', borderRadius: SIZES.radiusLg,
    padding: 32, borderWidth: 2, gap: 16,
    ...SHADOWS.cardMd,
  },
  iconoCheck: { fontSize: 110, marginBottom: 4 },
  titulo: { fontSize: SIZES.txtSubtitulo, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  preguntaBox: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: SIZES.radiusSm, padding: 14,
  },
  preguntaTxt: {
    fontSize: SIZES.txtBody, fontWeight: '600', color: C.txtPrimario,
    textAlign: 'center', lineHeight: 26,
  },
  resultadoBox: {
    width: '100%', backgroundColor: C.blanco, borderRadius: SIZES.radiusMd,
    padding: 20, alignItems: 'center', borderWidth: 2, gap: 10,
  },
  resultadoLabel: {
    fontSize: 11, color: C.txtSecundario, letterSpacing: 2, fontWeight: '800',
  },
  resultadoValor: { fontSize: 32, fontWeight: '900' },
  candFila: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  candCheck: { color: '#16A34A', fontSize: 20, fontWeight: '900' },
  candNombre: { fontSize: SIZES.txtBody, fontWeight: '700', flex: 1 },
  pesoTxt: { fontSize: SIZES.txtCaption, color: C.txtTercero, marginTop: 4 },
  btnHistorial: {
    backgroundColor: C.azul, borderRadius: SIZES.radiusMd,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 16, minHeight: SIZES.touchMin, justifyContent: 'center',
    ...SHADOWS.cardAzul,
  },
  btnHistorialTxt: {
    color: C.blanco, fontSize: SIZES.txtBody, fontWeight: '900', letterSpacing: 1,
  },
});
