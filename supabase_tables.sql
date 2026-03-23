-- ============================================================
-- VOTOSV1 - Script de creación de tablas en Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ⚠️ Si ya tienes las tablas creadas, ejecuta solo esto:
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS max_selecciones int DEFAULT 1;
-- Luego puedes ignorar el resto o ejecutarlo todo si es instalación nueva.


-- 1. TABLA: usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_usuario  TEXT NOT NULL,
  id_usuario  TEXT UNIQUE NOT NULL,
  contrasena  TEXT NOT NULL,
  votos_disponibles INTEGER DEFAULT 1,
  rol         TEXT NOT NULL CHECK (rol IN ('administrador', 'presidente'))
);

-- 2. TABLA: preguntas
CREATE TABLE IF NOT EXISTS public.preguntas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  texto      TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('reglamento', 'eleccion')),
  estado     TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'activa', 'cerrada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: candidatos
CREATE TABLE IF NOT EXISTS public.candidatos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pregunta_id UUID NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  imagen_url  TEXT
);

-- 4. TABLA: votos
CREATE TABLE IF NOT EXISTS public.votos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pregunta_id UUID NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  respuesta   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pregunta_id, usuario_id)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos       ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso público anónimo (para autenticación personalizada)
CREATE POLICY "Lectura pública usuarios"    ON public.usuarios    FOR SELECT USING (true);
CREATE POLICY "Lectura pública preguntas"   ON public.preguntas   FOR SELECT USING (true);
CREATE POLICY "Lectura pública candidatos"  ON public.candidatos  FOR SELECT USING (true);
CREATE POLICY "Lectura pública votos"       ON public.votos       FOR SELECT USING (true);

CREATE POLICY "Insertar votos"      ON public.votos       FOR INSERT WITH CHECK (true);
CREATE POLICY "Insertar candidatos" ON public.candidatos  FOR INSERT WITH CHECK (true);
CREATE POLICY "Insertar preguntas"  ON public.preguntas   FOR INSERT WITH CHECK (true);
CREATE POLICY "Insertar usuarios"   ON public.usuarios    FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualizar preguntas" ON public.preguntas  FOR UPDATE USING (true);
CREATE POLICY "Actualizar usuarios"  ON public.usuarios   FOR UPDATE USING (true);

-- ============================================================
-- Datos de prueba (opcional)
-- ============================================================

-- Insertar un usuario administrador de prueba
INSERT INTO public.usuarios (nombre_usuario, id_usuario, contrasena, votos_disponibles, rol)
VALUES ('Administrador', 'admin01', 'admin123', 0, 'administrador')
ON CONFLICT (id_usuario) DO NOTHING;

-- Insertar un usuario presidente de prueba
INSERT INTO public.usuarios (nombre_usuario, id_usuario, contrasena, votos_disponibles, rol)
VALUES ('Presidente Uno', 'pres01', 'pres123', 1, 'presidente')
ON CONFLICT (id_usuario) DO NOTHING;
