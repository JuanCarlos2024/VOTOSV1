import AsyncStorage from '@react-native-async-storage/async-storage';
import { Usuario } from './supabase';

const STORAGE_KEY = '@votosv1:usuario';

export async function guardarUsuario(usuario: Usuario): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
}

export async function obtenerUsuario(): Promise<Usuario | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? (JSON.parse(json) as Usuario) : null;
  } catch {
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
