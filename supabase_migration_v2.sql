-- ============================================================
-- VOTOSV1 — Migración v2
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columna peso a votos
ALTER TABLE public.votos ADD COLUMN IF NOT EXISTS peso int DEFAULT 1;

-- 2. Eliminar el unique constraint original (solo (pregunta_id, usuario_id))
--    para permitir múltiples votos en elecciones (uno por candidato)
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_pregunta_id_usuario_id_key;

-- 3. Nuevo unique: (pregunta_id, usuario_id, respuesta)
--    Previene votar dos veces por el mismo candidato / misma opción
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'votos_unique_respuesta'
  ) THEN
    ALTER TABLE public.votos
      ADD CONSTRAINT votos_unique_respuesta
      UNIQUE (pregunta_id, usuario_id, respuesta);
  END IF;
END $$;

-- 4. Habilitar Realtime para la tabla votos
ALTER PUBLICATION supabase_realtime ADD TABLE public.votos;

-- 5. Política para update (por si acaso)
DROP POLICY IF EXISTS "Update votos" ON public.votos;

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'votos' ORDER BY ordinal_position;
