import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
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
//  Colores institucionales del acta
// ─────────────────────────────────────────────────────────────
const AZUL  = '#003087';
const ROJO  = '#C8102E';
const VERDE = '#16A34A';

// ─────────────────────────────────────────────────────────────
//  Punto de entrada: genera el PDF y lo comparte
// ─────────────────────────────────────────────────────────────
export async function exportarResultadosPDF(pregunta: Pregunta): Promise<void> {
  try {
    const html = await construirHTML(pregunta);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
    } else {
      Alert.alert('PDF generado', `Guardado en:\n${uri}`);
    }
  } catch (e: any) {
    Alert.alert('Error', `No se pudo generar el PDF.\n${e?.message ?? ''}`);
  }
}

// ─────────────────────────────────────────────────────────────
//  Construye el HTML completo del acta
// ─────────────────────────────────────────────────────────────
async function construirHTML(pregunta: Pregunta): Promise<string> {
  const fechaHora = new Date().toLocaleString('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // ── Datos base ────────────────────────────────────────────
  const [{ data: votos }, { data: usuarios }] = await Promise.all([
    supabase
      .from('votos')
      .select('usuario_id, candidato_id, respuesta, peso')
      .eq('pregunta_id', pregunta.id),
    supabase
      .from('usuarios')
      .select('id, nombre_usuario, votos_disponibles')
      .eq('rol', 'presidente')
      .order('nombre_usuario'),
  ]);

  const listaVotos    = votos    ?? [];
  const listaUsuarios = usuarios ?? [];

  // ── Estadísticas de participación ────────────────────────
  const totalAsociaciones = listaUsuarios.length;
  const totalVotosPosibles = listaUsuarios.reduce(
    (s: number, u: any) => s + (u.votos_disponibles ?? 1), 0
  );
  const asociacionesVotaron = new Set(listaVotos.map((v: any) => v.usuario_id)).size;
  // Deduplicate by user so multiple election rows (one per candidate) don't inflate the total
  const seenUids = new Set<string>();
  const totalVotosEmitidos = listaVotos.reduce((s: number, v: any) => {
    if (seenUids.has(v.usuario_id)) return s;
    seenUids.add(v.usuario_id);
    return s + (v.peso ?? 1);
  }, 0);
  const pctAsoc = totalAsociaciones > 0
    ? ((asociacionesVotaron / totalAsociaciones) * 100).toFixed(1)
    : '0.0';
  const pctVotos = totalVotosPosibles > 0
    ? ((totalVotosEmitidos / totalVotosPosibles) * 100).toFixed(1)
    : '0.0';

  // ── Bloque de resultados (varía por tipo) ─────────────────
  let bloqueResultados = '';
  let bloqueDetalle    = '';

  if (pregunta.tipo === 'reglamento') {
    // Agrupar votos por opción
    const ag: Record<string, { peso: number; uids: Set<string> }> = {};
    for (const v of listaVotos) {
      if (!ag[v.respuesta]) ag[v.respuesta] = { peso: 0, uids: new Set() };
      ag[v.respuesta].peso += v.peso ?? 1;
      ag[v.respuesta].uids.add(v.usuario_id);
    }

    const opciones = ['Apruebo', 'Rechazo', 'Abstengo'];
    const filas = opciones.map(op => ({
      op,
      peso: ag[op]?.peso ?? 0,
      asocs: ag[op]?.uids.size ?? 0,
    }));
    const ganador = filas.reduce((max, f) => f.peso > max.peso ? f : max, filas[0]);

    const filasHTML = filas.map(f => {
      const pct = totalVotosEmitidos > 0
        ? ((f.peso / totalVotosEmitidos) * 100).toFixed(1)
        : '0.0';
      const esGanador = f.op === ganador.op && ganador.peso > 0;
      const colorOp   = f.op === 'Apruebo' ? VERDE : f.op === 'Rechazo' ? ROJO : '#6B7280';
      return `
        <tr ${esGanador ? `style="background:#f0fdf4"` : ''}>
          <td style="font-weight:700;color:${colorOp};padding:10px 12px">
            ${esGanador ? '🏆 ' : ''}${f.op.toUpperCase()}
          </td>
          <td style="text-align:center;font-weight:800;font-size:16px;color:${colorOp}">${f.peso}</td>
          <td style="text-align:center">${f.asocs} asoc.</td>
          <td style="text-align:center;font-weight:700;color:${colorOp}">${pct}%</td>
          <td style="text-align:center">
            ${esGanador
              ? `<span style="background:${VERDE};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800">GANADOR</span>`
              : ''}
          </td>
        </tr>`;
    }).join('');

    bloqueResultados = `
      <h2 class="seccion">RESULTADOS DE LA VOTACIÓN</h2>
      <table>
        <thead><tr>
          <th>Opción</th><th>Votos Ponderados</th><th>Asociaciones</th><th>%</th><th></th>
        </tr></thead>
        <tbody>${filasHTML}</tbody>
      </table>
      <p class="nota">
        Resultado: <strong>${ganador.op.toUpperCase()}</strong> con
        <strong>${ganador.peso} votos</strong>
        (${totalVotosEmitidos > 0 ? ((ganador.peso / totalVotosEmitidos) * 100).toFixed(1) : '0.0'}%)
      </p>`;

    // Detalle por asociación
    const filasDetalle = listaUsuarios.map((u: any) => {
      const voto = listaVotos.find((v: any) => v.usuario_id === u.id);
      const colorEstado = voto ? VERDE : ROJO;
      const colorRespuesta = voto
        ? (voto.respuesta === 'Apruebo' ? VERDE : voto.respuesta === 'Rechazo' ? ROJO : '#6B7280')
        : '#9CA3AF';
      return `
        <tr>
          <td style="padding:8px 12px">${u.nombre_usuario}</td>
          <td style="text-align:center">${u.votos_disponibles ?? 1}</td>
          <td style="text-align:center;font-weight:700;color:${colorRespuesta}">
            ${voto ? voto.respuesta : '—'}
          </td>
          <td style="text-align:center;font-weight:700;color:${colorEstado}">
            ${voto ? 'Votó' : 'Pendiente'}
          </td>
        </tr>`;
    }).join('');

    bloqueDetalle = `
      <h2 class="seccion">DETALLE POR ASOCIACIÓN</h2>
      <table>
        <thead><tr>
          <th>Asociación</th><th>Peso</th><th>Voto emitido</th><th>Estado</th>
        </tr></thead>
        <tbody>${filasDetalle}</tbody>
      </table>`;

  } else {
    // ── Elección ────────────────────────────────────────────
    const { data: cands } = await supabase
      .from('candidatos')
      .select('id, nombre')
      .eq('pregunta_id', pregunta.id);

    const ag: Record<string, { peso: number; uids: Set<string> }> = {};
    for (const v of listaVotos) {
      const key = v.candidato_id ?? v.respuesta;
      if (!ag[key]) ag[key] = { peso: 0, uids: new Set() };
      ag[key].peso += v.peso ?? 1;
      ag[key].uids.add(v.usuario_id);
    }

    const ranking = ((cands ?? []) as any[])
      .map(c => ({
        nombre: c.nombre,
        peso: ag[c.id]?.peso ?? 0,
        asocs: ag[c.id]?.uids.size ?? 0,
      }))
      .sort((a, b) => b.peso - a.peso);

    const maxSel = pregunta.max_selecciones ?? 1;
    const electos = ranking.filter(c => c.peso > 0).slice(0, maxSel);

    const filasHTML = ranking.map((c, i) => {
      const pct = totalVotosEmitidos > 0
        ? ((c.peso / totalVotosEmitidos) * 100).toFixed(1)
        : '0.0';
      const esElecto = i < maxSel && c.peso > 0;
      const medalla  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `
        <tr ${esElecto ? `style="background:#eff6ff"` : ''}>
          <td style="text-align:center;font-size:18px;padding:8px 12px">${medalla}</td>
          <td style="font-weight:${esElecto ? '800' : '400'};color:${esElecto ? AZUL : '#374151'};padding:8px 12px">
            ${c.nombre}
          </td>
          <td style="text-align:center;font-weight:800;font-size:15px;color:${esElecto ? AZUL : '#374151'}">${c.peso}</td>
          <td style="text-align:center">${c.asocs} asoc.</td>
          <td style="text-align:center;font-weight:700;color:${esElecto ? AZUL : '#9CA3AF'}">${pct}%</td>
          <td style="text-align:center">
            ${esElecto
              ? `<span style="background:${AZUL};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800">ELECTO</span>`
              : ''}
          </td>
        </tr>`;
    }).join('');

    const electosNombres = electos.map(e => e.nombre).join(', ');

    bloqueResultados = `
      <h2 class="seccion">RANKING DE CANDIDATOS</h2>
      <p class="nota">Se eligen los primeros <strong>${maxSel}</strong> candidato(s) con votos.</p>
      <table>
        <thead><tr>
          <th>#</th><th>Candidato</th><th>Votos Ponderados</th><th>Asociaciones</th><th>%</th><th></th>
        </tr></thead>
        <tbody>${filasHTML}</tbody>
      </table>
      <p class="nota">
        Candidato(s) electo(s):
        <strong style="color:${AZUL}">${electosNombres || '—'}</strong>
      </p>`;

    // Detalle: solo participación (sin revelar a quién votó)
    const filasDetalle = listaUsuarios.map((u: any) => {
      const voto = listaVotos.find((v: any) => v.usuario_id === u.id);
      const colorEstado = voto ? VERDE : ROJO;
      return `
        <tr>
          <td style="padding:8px 12px">${u.nombre_usuario}</td>
          <td style="text-align:center">${u.votos_disponibles ?? 1}</td>
          <td style="text-align:center;font-weight:700;color:${colorEstado}">
            ${voto ? 'Votó' : 'Pendiente'}
          </td>
        </tr>`;
    }).join('');

    bloqueDetalle = `
      <h2 class="seccion">REGISTRO DE PARTICIPACIÓN</h2>
      <p class="nota-sub">El voto de elección es confidencial; solo se indica si la asociación participó.</p>
      <table>
        <thead><tr>
          <th>Asociación</th><th>Peso</th><th>Estado</th>
        </tr></thead>
        <tbody>${filasDetalle}</tbody>
      </table>`;
  }

  // ── HTML final ────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #1F2937;
    padding: 32px 40px;
    line-height: 1.5;
  }

  /* ── Encabezado ── */
  .header {
    border-bottom: 3px solid ${ROJO};
    padding-bottom: 16px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left h1 {
    font-size: 18px;
    font-weight: 900;
    color: ${AZUL};
    letter-spacing: 0.5px;
  }
  .header-left h2 {
    font-size: 13px;
    font-weight: 700;
    color: ${ROJO};
    letter-spacing: 2px;
    margin-top: 4px;
    text-transform: uppercase;
  }
  .header-right {
    text-align: right;
    font-size: 11px;
    color: #6B7280;
  }

  /* ── Meta info ── */
  .meta-box {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-left: 4px solid ${AZUL};
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 20px;
  }
  .meta-row { display: flex; gap: 8px; margin-bottom: 6px; }
  .meta-label { font-size: 10px; font-weight: 800; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; min-width: 80px; margin-top: 2px; }
  .meta-valor { font-size: 13px; color: ${AZUL}; font-weight: 700; }
  .badge {
    display: inline-block; padding: 2px 12px; border-radius: 12px;
    font-size: 11px; font-weight: 800; color: white; letter-spacing: 1px;
  }
  .badge-reglamento { background: #1E40AF; }
  .badge-eleccion   { background: #6D28D9; }

  /* ── Resumen estadístico ── */
  .stats-grid {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  .stat-box {
    flex: 1;
    background: #F0F4FF;
    border: 1px solid #BFDBFE;
    border-radius: 8px;
    padding: 12px 16px;
    text-align: center;
  }
  .stat-num {
    font-size: 26px;
    font-weight: 900;
    color: ${AZUL};
    line-height: 1.1;
  }
  .stat-label {
    font-size: 10px;
    font-weight: 700;
    color: #6B7280;
    letter-spacing: 1px;
    margin-top: 4px;
  }
  .stat-sub {
    font-size: 11px;
    color: #374151;
    margin-top: 2px;
  }

  /* ── Secciones ── */
  .seccion {
    font-size: 11px;
    font-weight: 900;
    color: ${AZUL};
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 20px 0 8px 0;
    padding-bottom: 6px;
    border-bottom: 2px solid ${AZUL};
  }
  .nota {
    font-size: 12px;
    color: #374151;
    background: #FFF8E1;
    border-left: 3px solid #F59E0B;
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 4px;
  }
  .nota-sub {
    font-size: 11px;
    color: #6B7280;
    margin-bottom: 8px;
    font-style: italic;
  }

  /* ── Tablas ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead tr { background: ${AZUL}; }
  th {
    padding: 9px 12px;
    color: white;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    text-align: left;
  }
  td { padding: 7px 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  tbody tr:nth-child(even) td { background: #F9FAFB; }
  tbody tr:hover td { background: #EFF6FF; }

  /* ── Pie de página ── */
  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
    text-align: center;
    font-size: 10px;
    color: #9CA3AF;
    letter-spacing: 0.5px;
  }
  .footer strong { color: ${AZUL}; }
</style>
</head>
<body>

<!-- ENCABEZADO -->
<div class="header">
  <div class="header-left">
    <h1>Federación de Rodeo Chileno</h1>
    <h2>Acta de Votación</h2>
  </div>
  <div class="header-right">
    <div>Fecha de cierre</div>
    <div style="font-weight:700;color:#1F2937">${fechaHora}</div>
  </div>
</div>

<!-- META INFO -->
<div class="meta-box">
  <div class="meta-row">
    <span class="meta-label">Tipo</span>
    <span>
      <span class="badge badge-${pregunta.tipo}">${pregunta.tipo.toUpperCase()}</span>
    </span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Pregunta</span>
    <span class="meta-valor">${pregunta.texto}</span>
  </div>
  ${pregunta.tipo === 'eleccion' ? `
  <div class="meta-row">
    <span class="meta-label">Max. electos</span>
    <span class="meta-valor">${pregunta.max_selecciones ?? 1} candidato(s)</span>
  </div>` : ''}
</div>

<!-- RESUMEN ESTADÍSTICO -->
<h2 class="seccion">Resumen Estadístico</h2>
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
    <div class="stat-num" style="color:${parseFloat(pctVotos) >= 50 ? '#16A34A' : '#C8102E'}">${pctVotos}%</div>
    <div class="stat-label">Participación</div>
    <div class="stat-sub">${parseFloat(pctVotos) >= 66.67 ? 'Quórum alcanzado' : parseFloat(pctVotos) >= 50 ? 'Mayoría simple' : 'Sin quórum'}</div>
  </div>
</div>

<!-- RESULTADOS -->
${bloqueResultados}

<!-- DETALLE -->
${bloqueDetalle}

<!-- PIE DE PÁGINA -->
<div class="footer">
  <p>Documento generado automáticamente por el <strong>Sistema de Votos</strong> — Federación de Rodeo Chileno</p>
  <p style="margin-top:4px">Generado el ${fechaHora} · Este documento es de carácter oficial</p>
</div>

</body></html>`;
}

// ─────────────────────────────────────────────────────────────
//  PDF Historial del Presidente
// ─────────────────────────────────────────────────────────────
export async function exportarHistorialPresidentePDF(
  usuario: Usuario,
  historial: EntradaHistorial[]
): Promise<void> {
  try {
    const html = construirHTMLHistorial(usuario, historial);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
    } else {
      Alert.alert('PDF generado', `Guardado en:\n${uri}`);
    }
  } catch (e: any) {
    Alert.alert('Error', `No se pudo generar el PDF.\n${e?.message ?? ''}`);
  }
}

function construirHTMLHistorial(usuario: Usuario, historial: EntradaHistorial[]): string {
  const fechaHora = new Date().toLocaleString('es-CL', {
    dateStyle: 'long', timeStyle: 'short',
  });

  const COLOR_REG: Record<string, string> = {
    Apruebo: VERDE,
    Rechazo: ROJO,
    Abstengo: '#6B7280',
  };

  const filas = historial.map((entrada, idx) => {
    const esReg = entrada.pregunta_tipo === 'reglamento';
    const colorResp = esReg
      ? (COLOR_REG[entrada.respuestas[0]] ?? '#374151')
      : AZUL;

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
    }) + ' ' + new Date(entrada.fecha).toLocaleTimeString('es-CL', {
      hour: '2-digit', minute: '2-digit',
    });

    return `
      <tr style="${idx % 2 === 0 ? 'background:#FAFAFA' : ''}">
        <td style="padding:12px 14px;vertical-align:top;width:42%">
          <div style="font-weight:700;font-size:13px;color:#1F2937;line-height:1.4;margin-bottom:6px">
            ${entrada.pregunta_texto}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span style="background:${tipoColor};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;letter-spacing:1px">
              ${entrada.pregunta_tipo.toUpperCase()}
            </span>
            <span style="background:${estadoColor};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;letter-spacing:1px">
              ${entrada.pregunta_estado.toUpperCase()}
            </span>
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
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1F2937; padding: 32px 40px; line-height: 1.5; }
  .header { border-bottom: 3px solid ${ROJO}; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 18px; font-weight: 900; color: ${AZUL}; }
  .header h2 { font-size: 12px; font-weight: 700; color: ${ROJO}; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase; }
  .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid ${AZUL}; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 40px; }
  .info-item { }
  .info-label { font-size: 10px; font-weight: 800; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; }
  .info-valor { font-size: 15px; font-weight: 800; color: ${AZUL}; margin-top: 2px; }
  .seccion { font-size: 11px; font-weight: 900; color: ${AZUL}; letter-spacing: 2px; text-transform: uppercase; margin: 16px 0 10px 0; padding-bottom: 6px; border-bottom: 2px solid ${AZUL}; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: ${AZUL}; }
  th { padding: 9px 14px; color: white; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-align: left; }
  td { border-bottom: 1px solid #E5E7EB; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 10px; color: #9CA3AF; }
  .footer strong { color: ${AZUL}; }
</style>
</head><body>

<div class="header">
  <h1>Federación de Rodeo Chileno</h1>
  <h2>Historial de Votaciones</h2>
</div>

<div class="info-box">
  <div class="info-item">
    <div class="info-label">Asociación</div>
    <div class="info-valor">${usuario.nombre_usuario}</div>
  </div>
  <div class="info-item">
    <div class="info-label">ID</div>
    <div class="info-valor">${usuario.id_usuario}</div>
  </div>
  <div class="info-item">
    <div class="info-label">Peso de voto</div>
    <div class="info-valor">${usuario.votos_disponibles}</div>
  </div>
  <div class="info-item">
    <div class="info-label">Exportado</div>
    <div class="info-valor" style="font-size:12px">${fechaHora}</div>
  </div>
</div>

<h2 class="seccion">Registro de Participación (${historial.length} votación${historial.length !== 1 ? 'es' : ''})</h2>
<table>
  <thead><tr>
    <th>Pregunta / Votación</th>
    <th>Respuesta emitida</th>
    <th style="text-align:center">Peso</th>
    <th>Fecha</th>
  </tr></thead>
  <tbody>${filas}</tbody>
</table>

<div class="footer">
  <p>Documento generado automáticamente por el <strong>Sistema de Votos</strong> — Federación de Rodeo Chileno</p>
  <p style="margin-top:4px">Generado el ${fechaHora} · Este documento es de carácter oficial</p>
</div>

</body></html>`;
}
