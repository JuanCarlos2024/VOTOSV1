import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jtmlrqcncgjhaghuecog.supabase.co';
const SUPABASE_KEY = 'sb_publishable_m1rCJKaW8noIw8kEVC3bEQ_YPGKQY5e';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Usuario = {
  id: string;
  nombre_usuario: string;
  id_usuario: string;
  contrasena: string;
  votos_disponibles: number;
  rol: 'administrador' | 'presidente';
};

export type Pregunta = {
  id: string;
  texto: string;
  tipo: 'reglamento' | 'eleccion';
  estado: 'borrador' | 'activa' | 'cerrada';
  max_selecciones: number;
  created_at: string;
};

export type Candidato = {
  id: string;
  pregunta_id: string;
  nombre: string;
  imagen_url: string | null;
};

export type Voto = {
  id: string;
  pregunta_id: string;
  usuario_id: string;
  respuesta: string;
  peso: number;
  created_at: string;
};
