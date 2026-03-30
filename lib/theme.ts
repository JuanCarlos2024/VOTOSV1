// Colores institucionales — Federación del Rodeo Chileno
// Tema claro: Blanco, Azul Oscuro #003087, Rojo #C8102E
export const C = {
  // Primarios
  rojo:    '#C8102E',
  azul:    '#003087',
  blanco:  '#FFFFFF',

  // Fondos
  fondo:    '#FFFFFF',   // fondo principal blanco
  tarjeta:  '#F5F5F5',   // cards gris muy claro
  tarjeta2: '#EBEBEB',   // cards secundarias

  // Textos
  txtPrimario:   '#003087',  // azul oscuro
  txtSecundario: '#666666',  // gris
  txtTercero:    '#999999',  // gris claro

  // Estados (para votos)
  verde:    '#16A34A',
  verdeBg:  '#F0FDF4',
  rojoBg:   '#FEF2F2',
  gris:     '#6B7280',
  grisBg:   '#F9FAFB',

  // Bordes
  borde:     '#E0E0E0',
  bordeCard: '#D0D0D0',
  bordeAzul: '#003087',
};

// ─── Tamaños — WCAG 2.2 touch targets ≥44px, texto ≥16px para adultos mayores
export const SIZES = {
  touchMin:       56,   // botones de acción principal
  touchSecondary: 48,   // botones secundarios

  txtTitulo:    28,
  txtSubtitulo: 22,
  txtBody:      18,
  txtCaption:   16,
  txtBadge:     13,

  radiusLg: 20,
  radiusMd: 14,
  radiusSm: 10,
};

// ─── Colores por opción de voto (alto contraste)
export const VOTO_COLORS: Record<string, {
  bg: string; border: string; text: string; icon: string; bgSolid: string;
}> = {
  Apruebo: {
    bg: '#ECFDF5', border: '#059669', text: '#065F46',
    icon: '✅', bgSolid: '#059669',
  },
  Rechazo: {
    bg: '#FEF2F2', border: '#DC2626', text: '#991B1B',
    icon: '❌', bgSolid: '#DC2626',
  },
  Abstengo: {
    bg: '#F3F4F6', border: '#9CA3AF', text: '#374151',
    icon: '⬜', bgSolid: '#6B7280',
  },
};

// ─── Sombras reutilizables
export const SHADOWS = {
  card: {
    shadowColor: '#0A1929',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardMd: {
    shadowColor: '#0A1929',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  cardAzul: {
    shadowColor: '#003087',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 5,
  },
};
