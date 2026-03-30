import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

export const PENDING_KEY = '@votosv1:voto_pendiente';

export type VotoPendiente = {
  tipo: 'reglamento' | 'eleccion';
  pregunta_id: string;
  usuario_id: string;
  filas: any[];
};

/**
 * Detecta reconexión y reenvía automáticamente un voto pendiente guardado.
 * `onCargar` se llama tras enviar con éxito para refrescar la pantalla.
 */
export function useVotoPendiente(conectado: boolean, onCargar: () => void) {
  const [msgPendiente, setMsgPendiente] = useState('');
  const prevRef = useRef(true); // empieza "conectado"

  useEffect(() => {
    const estabaDesconectado = !prevRef.current;
    prevRef.current = conectado;
    if (estabaDesconectado && conectado) {
      intentarEnviar();
    }
  }, [conectado]);

  async function intentarEnviar() {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pendiente: VotoPendiente = JSON.parse(raw);

      // Verificar si la pregunta sigue activa
      const { data: preg } = await supabase
        .from('preguntas').select('estado').eq('id', pendiente.pregunta_id).single();

      if (!preg || preg.estado !== 'activa') {
        await AsyncStorage.removeItem(PENDING_KEY);
        setMsgPendiente('Lo sentimos — la votación fue cerrada antes de que pudieras reconectarte.');
        return;
      }

      const { error } = await supabase.from('votos').insert(pendiente.filas);
      if (!error) {
        await AsyncStorage.removeItem(PENDING_KEY);
        setMsgPendiente('✅ Tu voto fue registrado al recuperar la conexión.');
        onCargar();
      }
    } catch { /* ignorar — no es crítico */ }
  }

  return { msgPendiente, setMsgPendiente };
}
