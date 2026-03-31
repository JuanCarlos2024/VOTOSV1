import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { C, SIZES } from '../../lib/theme';
import PresHeader, { PresHeaderProps } from './PresHeader';
import type { Pregunta, Candidato } from '../../lib/supabase';

type Props = PresHeaderProps & {
  pregunta: Pregunta;
  seleccionados: string[];
  candidatos: Candidato[];
  enviando: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
};

export default function ConfirmacionEleccion({
  pregunta, seleccionados, candidatos, enviando, onConfirmar, onVolver, ...headerProps
}: Props) {
  const nombresSeleccionados = seleccionados
    .map(id => candidatos.find(c => c.id === id)?.nombre ?? '')
    .filter(Boolean);
  const { usuario } = headerProps;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <PresHeader {...headerProps} />

      <View style={styles.card}>
        <Text style={styles.preguntaTxt}>{pregunta.texto}</Text>

        <Text style={styles.titulo}>¿Estás seguro/a?</Text>
        <Text style={styles.sub}>Quieres votar por:</Text>

        {/* Candidatos seleccionados */}
        <View style={styles.listaCands}>
          {nombresSeleccionados.map((n, i) => (
            <View key={i} style={styles.candFila}>
              <Text style={styles.candIcono}>✅</Text>
              <Text style={styles.candNombre}>{n}</Text>
            </View>
          ))}
        </View>

        {/* Peso del voto */}
        <View style={styles.pesoBadge}>
          <Text style={styles.pesoTxt}>
            Esto emitirá {usuario.votos_disponibles} voto{usuario.votos_disponibles !== 1 ? 's' : ''} por cada candidato seleccionado
          </Text>
        </View>

        <Text style={styles.aviso}>⚠️ Esta acción no se puede deshacer.</Text>

        <TouchableOpacity
          style={[styles.btnConfirmar, enviando && { opacity: 0.6 }]}
          onPress={onConfirmar}
          disabled={enviando}
          activeOpacity={0.8}
        >
          {enviando
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.btnConfirmarTxt}>SÍ, CONFIRMAR MI VOTO</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnVolver}
          onPress={onVolver}
          disabled={enviando}
          activeOpacity={0.8}
        >
          <Text style={styles.btnVolverTxt}>NO, VOLVER ATRÁS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.fondo },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },
  card: {
    backgroundColor: C.blanco, borderRadius: SIZES.radiusLg,
    padding: 24, borderWidth: 2, borderColor: C.bordeCard, gap: 16,
    shadowColor: '#0A1929', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 5,
  },
  preguntaTxt: {
    fontSize: SIZES.txtCaption, color: C.txtSecundario,
    lineHeight: 22, fontStyle: 'italic',
  },
  titulo: { fontSize: 30, fontWeight: '900', color: '#111827', textAlign: 'center' },
  sub: { fontSize: SIZES.txtBody, color: '#374151', fontWeight: '700', textAlign: 'center' },
  listaCands: { gap: 10 },
  candFila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: SIZES.radiusSm,
    padding: 16, borderWidth: 2, borderColor: '#86EFAC',
  },
  candIcono: { fontSize: 24 },
  candNombre: { fontSize: SIZES.txtBody, color: '#14532D', fontWeight: '800', flex: 1 },
  pesoBadge: {
    backgroundColor: C.azul, borderRadius: SIZES.radiusSm,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
  },
  pesoTxt: {
    color: C.blanco, fontSize: SIZES.txtBody,
    fontWeight: '800', textAlign: 'center', lineHeight: 24,
  },
  aviso: {
    fontSize: SIZES.txtCaption, color: '#92400E', fontWeight: '700',
    textAlign: 'center', lineHeight: 22,
    backgroundColor: '#FEF3C7', borderRadius: SIZES.radiusSm,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  btnConfirmar: {
    backgroundColor: C.rojo, borderRadius: SIZES.radiusMd,
    paddingVertical: 22, alignItems: 'center',
    justifyContent: 'center', minHeight: SIZES.touchMin,
  },
  btnConfirmarTxt: {
    color: C.blanco, fontSize: SIZES.txtSubtitulo, fontWeight: '900', letterSpacing: 1,
  },
  btnVolver: {
    borderWidth: 2, borderColor: C.bordeCard, borderRadius: SIZES.radiusMd,
    paddingVertical: 16, alignItems: 'center',
    minHeight: SIZES.touchSecondary, backgroundColor: C.tarjeta,
  },
  btnVolverTxt: { color: '#374151', fontSize: SIZES.txtBody, fontWeight: '800' },
});
