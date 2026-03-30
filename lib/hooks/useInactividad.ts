import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { cerrarSesion } from '../auth';
import { registrar } from '../auditoria';
import type { Usuario } from '../supabase';

const WARN_MS   = 8 * 60 * 1000;   // 8 min → aviso
const LOGOUT_MS = 10 * 60 * 1000;  // 10 min → cierre

export function useInactividad(usuarioRef: React.MutableRefObject<Usuario | null>) {
  const [modalWarning, setModalWarning] = useState(false);
  const warnRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetInactividad() {
    if (warnRef.current)   clearTimeout(warnRef.current);
    if (logoutRef.current) clearTimeout(logoutRef.current);
    setModalWarning(false);

    warnRef.current = setTimeout(() => setModalWarning(true), WARN_MS);

    logoutRef.current = setTimeout(async () => {
      const u = usuarioRef.current;
      if (u) await registrar('TIMEOUT', u.nombre_usuario, 'Sesión cerrada por inactividad');
      await cerrarSesion();
      router.replace('/');
    }, LOGOUT_MS);
  }

  function limpiarTimers() {
    if (warnRef.current)   clearTimeout(warnRef.current);
    if (logoutRef.current) clearTimeout(logoutRef.current);
  }

  return { modalWarning, setModalWarning, resetInactividad, limpiarTimers };
}
