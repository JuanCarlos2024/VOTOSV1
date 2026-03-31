import { Platform } from 'react-native';
import { supabase } from './supabase';

export type TipoAudit =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VOTO'
  | 'PROYECTAR'
  | 'LIBERAR'
  | 'CERRAR'
  | 'RESET'
  | 'TIMEOUT'
  | 'UNANIMIDAD'
  | 'EDITAR'
  | 'CREAR_USUARIO'
  | 'EDITAR_USUARIO'
  | 'DESACTIVAR_USUARIO'
  | 'ACTIVAR_USUARIO';

export type AuditoriaExtra = {
  usuario_id?: string;
  asociacion_nombre?: string;
  pregunta_id?: string;
  pregunta_texto?: string;
};

export async function registrar(
  accion: TipoAudit,
  nombre_usuario: string,
  detalle: string,
  extra?: AuditoriaExtra
): Promise<void> {
  try {
    const dispositivo = Platform.OS === 'web'
      ? (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'web')
      : Platform.OS;

    await supabase.from('auditoria').insert({
      accion,
      nombre_usuario,
      detalle,
      dispositivo,
      fecha: new Date().toISOString(),
      usuario_id:        extra?.usuario_id        ?? null,
      asociacion_nombre: extra?.asociacion_nombre ?? null,
      pregunta_id:       extra?.pregunta_id       ?? null,
      pregunta_texto:    extra?.pregunta_texto     ?? null,
    });
  } catch {
    // Fail silently — audit is non-critical
  }
}
