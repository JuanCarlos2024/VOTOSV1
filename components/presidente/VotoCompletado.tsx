import { View, Text, StyleSheet } from 'react-native';
import { C, SIZES, VOTO_COLORS } from '../../lib/theme';

type Props = {
  opcionConfirmada: string;
  contador: number;
};

export default function VotoCompletado({ opcionConfirmada, contador }: Props) {
  const esElec = opcionConfirmada === 'eleccion';
  const col = esElec
    ? { border: '#22C55E', text: '#22C55E', bgSolid: '#16A34A', icon: '🗳' }
    : (VOTO_COLORS[opcionConfirmada]
        ? {
            border: VOTO_COLORS[opcionConfirmada].border,
            text: VOTO_COLORS[opcionConfirmada].text,
            bgSolid: VOTO_COLORS[opcionConfirmada].bgSolid,
            icon: VOTO_COLORS[opcionConfirmada].icon,
          }
        : { border: '#22C55E', text: '#22C55E', bgSolid: '#16A34A', icon: '✅' });

  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderColor: col.border }]}>
        <Text style={styles.icono}>✅</Text>
        <Text style={[styles.titulo, { color: col.text }]}>
          ¡VOTO REGISTRADO CON ÉXITO!
        </Text>

        {!esElec && (
          <View style={[styles.opcionBox, { borderColor: col.border }]}>
            <Text style={styles.opcionIcono}>{col.icon}</Text>
            <Text style={[styles.opcionTxt, { color: col.text }]}>
              {opcionConfirmada.toUpperCase()}
            </Text>
          </View>
        )}

        {esElec && (
          <Text style={styles.secreto}>Tu voto fue registrado de forma confidencial.</Text>
        )}

        <Text style={styles.contador}>
          Cerrando en {contador} segundo{contador !== 1 ? 's' : ''}...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 20 },
  card: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: SIZES.radiusLg, padding: 32, borderWidth: 3,
    backgroundColor: C.fondo, gap: 20,
  },
  icono: { fontSize: 110 },
  titulo: {
    fontSize: SIZES.txtSubtitulo + 2, fontWeight: '900',
    textAlign: 'center', letterSpacing: 1,
  },
  opcionBox: {
    width: '100%', backgroundColor: C.blanco, borderRadius: SIZES.radiusMd,
    padding: 24, alignItems: 'center', borderWidth: 2,
    flexDirection: 'row', justifyContent: 'center', gap: 16,
  },
  opcionIcono: { fontSize: 40 },
  opcionTxt: { fontSize: 36, fontWeight: '900' },
  secreto: {
    fontSize: SIZES.txtBody, color: C.txtSecundario,
    textAlign: 'center', lineHeight: 26,
  },
  contador: {
    fontSize: SIZES.txtCaption, color: C.txtTercero, fontStyle: 'italic',
  },
});
