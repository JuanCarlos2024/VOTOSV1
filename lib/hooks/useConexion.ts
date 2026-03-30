import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useConexion() {
  const [conectado, setConectado] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setConectado(state.isConnected ?? true);
    });
    return () => unsub();
  }, []);

  return { conectado };
}
