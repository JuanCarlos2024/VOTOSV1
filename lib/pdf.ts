import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import type { Pregunta, Usuario } from './supabase';

// ─────────────────────────────────────────────────────────────
//  Tipos compartidos con historial-presidente
// ─────────────────────────────────────────────────────────────
export type EntradaHistorial = {
  pregunta_id: string;
  pregunta_texto: string;
  pregunta_tipo: 'reglamento' | 'eleccion';
  pregunta_estado: string;
  pregunta_unanimidad?: boolean;
  fecha: string;
  respuestas: string[];
  candidatosNombres: string[];
  peso: number;
};

// ─────────────────────────────────────────────────────────────
//  Colores institucionales
// ─────────────────────────────────────────────────────────────
const AZUL  = '#003087';
const ROJO  = '#C8102E';
const VERDE = '#16A34A';

// ─────────────────────────────────────────────────────────────
//  Helpers de formato
// ─────────────────────────────────────────────────────────────
function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtCorto(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────
//  Exportar HTML como PDF — funciona en web y nativo
// ─────────────────────────────────────────────────────────────
async function exportarHTML(html: string, nombreArchivo: string): Promise<void> {
  if (Platform.OS === 'web') {
    // En web: abrir nueva pestaña con el HTML y disparar el diálogo de impresión
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  } else {
    // En nativo: generar archivo PDF y compartir
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  CSS base reutilizable en todos los documentos
// ─────────────────────────────────────────────────────────────
function cssBase(): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 20mm 15mm; }
  @page { @bottom-right { content: "Pág. " counter(page) " / " counter(pages); font-size: 10px; color: #9CA3AF; } }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #1F2937;
    line-height: 1.5;
  }
  .header {
    border-bottom: 3px solid ${ROJO};
    padding-bottom: 14px;
    margin-bottom: 18px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left h1 { font-size: 17px; font-weight: 900; color: ${AZUL}; }
  .header-left h2 { font-size: 12px; font-weight: 700; color: ${ROJO}; letter-spacing: 2px; margin-top: 3px; text-transform: uppercase; }
  .header-right { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.7; }
  .meta-box {
    background: #F8FAFC; border: 1px solid #E2E8F0;
    border-left: 4px solid ${AZUL}; border-radius: 6px;
    padding: 13px 16px; margin-bottom: 18px;
  }
  .meta-row { display: flex; gap: 8px; margin-bottom: 5px; align-items: flex-start; }
  .meta-label { font-size: 10px; font-weight: 800; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; min-width: 90px; margin-top: 2px; }
  .meta-valor { font-size: 13px; color: ${AZUL}; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 800; color: white; letter-spacing: 1px; }
  .badge-reglamento { background: #1E40AF; }
  .badge-eleccion   { background: #6D28D9; }
  .stats-grid { display: flex; gap: 10px; margin-bottom: 18px; }
  .stat-box { flex: 1; background: #F0F4FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 11px 14px; text-align: center; }
  .stat-num { font-size: 24px; font-weight: 900; color: ${AZUL}; line-height: 1.1; }
  .stat-label { font-size: 10px; font-weight: 700; color: #6B7280; letter-spacing: 1px; margin-top: 3px; }
  .stat-sub { font-size: 11px; color: #374151; margin-top: 2px; }
  .seccion {
    font-size: 11px; font-weight: 900; color: ${AZUL};
    letter-spacing: 2px; text-transform: uppercase;
    margin: 18px 0 8px 0; padding-bottom: 5px;
    border-bottom: 2px solid ${AZUL};
  }
  .nota {
    font-size: 12px; color: #374151; background: #FFF8E1;
    border-left: 3px solid #F59E0B; padding: 8px 12px;
    margin: 8px 0; border-radius: 4px;
  }
  .nota-sub { font-size: 11px; color: #6B7280; margin-bottom: 8px; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead tr { background: ${AZUL}; }
  th { padding: 8px 10px; color: white; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  tbody tr:nth-child(even) td { background: #F9FAFB; }
  .footer {
    margin-top: 28px; padding-top: 14px; border-top: 1px solid #E5E7EB;
    text-align: center; font-size: 10px; color: #9CA3AF; letter-spacing: 0.5px;
  }
  .footer strong { color: ${AZUL}; }
  /* Barra gráfica */
  .barra-fondo { background: #E5E7EB; border-radius: 4px; height: 14px; width: 100%; }
  .barra-relleno { height: 14px; border-radius: 4px; }
  .divider { border: none; border-top: 2px solid #E5E7EB; margin: 24px 0; }
  `;
}

// ─────────────────────────────────────────────────────────────
//  PDF Individual por Pregunta
// ─────────────────────────────────────────────────────────────
export async function exportarResultadosPDF(pregunta: Pregunta): Promise<void> {
  try {
    const html = await construirHTML(pregunta);
    await exportarHTML(html, `acta_votacion_${pregunta.id.slice(0, 8)}`);
  } catch (e: any) {
    console.error('Error al generar PDF:', e?.message ?? e);
  }
}

async function construirHTML(pregunta: Pregunta): Promise<string> {
  const fechaGeneracion = new Date().toLocaleString('es-CL', {
    dateStyle: 'long', timeStyle: 'short',
  });

  const [{ data: votos }, { data: usuarios }] = await Promise.all([
    supabase.from('votos').select('usuario_id, candidato_id, respuesta, peso').eq('pregunta_id', pregunta.id),
    supabase.from('usuarios').select('id, nombre_usuario, votos_disponibles').eq('rol', 'presidente').order('nombre_usuario'),
  ]);

  const listaVotos    = votos    ?? [];
  const listaUsuarios = usuarios ?? [];

  const totalAsociaciones  = listaUsuarios.length;
  const totalVotosPosibles = listaUsuarios.reduce((s: number, u: any) => s + (u.votos_disponibles ?? 1), 0);
  const asociacionesVotaron = new Set(listaVotos.map((v: any) => v.usuario_id)).size;
  const seenUids = new Set<string>();
  const totalVotosEmitidos = listaVotos.reduce((s: number, v: any) => {
    if (seenUids.has(v.usuario_id)) return s;
    seenUids.add(v.usuario_id);
    return s + (v.peso ?? 1);
  }, 0);
  const pctAsoc   = totalAsociaciones > 0 ? ((asociacionesVotaron / totalAsociaciones) * 100).toFixed(1) : '0.0';
  const pctVotos  = totalVotosPosibles > 0 ? ((totalVotosEmitidos / totalVotosPosibles) * 100).toFixed(1) : '0.0';

  let bloqueGrafico    = '';
  let bloqueResultados = '';
  let bloqueDetalle    = '';

  if (pregunta.tipo === 'reglamento') {
    const ag: Record<string, { peso: number; uids: Set<string> }> = {};
    for (const v of listaVotos) {
      if (!ag[v.respuesta]) ag[v.respuesta] = { peso: 0, uids: new Set() };
      ag[v.respuesta].peso += v.peso ?? 1;
      ag[v.respuesta].uids.add(v.usuario_id);
    }

    const opciones = [
      { op: 'Apruebo', color: VERDE,    bg: '#F0FDF4' },
      { op: 'Rechazo', color: ROJO,     bg: '#FEF2F2' },
      { op: 'Abstengo', color: '#6B7280', bg: '#F9FAFB' },
    ];
    const filas = opciones.map(o => ({
      ...o,
      peso: ag[o.op]?.peso ?? 0,
      asocs: ag[o.op]?.uids.size ?? 0,
    }));
    const ganador = filas.reduce((max, f) => f.peso > max.peso ? f : max, filas[0]);

    // Gráfico de barras CSS
    const maxPeso = Math.max(...filas.map(f => f.peso), 1);
    bloqueGrafico = `
      <h2 class="seccion">RESUMEN GRÁFICO</h2>
      <table style="margin-bottom:16px">
        <thead><tr><th style="width:22%">Opción</th><th>Distribución</th><th style="width:14%;text-align:center">Votos</th><th style="width:10%;text-align:center">%</th></tr></thead>
        <tbody>
          ${filas.map(f => {
            const pct = totalVotosEmitidos > 0 ? ((f.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0';
            const anchoBarra = maxPeso > 0 ? (f.peso / maxPeso) * 100 : 0;
            const esGanador  = f.op === ganador.op && ganador.peso > 0;
            return `<tr ${esGanador ? `style="background:${f.bg}"` : ''}>
              <td style="font-weight:800;color:${f.color}">${esGanador ? '🏆 ' : ''}${f.op.toUpperCase()}</td>
              <td style="padding:10px">
                <div class="barra-fondo">
                  <div class="barra-relleno" style="width:${anchoBarra}%;background:${f.color}"></div>
                </div>
              </td>
              <td style="text-align:center;font-weight:900;font-size:15px;color:${f.color}">${f.peso}</td>
              <td style="text-align:center;font-weight:700;color:${f.color}">${pct}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    bloqueResultados = `
      <h2 class="seccion">RESULTADOS DETALLADOS</h2>
      <table>
        <thead><tr><th>Opción</th><th style="text-align:center">Votos Ponderados</th><th style="text-align:center">Asociaciones</th><th style="text-align:center">%</th><th></th></tr></thead>
        <tbody>
          ${filas.map(f => {
            const pct = totalVotosEmitidos > 0 ? ((f.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0';
            const esGanador = f.op === ganador.op && ganador.peso > 0;
            return `<tr ${esGanador ? `style="background:${f.bg}"` : ''}>
              <td style="font-weight:700;color:${f.color}">${esGanador ? '🏆 ' : ''}${f.op.toUpperCase()}</td>
              <td style="text-align:center;font-weight:900;font-size:15px;color:${f.color}">${f.peso}</td>
              <td style="text-align:center">${f.asocs} asoc.</td>
              <td style="text-align:center;font-weight:700;color:${f.color}">${pct}%</td>
              <td style="text-align:center">${esGanador ? `<span style="background:${VERDE};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">GANADOR</span>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="nota">Resultado: <strong>${ganador.op.toUpperCase()}</strong> con <strong>${ganador.peso} votos</strong> (${totalVotosEmitidos > 0 ? ((ganador.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0'}%)</p>`;

    const filasDetalle = listaUsuarios.map((u: any) => {
      const voto = listaVotos.find((v: any) => v.usuario_id === u.id);
      const colorEstado   = voto ? VERDE : ROJO;
      const colorRespuesta = voto
        ? (voto.respuesta === 'Apruebo' ? VERDE : voto.respuesta === 'Rechazo' ? ROJO : '#6B7280')
        : '#9CA3AF';
      return `<tr>
        <td>${u.nombre_usuario}</td>
        <td style="text-align:center">${u.votos_disponibles ?? 1}</td>
        <td style="text-align:center;font-weight:700;color:${colorRespuesta}">${voto ? voto.respuesta : '—'}</td>
        <td style="text-align:center;font-weight:700;color:${colorEstado}">${voto ? 'Votó' : 'Pendiente'}</td>
      </tr>`;
    }).join('');

    bloqueDetalle = `
      <h2 class="seccion">DETALLE POR ASOCIACIÓN</h2>
      <table>
        <thead><tr><th>Asociación</th><th style="text-align:center">Peso</th><th style="text-align:center">Voto emitido</th><th style="text-align:center">Estado</th></tr></thead>
        <tbody>${filasDetalle}</tbody>
      </table>`;

  } else {
    // ── Elección ────────────────────────────────────────────
    const { data: cands } = await supabase.from('candidatos').select('id, nombre').eq('pregunta_id', pregunta.id);

    const ag: Record<string, { peso: number; uids: Set<string> }> = {};
    for (const v of listaVotos) {
      const key = v.candidato_id ?? v.respuesta;
      if (!ag[key]) ag[key] = { peso: 0, uids: new Set() };
      ag[key].peso += v.peso ?? 1;
      ag[key].uids.add(v.usuario_id);
    }

    const ranking = ((cands ?? []) as any[])
      .map(c => ({ nombre: c.nombre, peso: ag[c.id]?.peso ?? 0, asocs: ag[c.id]?.uids.size ?? 0 }))
      .sort((a, b) => b.peso - a.peso);

    const maxSel   = pregunta.max_selecciones ?? 1;
    const maxPeso  = Math.max(...ranking.map(r => r.peso), 1);
    const electos  = ranking.filter(c => c.peso > 0).slice(0, maxSel);

    bloqueGrafico = `
      <h2 class="seccion">RESUMEN GRÁFICO — RANKING</h2>
      <table style="margin-bottom:16px">
        <thead><tr><th style="width:8%">#</th><th style="width:30%">Candidato</th><th>Distribución</th><th style="width:14%;text-align:center">Votos</th><th style="width:10%;text-align:center">%</th></tr></thead>
        <tbody>
          ${ranking.map((c, i) => {
            const pct = totalVotosEmitidos > 0 ? ((c.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0';
            const anchoBarra = maxPeso > 0 ? (c.peso / maxPeso) * 100 : 0;
            const esElecto   = i < maxSel && c.peso > 0;
            const medalla    = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            return `<tr ${esElecto ? 'style="background:#EFF6FF"' : ''}>
              <td style="text-align:center">${medalla}</td>
              <td style="font-weight:${esElecto ? '800' : '400'};color:${esElecto ? AZUL : '#374151'}">${c.nombre}</td>
              <td style="padding:10px">
                <div class="barra-fondo">
                  <div class="barra-relleno" style="width:${anchoBarra}%;background:${esElecto ? AZUL : '#9CA3AF'}"></div>
                </div>
              </td>
              <td style="text-align:center;font-weight:900;font-size:14px;color:${esElecto ? AZUL : '#374151'}">${c.peso}</td>
              <td style="text-align:center;font-weight:700;color:${esElecto ? AZUL : '#9CA3AF'}">${pct}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    bloqueResultados = `
      <h2 class="seccion">CANDIDATOS ELECTOS</h2>
      <p class="nota">Se eligen los primeros <strong>${maxSel}</strong> candidato(s) con votos.</p>
      <table>
        <thead><tr><th>#</th><th>Candidato</th><th style="text-align:center">Votos Ponderados</th><th style="text-align:center">Asociaciones</th><th style="text-align:center">%</th><th></th></tr></thead>
        <tbody>
          ${ranking.map((c, i) => {
            const pct = totalVotosEmitidos > 0 ? ((c.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0';
            const esElecto = i < maxSel && c.peso > 0;
            const medalla  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            return `<tr ${esElecto ? 'style="background:#EFF6FF"' : ''}>
              <td style="text-align:center">${medalla}</td>
              <td style="font-weight:${esElecto ? '800' : '400'};color:${esElecto ? AZUL : '#374151'}">${c.nombre}</td>
              <td style="text-align:center;font-weight:900;font-size:14px;color:${esElecto ? AZUL : '#374151'}">${c.peso}</td>
              <td style="text-align:center">${c.asocs} asoc.</td>
              <td style="text-align:center;font-weight:700;color:${esElecto ? AZUL : '#9CA3AF'}">${pct}%</td>
              <td style="text-align:center">${esElecto ? `<span style="background:${AZUL};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">ELECTO</span>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="nota">Candidato(s) electo(s): <strong style="color:${AZUL}">${electos.map(e => e.nombre).join(', ') || '—'}</strong></p>`;

    const filasDetalle = listaUsuarios.map((u: any) => {
      const voto = listaVotos.find((v: any) => v.usuario_id === u.id);
      const colorEstado = voto ? VERDE : ROJO;
      return `<tr>
        <td>${u.nombre_usuario}</td>
        <td style="text-align:center">${u.votos_disponibles ?? 1}</td>
        <td style="text-align:center;font-weight:700;color:${colorEstado}">${voto ? 'Votó' : 'Pendiente'}</td>
      </tr>`;
    }).join('');

    bloqueDetalle = `
      <h2 class="seccion">REGISTRO DE PARTICIPACIÓN</h2>
      <p class="nota-sub">El voto de elección es confidencial; solo se indica si la asociación participó.</p>
      <table>
        <thead><tr><th>Asociación</th><th style="text-align:center">Peso</th><th style="text-align:center">Estado</th></tr></thead>
        <tbody>${filasDetalle}</tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>${cssBase()}</style>
</head><body>

<!-- ENCABEZADO -->
<div class="header">
  <div class="header-left">
    <h1>Federación del Rodeo Chileno</h1>
    <h2>Acta de Votación</h2>
  </div>
  <div class="header-right">
    <div>Generado el ${fechaGeneracion}</div>
  </div>
</div>

<!-- META INFO -->
<div class="meta-box">
  <div class="meta-row">
    <span class="meta-label">Tipo</span>
    <span><span class="badge badge-${pregunta.tipo}">${pregunta.tipo.toUpperCase()}</span></span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Pregunta</span>
    <span class="meta-valor" style="font-size:14px;font-weight:900">${pregunta.texto}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Apertura</span>
    <span class="meta-valor">${fmt(pregunta.fecha_apertura)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Cierre</span>
    <span class="meta-valor">${fmt(pregunta.fecha_cierre)}</span>
  </div>
  ${pregunta.tipo === 'eleccion' ? `
  <div class="meta-row">
    <span class="meta-label">Max. electos</span>
    <span class="meta-valor">${pregunta.max_selecciones ?? 1} candidato(s)</span>
  </div>` : ''}
</div>

<!-- RESUMEN ESTADÍSTICO -->
<h2 class="seccion">RESUMEN ESTADÍSTICO</h2>
<div class="stats-grid">
  <div class="stat-box">
    <div class="stat-num">${asociacionesVotaron} / ${totalAsociaciones}</div>
    <div class="stat-label">Asociaciones</div>
    <div class="stat-sub">${pctAsoc}% participación</div>
  </div>
  <div class="stat-box">
    <div class="stat-num">${totalVotosEmitidos} / ${totalVotosPosibles}</div>
    <div class="stat-label">Votos emitidos</div>
    <div class="stat-sub">${pctVotos}% del total posible</div>
  </div>
  <div class="stat-box">
    <div class="stat-num" style="color:${parseFloat(pctVotos) >= 50 ? VERDE : ROJO}">${pctVotos}%</div>
    <div class="stat-label">Participación</div>
    <div class="stat-sub">${parseFloat(pctVotos) >= 66.67 ? 'Quórum alcanzado' : parseFloat(pctVotos) >= 50 ? 'Mayoría simple' : 'Sin quórum'}</div>
  </div>
</div>

<!-- GRÁFICO -->
${bloqueGrafico}

<!-- RESULTADOS -->
${bloqueResultados}

<!-- DETALLE -->
${bloqueDetalle}

<!-- PIE -->
<div class="footer">
  <p>Documento generado automáticamente por el <strong>Sistema de Votos</strong> — Federación del Rodeo Chileno</p>
  <p style="margin-top:4px">Generado el ${fechaGeneracion} · Este documento es de carácter oficial</p>
</div>

</body></html>`;
}

// ─────────────────────────────────────────────────────────────
//  PDF Resumen General (todas las preguntas cerradas)
// ─────────────────────────────────────────────────────────────
export async function exportarResumenGeneralPDF(): Promise<void> {
  try {
    const html = await construirHTMLResumenGeneral();
    await exportarHTML(html, 'resumen_general_votaciones');
  } catch (e: any) {
    console.error('Error al generar resumen general:', e?.message ?? e);
  }
}

async function construirHTMLResumenGeneral(): Promise<string> {
  const fechaGeneracion = new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });

  const { data: preguntas } = await supabase
    .from('preguntas')
    .select('*')
    .eq('estado', 'cerrada')
    .order('created_at', { ascending: true });

  const lista = (preguntas ?? []) as Pregunta[];
  if (lista.length === 0) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>${cssBase()}</style></head><body>
      <div class="header"><div class="header-left"><h1>Federación del Rodeo Chileno</h1><h2>Resumen General de Votaciones</h2></div><div class="header-right">Generado el ${fechaGeneracion}</div></div>
      <p style="text-align:center;color:#6B7280;padding:40px">No hay votaciones cerradas.</p>
      </body></html>`;
  }

  // Obtener todos los votos y usuarios en una sola consulta
  const [{ data: todosVotos }, { data: usuarios }] = await Promise.all([
    supabase.from('votos').select('pregunta_id, usuario_id, candidato_id, respuesta, peso'),
    supabase.from('usuarios').select('id, votos_disponibles').eq('rol', 'presidente'),
  ]);

  const votosPorPregunta: Record<string, any[]> = {};
  for (const v of todosVotos ?? []) {
    if (!votosPorPregunta[v.pregunta_id]) votosPorPregunta[v.pregunta_id] = [];
    votosPorPregunta[v.pregunta_id].push(v);
  }
  const pesoTotal = (usuarios ?? []).reduce((s: number, u: any) => s + (u.votos_disponibles ?? 1), 0);

  let seccionesHTML = '';

  for (let idx = 0; idx < lista.length; idx++) {
    const p    = lista[idx];
    const vs   = votosPorPregunta[p.id] ?? [];
    const num  = idx + 1;

    if (p.tipo === 'reglamento') {
      const ag: Record<string, number> = {};
      for (const v of vs) ag[v.respuesta] = (ag[v.respuesta] ?? 0) + (v.peso ?? 1);

      const opciones = [
        { op: 'Apruebo', color: VERDE },
        { op: 'Rechazo', color: ROJO },
        { op: 'Abstengo', color: '#6B7280' },
      ];
      const filas = opciones.map(o => ({ ...o, peso: ag[o.op] ?? 0 }));
      const totalEmit = filas.reduce((s, f) => s + f.peso, 0);
      const ganador   = filas.reduce((mx, f) => f.peso > mx.peso ? f : mx, filas[0]);
      const maxPeso   = Math.max(...filas.map(f => f.peso), 1);

      seccionesHTML += `
        ${idx > 0 ? '<hr class="divider"/>' : ''}
        <div style="margin-bottom:8px">
          <span style="font-size:11px;color:#6B7280;font-weight:800;letter-spacing:1px">VOTACIÓN #${num} · REGLAMENTO${p.unanimidad ? ' · UNANIMIDAD ✅' : ''}</span>
        </div>
        <p style="font-size:15px;font-weight:900;color:#111827;margin-bottom:10px;line-height:1.4">${p.texto}</p>
        <div style="display:flex;gap:20px;margin-bottom:10px;font-size:11px;color:#6B7280">
          <span>📅 Apertura: <strong style="color:#374151">${fmtCorto(p.fecha_apertura)}</strong></span>
          <span>🔒 Cierre: <strong style="color:#374151">${fmtCorto(p.fecha_cierre)}</strong></span>
        </div>
        ${p.unanimidad ? `<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#14532D;font-weight:700">✅ Aprobado por unanimidad</div>` : ''}
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:2px 0;margin-bottom:12px">
          <table>
            <thead><tr><th style="width:22%">Opción</th><th>Distribución</th><th style="width:14%;text-align:center">Votos</th><th style="width:10%;text-align:center">%</th></tr></thead>
            <tbody>
              ${filas.map(f => {
                const pct = totalEmit > 0 ? ((f.peso / totalEmit) * 100).toFixed(1) : '0.0';
                const ancho = maxPeso > 0 ? (f.peso / maxPeso) * 100 : 0;
                const esGan = f.op === ganador.op && ganador.peso > 0;
                return `<tr>
                  <td style="font-weight:${esGan ? '900' : '700'};color:${f.color}">${esGan ? '🏆 ' : ''}${f.op.toUpperCase()}</td>
                  <td style="padding:8px"><div class="barra-fondo"><div class="barra-relleno" style="width:${ancho}%;background:${f.color}"></div></div></td>
                  <td style="text-align:center;font-weight:900;color:${f.color}">${f.peso}</td>
                  <td style="text-align:center;font-weight:700;color:${f.color}">${pct}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:12px;color:#374151">
          Resultado: <strong style="color:${ganador.color}">${ganador.op.toUpperCase()}</strong> —
          ${totalEmit} votos emitidos de ${pesoTotal} posibles
          (${pesoTotal > 0 ? ((totalEmit / pesoTotal) * 100).toFixed(1) : '0.0'}% participación)
        </p>`;

    } else {
      // Elección
      const { data: cands } = await supabase.from('candidatos').select('id, nombre').eq('pregunta_id', p.id);
      const ag: Record<string, number> = {};
      for (const v of vs) ag[v.candidato_id ?? v.respuesta] = (ag[v.candidato_id ?? v.respuesta] ?? 0) + (v.peso ?? 1);

      const ranking = ((cands ?? []) as any[])
        .map(c => ({ nombre: c.nombre, peso: ag[c.id] ?? 0 }))
        .sort((a, b) => b.peso - a.peso);

      const maxSel    = p.max_selecciones ?? 1;
      const totalEmit = [...new Set(vs.map((v: any) => v.usuario_id))].length;
      const maxPeso   = Math.max(...ranking.map(r => r.peso), 1);

      seccionesHTML += `
        ${idx > 0 ? '<hr class="divider"/>' : ''}
        <div style="margin-bottom:8px">
          <span style="font-size:11px;color:#6B7280;font-weight:800;letter-spacing:1px">VOTACIÓN #${num} · ELECCIÓN</span>
        </div>
        <p style="font-size:15px;font-weight:900;color:#111827;margin-bottom:10px;line-height:1.4">${p.texto}</p>
        <div style="display:flex;gap:20px;margin-bottom:10px;font-size:11px;color:#6B7280">
          <span>📅 Apertura: <strong style="color:#374151">${fmtCorto(p.fecha_apertura)}</strong></span>
          <span>🔒 Cierre: <strong style="color:#374151">${fmtCorto(p.fecha_cierre)}</strong></span>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:2px 0;margin-bottom:12px">
          <table>
            <thead><tr><th style="width:8%">#</th><th style="width:30%">Candidato</th><th>Distribución</th><th style="width:14%;text-align:center">Votos</th><th></th></tr></thead>
            <tbody>
              ${ranking.map((c, i) => {
                const esElecto = i < maxSel && c.peso > 0;
                const medalla  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                const ancho    = maxPeso > 0 ? (c.peso / maxPeso) * 100 : 0;
                return `<tr ${esElecto ? 'style="background:#EFF6FF"' : ''}>
                  <td style="text-align:center">${medalla}</td>
                  <td style="font-weight:${esElecto ? '800' : '400'};color:${esElecto ? AZUL : '#374151'}">${c.nombre}</td>
                  <td style="padding:8px"><div class="barra-fondo"><div class="barra-relleno" style="width:${ancho}%;background:${esElecto ? AZUL : '#9CA3AF'}"></div></div></td>
                  <td style="text-align:center;font-weight:900;color:${esElecto ? AZUL : '#374151'}">${c.peso}</td>
                  <td style="text-align:center">${esElecto ? `<span style="background:${AZUL};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">ELECTO</span>` : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:12px;color:#374151">${totalEmit} asociaciones participaron · Se eligieron ${maxSel} candidato(s)</p>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>${cssBase()}</style>
</head><body>

<div class="header">
  <div class="header-left">
    <h1>Federación del Rodeo Chileno</h1>
    <h2>Resumen General de Votaciones</h2>
  </div>
  <div class="header-right">
    <div>Generado el ${fechaGeneracion}</div>
    <div style="margin-top:3px">${lista.length} votación${lista.length !== 1 ? 'es' : ''} cerrada${lista.length !== 1 ? 's' : ''}</div>
  </div>
</div>

${seccionesHTML}

<div class="footer">
  <p>Documento generado automáticamente por el <strong>Sistema de Votos</strong> — Federación del Rodeo Chileno</p>
  <p style="margin-top:4px">Generado el ${fechaGeneracion} · Este documento es de carácter oficial</p>
</div>

</body></html>`;
}

// ─────────────────────────────────────────────────────────────
//  PDF Historial del Presidente (sin cambios funcionales)
// ─────────────────────────────────────────────────────────────
export async function exportarHistorialPresidentePDF(
  usuario: Usuario,
  historial: EntradaHistorial[]
): Promise<void> {
  try {
    const html = construirHTMLHistorial(usuario, historial);
    await exportarHTML(html, `historial_${usuario.id_usuario}`);
  } catch (e: any) {
    console.error('Error al generar historial PDF:', e?.message ?? e);
  }
}

function construirHTMLHistorial(usuario: Usuario, historial: EntradaHistorial[]): string {
  const fechaHora = new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });

  const COLOR_REG: Record<string, string> = {
    Apruebo: VERDE, Rechazo: ROJO, Abstengo: '#6B7280',
  };

  const filas = historial.map((entrada, idx) => {
    const esReg = entrada.pregunta_tipo === 'reglamento';
    const colorResp = esReg ? (COLOR_REG[entrada.respuestas[0]] ?? '#374151') : AZUL;

    const respuestaHTML = esReg
      ? `<span style="font-weight:800;color:${colorResp};font-size:14px">${(entrada.respuestas[0] ?? '').toUpperCase()}</span>`
      : entrada.candidatosNombres.length > 0
        ? entrada.candidatosNombres.map(n =>
            `<span style="display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:2px 10px;margin:2px;font-size:12px;color:${AZUL};font-weight:700">${n}</span>`
          ).join(' ')
        : `<span style="color:#9CA3AF">${entrada.respuestas.length} candidato(s)</span>`;

    const estadoColor = entrada.pregunta_estado === 'activa' ? VERDE
      : entrada.pregunta_estado === 'cerrada' ? '#6B7280' : '#D97706';
    const tipoColor = entrada.pregunta_tipo === 'eleccion' ? '#6D28D9' : '#1E40AF';
    const fechaVoto = new Date(entrada.fecha).toLocaleDateString('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ' ' + new Date(entrada.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr style="${idx % 2 === 0 ? 'background:#FAFAFA' : ''}">
        <td style="padding:12px 14px;vertical-align:top;width:42%">
          <div style="font-weight:700;font-size:13px;color:#1F2937;line-height:1.4;margin-bottom:6px">${entrada.pregunta_texto}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span style="background:${tipoColor};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;letter-spacing:1px">${entrada.pregunta_tipo.toUpperCase()}</span>
            <span style="background:${estadoColor};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;letter-spacing:1px">${entrada.pregunta_estado.toUpperCase()}</span>
          </div>
        </td>
        <td style="padding:12px 14px;vertical-align:top;width:30%">${respuestaHTML}</td>
        <td style="padding:12px 14px;vertical-align:top;text-align:center;width:14%">
          <span style="font-weight:800;font-size:16px;color:${AZUL}">${entrada.peso}</span>
          <div style="font-size:10px;color:#9CA3AF">votos</div>
        </td>
        <td style="padding:12px 14px;vertical-align:top;font-size:11px;color:#6B7280;width:14%">${fechaVoto}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<style>${cssBase()}
  .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid ${AZUL}; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 40px; }
  .info-label { font-size: 10px; font-weight: 800; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; }
  .info-valor { font-size: 15px; font-weight: 800; color: ${AZUL}; margin-top: 2px; }
</style>
</head><body>

<div class="header">
  <h1>Federación del Rodeo Chileno</h1>
  <h2>Historial de Votaciones</h2>
</div>

<div class="info-box">
  <div><div class="info-label">Asociación</div><div class="info-valor">${usuario.nombre_usuario}</div></div>
  <div><div class="info-label">ID</div><div class="info-valor">${usuario.id_usuario}</div></div>
  <div><div class="info-label">Peso de voto</div><div class="info-valor">${usuario.votos_disponibles}</div></div>
  <div><div class="info-label">Exportado</div><div class="info-valor" style="font-size:12px">${fechaHora}</div></div>
</div>

<h2 class="seccion">Registro de Participación (${historial.length} votación${historial.length !== 1 ? 'es' : ''})</h2>
<table>
  <thead><tr><th>Pregunta / Votación</th><th>Respuesta emitida</th><th style="text-align:center">Peso</th><th>Fecha</th></tr></thead>
  <tbody>${filas}</tbody>
</table>

<div class="footer">
  <p>Documento generado automáticamente por el <strong>Sistema de Votos</strong> — Federación del Rodeo Chileno</p>
  <p style="margin-top:4px">Generado el ${fechaHora} · Este documento es de carácter oficial</p>
</div>

</body></html>`;
}
