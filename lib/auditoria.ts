import { Platform } from 'react-native';
import { supabase } from './supabase';

export type TipoAudit =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VOTO'
  | 'LIBERAR'
  | 'CERRAR'
  | 'RESET'
  | 'TIMEOUT';

export async function registrar(
  tipo: TipoAudit,
  nombre_usuario: string,
  detalle: string
): Promise<void> {
  try {
    await supabase.from('auditoria').insert({
      tipo,
      nombre_usuario,
      detalle,
      plataforma: Platform.OS,
    });
  } catch {
    // Fail silently — audit is non-critical
  }
}
