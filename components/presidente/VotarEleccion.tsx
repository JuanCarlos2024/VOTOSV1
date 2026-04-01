import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { C, SIZES, SHADOWS } from '../../lib/theme';
import { hapticLight, hapticImpact } from '../../lib/haptics';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta, Candidato } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
  candidatos: Candidato[];
  seleccionados: string[];
  resetInactividad: () => void;
  onToggle: (id: string) => void;
  onConfirmar: () => void;
};

export default function VotarEleccion({
  pregunta, candidatos, seleccionados,
  resetInactividad, onToggle, onConfirmar,
  ...headerProps
}: Props) {
  const max = pregunta.max_selecciones ?? 1;
  const limitAlcanzado = seleccionados.length >= max;
  const exacto = seleccionados.length === max;
  const puedeContinuar = exacto;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <PresHeader {...headerProps} />

      {/* Card pregunta */}
      <View style={[styles.preguntaCard, { borderColor: C.azul }]}>
        <View style={[styles.tipoBadge, { backgroundColor: C.azul }]}>
          <Text style={styles.tipoBadgeTxt}>🗳 ELECCIÓN</Text>
        </View>
        <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>
      </View>

      {/* Contador */}
      <View style={styles.contadorRow}>
        <Text style={styles.instruccion}>SELECCIONA EXACTAMENTE {max} CANDIDATO(S)</Text>
        <Text style={[
          styles.contadorChip,
          { color: exacto ? '#16A34A' : C.rojo },
        ]}>
          {seleccionados.length} / {max}
        </Text>
      </View>
      <Text style={styles.contadorSub}>
        Seleccionados: {seleccionados.length} de {max} requeridos
      </Text>

      {/* Lista de candidatos */}
      {candidatos.map(c => {
        const sel = seleccionados.includes(c.id);
        const desactivado = !sel && limitAlcanzado;
        return (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.candidatoItem,
              sel && styles.candidatoSel,
              desactivado && styles.candidatoDes,
            ]}
            onPress={() => {
              if (!desactivado) {
                hapticLight();
                resetInactividad();
                onToggle(c.id);
              }
            }}
            activeOpacity={desactivado ? 1 : 0.8}
          >
            <View style={[styles.checkbox, sel && styles.checkboxSel]}>
              {sel && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[
              styles.candidatoNombre,
              sel && { color: C.azul, fontWeight: '800' },
              desactivado && { color: '#BBBBBB' },
            ]}>
              {c.nombre}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Mensaje de error si intenta confirmar sin completar */}
      {!puedeContinuar && seleccionados.length > 0 && (
        <Text style={styles.errorMsg}>
          Debes seleccionar exactamente {max} candidato{max !== 1 ? 's' : ''} para poder votar.
        </Text>
      )}

      {/* Botón confirmar */}
      <TouchableOpacity
        style={[
          styles.btnConfirmar,
          { backgroundColor: C.rojo },
          !puedeContinuar && { opacity: 0.3 },
        ]}
        onPress={() => {
          if (puedeContinuar) {
            hapticImpact();
            onConfirmar();
          }
        }}
        disabled={!puedeContinuar}
        activeOpacity={0.8}
      >
        <Text style={styles.btnConfirmarTxt}>CONFIRMAR SELECCIÓN</Text>
      </TouchableOpacity>

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

  preguntaCard: {
    backgroundColor: C.tarjeta, borderRadius: SIZES.radiusMd,
    padding: 20, marginBottom: 24, borderWidth: 2,
  },
  tipoBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12,
  },
  tipoBadgeTxt: { color: C.blanco, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  preguntaTxt: { fontSize: 20, fontWeight: '900', color: C.txtPrimario, lineHeight: 28 },

  contadorRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  instruccion: {
    color: C.azul, fontSize: SIZES.txtBadge, fontWeight: '800', letterSpacing: 2, flex: 1,
  },
  contadorChip: { fontSize: 22, fontWeight: '900' },
  contadorSub: {
    color: C.txtSecundario, fontSize: 13, marginBottom: 14, marginTop: -6,
  },
  errorMsg: {
    color: C.rojo, fontSize: 14, fontWeight: '600',
    textAlign: 'center', marginBottom: 10, marginTop: 4,
  },

  candidatoItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.blanco, borderRadius: SIZES.radiusMd,
    padding: 18, marginBottom: 12,
    borderWidth: 2, borderColor: C.borde,
    gap: 14, minHeight: SIZES.touchMin, ...SHADOWS.card,
  },
  candidatoSel: { borderColor: C.rojo, backgroundColor: C.rojoBg },
  candidatoDes: { opacity: 0.35 },
  checkbox: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 2,
    borderColor: C.txtTercero, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSel: { backgroundColor: C.rojo, borderColor: C.rojo },
  checkMark: { color: C.blanco, fontSize: 20, fontWeight: '900' },
  candidatoNombre: {
    flex: 1, fontSize: 16, fontWeight: '600', color: C.txtSecundario,
  },

  btnConfirmar: {
    borderRadius: SIZES.radiusMd, paddingVertical: 22,
    alignItems: 'center', justifyContent: 'center',
    minHeight: SIZES.touchMin, marginTop: 16,
  },
  btnConfirmarTxt: {
    color: C.blanco, fontSize: SIZES.txtSubtitulo,
    fontWeight: '900', letterSpacing: 1,
  },
  btnHistorial: {
    backgroundColor: C.azul, borderRadius: SIZES.radiusMd,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 12, minHeight: SIZES.touchMin, justifyContent: 'center',
  },
  btnHistorialTxt: {
    color: C.blanco, fontSize: SIZES.txtBody, fontWeight: '900', letterSpacing: 1,
  },
});
