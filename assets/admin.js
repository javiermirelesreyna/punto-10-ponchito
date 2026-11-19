/* =====================================================================
   Punto 10 Fútbol Tenis — panel de administración
   Edita equipos, rol, resultados y estadística; publica en GitHub.
   ===================================================================== */
(function () {
  'use strict';
  const P = window.P10;
  const esc = P.esc;
  const $ = (s, r) => (r || document).querySelector(s);

  const SECCIONES = [['equipos', 'Equipos'], ['rol', 'Rol y resultados'], ['estadistica', 'Estadística'], ['config', 'Configuración']];

  const S = {
    data: null, conn: null, sha: null, torneoId: null, seccion: 'equipos',
    dirty: false, version: 0, publicando: false, ocultarJugadas: false,
    prog: null, irA: null, foco: null
  };
  let TONOS = new Map();
  const bdg = e => P.badge(e, '', e ? TONOS.get(e.id) : null);

  const svg = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    mas: svg('<path d="M12 5v14M5 12h14"/>'),
    basura: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    ojo: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    subir: svg('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
    bajar: svg('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>'),
    link: svg('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
    recargar: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    salir: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    calendario: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>')
  };

  /* ---------- utilidades ---------- */
  const modoPrueba = () => !!(S.conn && S.conn.modo === 'prueba');
  const torneo = () => (S.data ? (S.data.torneos.find(t => t.id === S.torneoId) || S.data.torneos[0] || null) : null);
  const repoDe = c => ({ owner: c.owner, repo: c.repo, branch: c.branch || 'main', dataPath: c.dataPath || P.CFG.dataPath });
  const separar = s => String(s || '').split(/[,\n;]/).map(x => x.trim()).filter(Boolean);
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const ordenados = t => t.equipos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  function buscar(t, ds) {
    const p = ds.pid ? t.partidos.find(x => x.id === ds.pid) || null : null;
    const e = ds.id ? t.equipos.find(x => x.id === ds.id) || null : null;
    return { p, e };
  }

  function mensajeError(e) {
    if (!e) return 'Ocurrió un error.';
    if (e.status === 401) return 'GitHub no aceptó el token (es incorrecto o ya expiró). Genera uno nuevo y vuelve a conectar.';
    if (e.status === 403) return 'GitHub rechazó la operación. Revisa que el token tenga el permiso "Contents: Read and write" sobre este repositorio.';
    if (e.status === 404) return 'No encontré el repositorio o el token no tiene acceso a él. Revisa el usuario y el nombre del repositorio.';
    if (e.status === 422) return 'GitHub rechazó el archivo: ' + e.message;
    if (e.name === 'TypeError') return 'No hay conexión a internet o GitHub no respondió. Intenta de nuevo.';
    return e.message || 'Ocurrió un error.';
  }

  /* ---------- avisos y diálogos ---------- */
  function toast(msg, tipo) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = `toast ${tipo || 'ok'}`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), tipo === 'err' ? 6000 : 3800);
  }

  /** Diálogo modal. Devuelve true/false, o FormData si `campos` es true. */
  function dialogo(o) {
    return new Promise(res => {
      const d = document.createElement('dialog');
      d.innerHTML = `<form method="dialog">
        <div class="dlg-b"><h3>${esc(o.titulo)}</h3>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.html || ''}</div>
        <div class="dlg-f">
          ${o.cancelar === false ? '' : `<button class="btn ghost" value="no" formnovalidate>${esc(o.cancelar || 'Cancelar')}</button>`}
          <button class="btn ${o.peligro ? 'danger' : 'primary'}" value="si">${esc(o.ok || 'Aceptar')}</button>
        </div></form>`;
      document.body.appendChild(d);
      d.addEventListener('close', () => {
        const si = d.returnValue === 'si';
        const out = si ? (o.campos ? new FormData(d.querySelector('form')) : true) : false;
        d.remove();
        res(out);
      });
      d.showModal();
      const foco = d.querySelector('[autofocus]');
      if (foco) foco.focus();
    });
  }

  /* ---------- render con foco preservado ---------- */
  let ptrAbajo = false, renderPend = false, ptrTimer = null;
  document.addEventListener('pointerdown', ev => {
    if (ev.target.closest && ev.target.closest('select')) return;
    ptrAbajo = true;
    clearTimeout(ptrTimer);
    ptrTimer = setTimeout(() => { ptrAbajo = false; flush(); }, 900);
  }, true);
  const soltar = () => { if (!ptrAbajo) return; ptrAbajo = false; clearTimeout(ptrTimer); setTimeout(flush, 0); };
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);

  function programarRender() { renderPend = true; if (!ptrAbajo) setTimeout(flush, 0); }
  function flush() { if (renderPend && !ptrAbajo) render(); }

  function render() {
    renderPend = false;
    if (!S.data) return;
    const a = document.activeElement;
    const fk = S.foco || (a && a.dataset ? a.dataset.fk : null);
    let s0 = null, s1 = null;
    if (!S.foco) { try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* sin selección */ } }
    S.foco = null;
    const y = window.scrollY;

    $('#app').innerHTML = vistaApp();

    if (fk) {
      const el = document.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (s0 != null) el.setSelectionRange(s0, s1); else if (el.select && el.tagName === 'INPUT') el.select(); } catch (e) { /* no aplica */ }
      }
    }
    if (S.irA) {
      const el = document.getElementById(S.irA);
      S.irA = null;
      if (el) { el.scrollIntoView({ block: 'start' }); return; }
    }
    window.scrollTo(0, y);
  }

  function cambio(inmediato) {
    S.dirty = true;
    S.version++;
    P.guardarBorrador({ data: S.data, fecha: new Date().toISOString() });
    if (inmediato) render(); else programarRender();
  }

  /* ---------- pantallas ---------- */
  function renderSetup(error, prev) {
    S.data = null;
    const d = prev || P.detectarRepo();
    $('#app').innerHTML = `<main class="wrap"><section class="card setup">
      <img class="logo" src="assets/logo.webp" alt="Punto 10 Fútbol Tenis">
      <h1 class="display"><span class="gold-text">Panel de administración</span></h1>
      <p class="muted">Conecta el panel con tu repositorio de GitHub para que cada cambio que publiques se vea en la página pública. Solo se hace una vez en cada dispositivo.</p>
      ${error ? `<div class="error-box">${esc(error)}</div>` : ''}
      <form id="form-conexion" autocomplete="off">
        <div class="campos">
          <label class="f">Usuario de GitHub<input type="text" name="owner" required value="${esc(d.owner || '')}" placeholder="tu-usuario" autocapitalize="off" spellcheck="false"></label>
          <label class="f">Repositorio<input type="text" name="repo" required value="${esc(d.repo || '')}" placeholder="torneos" autocapitalize="off" spellcheck="false"></label>
          <label class="f">Rama<input type="text" name="branch" value="${esc(d.branch || 'main')}" autocapitalize="off" spellcheck="false"></label>
          <label class="f full">Token de acceso de GitHub<input type="password" name="token" required placeholder="github_pat_…" autocomplete="off" spellcheck="false"></label>
        </div>
        <p class="muted small">El token funciona como tu contraseña para publicar: se guarda solo en este navegador y nunca se sube al sitio. Si aún no tienes uno, sigue el paso 4 de la guía (README).</p>
        <div class="acc">
          <button class="btn primary" type="submit">Conectar</button>
          <button class="btn ghost" type="button" data-act="modo-prueba">Probar sin conectar</button>
        </div>
      </form>
    </section></main>`;
  }

  function barra() {
    const t = torneo();
    const prueba = modoPrueba();
    const estado = prueba
      ? '<span class="estado-pub pend" title="Modo prueba"><span class="dot"></span><span class="txt">Modo prueba</span></span>'
      : S.dirty
        ? '<span class="estado-pub pend" title="Cambios sin publicar"><span class="dot"></span><span class="txt">Cambios sin publicar</span></span>'
        : '<span class="estado-pub" title="Todo publicado"><span class="dot"></span><span class="txt">Todo publicado</span></span>';
    const hash = t ? '#' + encodeURIComponent(t.id) : '';
    const desactivado = S.publicando || (!prueba && !S.dirty);
    return `<header class="barra"><div class="wrap barra-in">
      <a class="marca" href="index.html${hash}" target="_blank" rel="noopener" title="Abrir la página pública">
        <img src="assets/logo.webp" alt=""><span><b>Punto 10</b><small>Panel de administración</small></span></a>
      <div class="barra-acc">
        ${estado}
        <a class="btn sm ghost" href="index.html?borrador=1${hash}" target="_blank" rel="noopener" title="Ver cómo quedará la página antes de publicar">${ICO.ojo} Vista previa</a>
        <button class="btn primary" data-act="publicar" ${desactivado ? 'disabled' : ''}>${prueba ? ICO.bajar : ICO.subir} ${S.publicando ? 'Publicando…' : prueba ? 'Descargar' : 'Publicar'}</button>
      </div>
    </div></header>`;
  }

  function vistaApp() {
    const t = torneo();
    if (t) { S.torneoId = t.id; TONOS = P.tonosEquipos(t); }
    const torneos = S.data.torneos.map(x =>
      `<button type="button" data-act="torneo" data-id="${esc(x.id)}" aria-pressed="${!!t && x.id === t.id}">${esc(x.nombre)}${x.visible ? '' : ' · oculto'}</button>`).join('');
    let cuerpo;
    if (!t) {
      cuerpo = `<div class="card vacio" style="margin-top:20px"><p>No hay torneos. Crea uno con el botón <b>+ Torneo</b>.</p></div><div style="margin-top:16px">${secConexion()}</div>`;
    } else {
      const sec = S.seccion === 'rol' ? secRol(t) : S.seccion === 'estadistica' ? secEstadistica(t) : S.seccion === 'config' ? secConfig(t) : secEquipos(t);
      cuerpo = `<nav class="tabs" role="tablist" aria-label="Secciones">${SECCIONES.map(([id, n]) =>
        `<button type="button" role="tab" data-act="seccion" data-sec="${id}" aria-selected="${S.seccion === id}">${n}</button>`).join('')}</nav>${sec}`;
    }
    return `${barra()}<main class="wrap admin-main">
      <nav class="seg" aria-label="Torneos">${torneos}<button type="button" class="add" data-act="nuevo-torneo">+ Torneo</button></nav>
      ${cuerpo}
    </main>`;
  }

  /* ---------- sección: equipos ---------- */
  function secEquipos(t) {
    const conteo = id => t.partidos.filter(p => p.local === id || p.visita === id).length;
    const otros = S.data.torneos.filter(x => x.id !== t.id && x.equipos.length);

    const lista = t.equipos.map(e => {
      const id = esc(e.id);
      return `<div class="eq-row">
        ${bdg(e)}
        <input type="text" value="${esc(e.nombre)}" data-ch="equipo" data-k="nombre" data-id="${id}" data-fk="e:${id}:nombre" maxlength="40" aria-label="Nombre del equipo">
        <input type="text" class="jug" value="${esc(e.jugadores.join(', '))}" data-ch="equipo" data-k="jugadores" data-id="${id}" data-fk="e:${id}:jug" placeholder="Jugadores separados por coma" aria-label="Jugadores de ${esc(e.nombre)}">
        <span class="muted small cuenta">${plural(conteo(e.id), 'partido', 'partidos')}</span>
        <button class="btn icon danger" data-act="borrar-equipo" data-id="${id}" title="Eliminar equipo" aria-label="Eliminar ${esc(e.nombre)}">${ICO.basura}</button>
      </div>`;
    }).join('');

    return `<section class="card">
        <div class="card-h"><h2>Agregar equipo</h2></div>
        <form class="form-eq" data-form="equipo" autocomplete="off">
          <label class="f">Nombre del equipo<input type="text" name="nombre" required maxlength="40" placeholder="Ej. Los Galácticos" data-fk="nuevo-equipo"></label>
          <label class="f">Jugadores (separados por coma)<input type="text" name="jugadores" placeholder="Juan, Pedro, Luis"></label>
          <button class="btn green" type="submit">${ICO.mas} Agregar</button>
        </form>
        <details class="mas"><summary>Agregar varios equipos a la vez</summary>
          <form data-form="lote">
            <p class="muted small" style="margin:0">Un equipo por renglón. Para incluir jugadores, escríbelos después de dos puntos: <code>Los Tigres: Juan, Pedro</code></p>
            <textarea name="lista" rows="5" placeholder="Los Tigres: Juan, Pedro&#10;Galácticos&#10;Real Fit"></textarea>
            <button class="btn" type="submit">${ICO.mas} Agregar lista</button>
          </form>
        </details>
        ${otros.length ? `<details class="mas"><summary>Copiar equipos de otro torneo</summary>
          <form data-form="copiar" style="grid-template-columns:auto auto;align-items:center">
            <select name="origen">${otros.map(x => `<option value="${esc(x.id)}">${esc(x.nombre)} (${x.equipos.length})</option>`).join('')}</select>
            <button class="btn" type="submit">Copiar equipos</button>
          </form></details>` : ''}
      </section>
      <section class="card">
        <div class="card-h"><h2>Equipos · ${t.equipos.length}</h2></div>
        <p class="ayuda">El circulito cambia solo según la tabla: <b>dorado</b> el primer lugar, <b>blanco</b> el último y <b>azul</b> los demás.</p>
        ${t.equipos.length ? lista : '<p class="muted">Todavía no hay equipos en este torneo.</p>'}
      </section>`;
  }

  /* ---------- sección: rol y resultados ---------- */
  function fechaSugerida(t) {
    const d = new Date();
    if (/s[aá]bad/i.test(`${t.nombre} ${t.descripcion}`)) d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    return P.isoFecha(d);
  }
  const filasVacias = t => Array.from({ length: Math.max(1, Math.floor(t.equipos.length / 2)) }, () => ({ l: '', v: '' }));
  function prog(t) {
    if (!S.prog || S.prog.torneoId !== t.id) S.prog = { torneoId: t.id, fecha: fechaSugerida(t), filas: filasVacias(t) };
    return S.prog;
  }

  function chipSemana(est) {
    return est === 'jugada' ? '<span class="chip ok">Jornada jugada</span>'
      : est === 'en-curso' ? '<span class="chip next">En curso</span>'
      : est === 'pospuesta' ? '<span class="chip warn">Pospuesta</span>'
      : est === 'pendiente' ? '<span class="chip">Por jugar</span>' : '';
  }

  function secRol(t) {
    if (t.equipos.length < 2) return '<div class="card vacio"><p>Agrega al menos 2 equipos para armar el rol.</p></div>';
    const lista = ordenados(t);
    const opciones = sel => '<option value="">Equipo…</option>' +
      lista.map(e => `<option value="${esc(e.id)}" ${e.id === sel ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('');

    const pr = prog(t);
    const filas = pr.filas.map((f, i) => `<div class="prog-fila">
        <span class="n">${i + 1}</span>
        <select data-ch="prog" data-k="l" data-i="${i}" data-fk="prog:${i}:l" aria-label="Enfrentamiento ${i + 1}, primer equipo">${opciones(f.l)}</select>
        <span class="vs-txt">VS</span>
        <select data-ch="prog" data-k="v" data-i="${i}" data-fk="prog:${i}:v" aria-label="Enfrentamiento ${i + 1}, segundo equipo">${opciones(f.v)}</select>
        <button class="btn icon ghost" data-act="prog-quitar" data-i="${i}" ${pr.filas.length === 1 ? 'disabled' : ''} title="Quitar renglón" aria-label="Quitar enfrentamiento ${i + 1}">${ICO.basura}</button>
      </div>`).join('');

    let ocultas = 0;
    const grupos = P.agruparSemanas(t, null, true).map(g => {
      const est = P.estadoGrupo(t, g.partidos);
      if (S.ocultarJugadas && est === 'jugada') { ocultas++; return ''; }
      return `<section class="card" id="s-${esc(g.clave || 'sin-fecha')}">
        <div class="card-h"><h2>${esc(g.titulo)}</h2><div class="semana-h">${chipSemana(est)}<span class="muted small">${plural(g.partidos.length, 'partido', 'partidos')}</span></div></div>
        <div class="pe-lista">${g.partidos.map(p => partidoEd(t, p, opciones)).join('')}</div>
      </section>`;
    }).join('');

    let vacio = '';
    if (!t.partidos.length) vacio = '<div class="card vacio"><p>Aún no hay partidos. Programa la primera jornada arriba.</p></div>';
    else if (!grupos) vacio = `<div class="card vacio"><p>${plural(ocultas, 'jornada jugada oculta', 'jornadas jugadas ocultas')}.</p></div>`;

    return `<section class="card">
        <div class="card-h"><h2>Programar jornada</h2></div>
        <p class="ayuda">Elige el día de juego y los equipos que se enfrentan. Al agregarlos aparecen abajo, agrupados por semana, para capturar los sets.</p>
        <div class="prog">
          <label class="f dia">Día de juego<input type="date" value="${esc(pr.fecha)}" data-ch="prog" data-k="fecha" data-fk="prog:fecha"></label>
          <div class="prog-filas">${filas}</div>
          <div class="toolbar" style="margin:0">
            <button class="btn" data-act="prog-mas">${ICO.mas} Enfrentamiento</button>
            <span class="sep"></span>
            <button class="btn green" data-act="prog-agregar">${ICO.calendario} Agregar al rol</button>
          </div>
        </div>
      </section>
      <div class="toolbar" style="margin-top:22px">
        <h2 class="titulo-sec" style="margin:0">Rol y resultados</h2>
        <span class="sep"></span>
        <label class="check"><input type="checkbox" data-ch="ui" data-k="ocultarJugadas" ${S.ocultarJugadas ? 'checked' : ''}> Ocultar jornadas jugadas</label>
      </div>
      <p class="ayuda">Escribe los sets de cada equipo (se gana con ${t.reglas.setsParaGanar}): el partido pasa a <b>Jugado</b> y la tabla se actualiza sola. Si un equipo no se presenta, cambia el estado a <b>W.O.</b></p>
      ${vacio}${grupos}`;
  }

  function partidoEd(t, p, opciones) {
    const r = P.resultado(p, t.reglas);
    const g = t.reglas.setsParaGanar;
    const L = P.equipoPorId(t, p.local), V = P.equipoPorId(t, p.visita);
    const nomL = L ? L.nombre : 'equipo 1', nomV = V ? V.nombre : 'equipo 2';
    const id = esc(p.id);
    const ids = `data-pid="${id}"`;
    const fk = k => `data-fk="p:${id}:${k}"`;
    const wo = r.wo;
    const valL = wo ? r.sl : (p.sl == null ? '' : p.sl);
    const valV = wo ? r.sv : (p.sv == null ? '' : p.sv);

    const estados = [['pendiente', 'Pendiente'], ['jugado', 'Jugado'], ['wo_local', `W.O. · gana ${nomL}`],
      ['wo_visita', `W.O. · gana ${nomV}`], ['pospuesto', 'Pospuesto']];

    let res;
    if (p.local && p.local === p.visita) res = '<span class="chip warn">Elige equipos distintos</span>';
    else if (r.contado) res = `<span class="chip ok">Gana ${esc(r.ganador === 'local' ? nomL : nomV)} ${Math.max(r.sl, r.sv)}-${Math.min(r.sl, r.sv)}${wo ? ' (W.O.)' : ''}</span>`;
    else if (r.invalido) res = `<span class="chip warn">El ganador debe llevar ${g} sets</span>`;
    else if (p.estado === 'jugado') res = '<span class="chip warn">Falta el marcador</span>';
    else if (p.estado === 'pospuesto') res = '<span class="chip warn">Pospuesto</span>';
    else if (!p.local || !p.visita) res = '<span class="chip">Elige los equipos</span>';
    else res = '<span class="chip">Por jugar</span>';

    return `<div class="pe ${r.contado ? 'hecho' : r.invalido ? 'mal' : ''}" id="p-${id}">
      <div class="pe-match">
        <select data-ch="partido" data-k="local" ${ids} ${fk('local')} aria-label="Primer equipo">${opciones(p.local)}</select>
        <input type="number" inputmode="numeric" min="0" max="${g}" value="${valL}" data-ch="marcador" data-k="sl" ${ids} ${fk('sl')} ${wo ? 'disabled' : ''} aria-label="Sets de ${esc(nomL)}">
        <span class="muted">-</span>
        <input type="number" inputmode="numeric" min="0" max="${g}" value="${valV}" data-ch="marcador" data-k="sv" ${ids} ${fk('sv')} ${wo ? 'disabled' : ''} aria-label="Sets de ${esc(nomV)}">
        <select data-ch="partido" data-k="visita" ${ids} ${fk('visita')} aria-label="Segundo equipo">${opciones(p.visita)}</select>
      </div>
      <div class="pe-row">
        <input type="date" value="${esc(p.fecha)}" data-ch="partido" data-k="fecha" ${ids} ${fk('fecha')} aria-label="Día del partido">
        <select class="estado-sel" data-ch="partido" data-k="estado" ${ids} ${fk('estado')} aria-label="Estado del partido">
          ${estados.map(([v, nombre]) => `<option value="${v}" ${p.estado === v ? 'selected' : ''}>${esc(nombre)}</option>`).join('')}
        </select>
        ${res}
        <button class="btn icon danger borrar" data-act="borrar-partido" ${ids} title="Eliminar partido" aria-label="Eliminar partido">${ICO.basura}</button>
      </div>
    </div>`;
  }

  /* ---------- sección: estadística editable ---------- */
  function secEstadistica(t) {
    const filas = P.calcularTabla(t);
    if (!filas.length) return '<div class="card vacio"><p>Agrega equipos para ver la estadística.</p></div>';
    const hayAjustes = filas.some(f => f.tieneAjuste);
    const celda = (f, k) => {
      const auto = k === 'pts' ? f.ptsSinAjuste : f.auto[k];
      const adj = P.num(f.equipo.ajustes[k]);
      const id = esc(f.equipo.id);
      const titulo = `Calculado con resultados: ${auto}${adj ? ` · Ajuste manual: ${adj > 0 ? '+' : ''}${adj}` : ''}`;
      return `<td class="${adj ? 'ajustado' : ''}" title="${titulo}"><input type="number" step="1" value="${f.final[k]}" data-ch="stat" data-k="${k}" data-id="${id}" data-fk="st:${id}:${k}" aria-label="${k.toUpperCase()} de ${esc(f.equipo.nombre)}"></td>`;
    };
    const filasHtml = filas.map(f => {
      const F = f.final, e = f.equipo, id = esc(e.id);
      return `<tr>
        <td class="c-eq sticky"><div class="eq-cell"><span class="pos">${f.pos}</span>${bdg(e)}<span class="nom">${esc(e.nombre)}</span></div></td>
        <td class="ro">${F.pj}</td>${celda(f, 'pg')}${celda(f, 'pp')}
        ${celda(f, 'sg')}${celda(f, 'sp')}<td class="ro">${F.ds > 0 ? '+' : ''}${F.ds}</td>
        ${celda(f, 'pts')}
        <td class="nota"><input type="text" value="${esc(e.notaAjuste)}" data-ch="nota" data-id="${id}" data-fk="st:${id}:nota" maxlength="80" placeholder="Ej. -3 pts por sanción" aria-label="Nota pública de ${esc(e.nombre)}"></td>
        <td>${f.tieneAjuste ? `<button class="btn sm ghost" data-act="reset-ajuste" data-id="${id}" title="Volver a los valores calculados">Restablecer</button>` : ''}</td>
      </tr>`;
    }).join('');

    return `<section class="card">
      <div class="card-h"><h2>Estadística</h2>${hayAjustes ? '<button class="btn sm danger" data-act="reset-todos">Quitar todos los ajustes</button>' : ''}</div>
      <p class="ayuda">Los números se calculan solos con los resultados del rol. Si escribes otro valor, se guarda como <b>ajuste manual</b> (casilla dorada) y se respeta aunque captures más resultados; pasa el cursor sobre una casilla para ver el valor calculado. <b>PJ</b> y <b>DS</b> se calculan solos; <b>PTS</b> se recalcula con PG y PP, y también lo puedes ajustar (por ejemplo, por una sanción). La nota aparece debajo de la tabla pública.</p>
      <div class="tabla-wrap">
        <table class="tabla editable">
          <thead><tr>
            <th class="c-eq sticky">Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>SG</th><th>SP</th><th>DS</th><th>PTS</th><th>Nota pública</th><th></th>
          </tr></thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </div>
    </section>`;
  }

  /* ---------- sección: configuración ---------- */
  function secConexion() {
    const c = S.conn || {};
    const info = modoPrueba()
      ? 'Estás en <b>modo prueba</b>: los cambios se guardan solo en este navegador. Usa “Descargar” para obtener el archivo de datos, o conecta GitHub para publicar.'
      : `Conectado a <b>${esc(c.owner)}/${esc(c.repo)}</b> (rama ${esc(c.branch || 'main')}). El token está guardado solo en este navegador.`;
    return `<section class="card full">
      <div class="card-h"><h2>Conexión y respaldo</h2></div>
      <p class="muted">${info}</p>
      <div class="toolbar" style="margin-bottom:0">
        ${modoPrueba()
          ? `<button class="btn primary" data-act="desconectar">Conectar con GitHub</button>`
          : `<button class="btn" data-act="recargar">${ICO.recargar} Recargar desde GitHub</button>
             <button class="btn ghost" data-act="desconectar">${ICO.salir} Cambiar conexión</button>`}
        <button class="btn ghost" data-act="exportar">${ICO.bajar} Descargar respaldo</button>
        <button class="btn ghost" data-act="importar">${ICO.subir} Importar respaldo</button>
      </div>
    </section>`;
  }

  function secConfig(t) {
    const base = location.href.replace(/[#?].*$/, '').replace(/admin\.html$/, '');
    const enlace = `${base}#${encodeURIComponent(t.id)}`;
    const r = t.reglas;
    const regla = (k, label, ayuda, min, max) => `<label class="f">${label}
      <input type="number" step="1" value="${r[k]}" data-ch="regla" data-k="${k}" data-fk="r:${k}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}>
      ${ayuda ? `<span class="small" style="color:var(--dim)">${ayuda}</span>` : ''}</label>`;
    return `<div class="config-grid">
      <section class="card">
        <div class="card-h"><h2>Datos del torneo</h2></div>
        <div class="campos-form">
          <label class="f">Nombre<input type="text" value="${esc(t.nombre)}" data-ch="torneo" data-k="nombre" data-fk="t:nombre" maxlength="40"></label>
          <label class="f">Descripción (días, sede)<input type="text" value="${esc(t.descripcion)}" data-ch="torneo" data-k="descripcion" data-fk="t:desc" maxlength="120" placeholder="Martes y jueves"></label>
          <label class="f">Aviso para el público (opcional)<textarea rows="3" data-ch="torneo" data-k="aviso" data-fk="t:aviso" maxlength="400" placeholder="Ej. Esta semana no hay jornada por día festivo.">${esc(t.aviso)}</textarea></label>
          <label class="check"><input type="checkbox" data-ch="torneo" data-k="visible" ${t.visible ? 'checked' : ''}> Mostrar este torneo en la página pública</label>
          <div><span class="small muted">Enlace directo a este torneo</span>
            <div class="enlace"><code>${esc(enlace)}</code><button class="btn sm" data-act="copiar-enlace" data-url="${esc(enlace)}">${ICO.link} Copiar</button></div></div>
        </div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Reglas y puntuación</h2></div>
        <div class="reglas">
          ${regla('ptsVictoria', 'Puntos por ganar')}
          ${regla('ptsDerrota', 'Puntos por perder')}
          ${regla('ptsDerrotaWO', 'Puntos por perder por W.O.', 'Puede ser negativo')}
          ${regla('setsParaGanar', 'Sets para ganar', '3 = a ganar 3 de 5', 1, 9)}
          ${regla('clasifican', 'Equipos que clasifican', 'Se marcan en verde · 0 = ninguno', 0, 99)}
        </div>
        <p class="ayuda" style="margin:12px 0 0">No hay empates. Un W.O. cuenta como victoria ${r.setsParaGanar}-0 en sets.</p>
      </section>
      ${secConexion()}
      <section class="card full">
        <div class="card-h"><h2>Eliminar torneo</h2></div>
        <p class="muted">Borra el torneo con sus equipos, rol y resultados. Después de publicar, solo se puede recuperar desde el historial de GitHub o un respaldo.</p>
        <button class="btn danger" data-act="borrar-torneo">${ICO.basura} Eliminar “${esc(t.nombre)}”</button>
      </section>
    </div>`;
  }

  /* ---------- carga y conexión ---------- */
  async function conectar(form) {
    const fd = new FormData(form);
    let owner = String(fd.get('owner') || '').trim();
    let repo = String(fd.get('repo') || '').trim();
    const m = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(owner) || /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(repo);
    if (m) { owner = m[1]; repo = m[2]; }
    const c = {
      owner: owner.replace(/^@/, ''),
      repo: repo.replace(/\.git$/i, ''),
      branch: String(fd.get('branch') || '').trim() || 'main',
      dataPath: P.CFG.dataPath,
      token: String(fd.get('token') || '').trim()
    };
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Conectando…';
    try {
      await P.verificarRepo(c, c.token);
    } catch (e) {
      renderSetup(mensajeError(e), c);
      return;
    }
    S.conn = c;
    P.guardarConexion(c);
    await cargarDatos();
  }

  async function cargarDatos() {
    $('#app').innerHTML = '<div class="cargando">Cargando torneos…</div>';
    let base = null, nuevo = false;
    S.sha = null;
    if (modoPrueba()) {
      base = await P.leerArchivoLocal();
    } else {
      try {
        const r = await P.leerGitHub(repoDe(S.conn), S.conn.token);
        base = r.data;
        S.sha = r.sha;
      } catch (e) {
        if (e.status === 404) { base = await P.leerArchivoLocal(); nuevo = true; }
        else { renderSetup(mensajeError(e), S.conn); return; }
      }
    }
    S.data = P.normalizar(base || P.datosIniciales());
    S.dirty = nuevo;
    S.version = 0;
    S.prog = null;

    const b = P.leerBorrador();
    if (b && b.data) {
      const bd = P.normalizar(b.data);
      if (JSON.stringify(bd) !== JSON.stringify(S.data)) {
        let usar = modoPrueba();
        if (!usar) {
          const cuando = b.fecha ? new Date(b.fecha).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
          usar = await dialogo({
            titulo: 'Cambios sin publicar',
            texto: `En este dispositivo hay cambios que no se publicaron${cuando ? ` (último cambio: ${cuando})` : ''}. ¿Quieres recuperarlos?`,
            ok: 'Recuperar', cancelar: 'Descartar'
          });
        }
        if (usar) { S.data = bd; S.dirty = true; } else P.borrarBorrador();
      } else {
        P.borrarBorrador();
      }
    }
    if (!S.data.torneos.some(t => t.id === S.torneoId)) S.torneoId = S.data.torneos[0] ? S.data.torneos[0].id : null;
    render();
    if (nuevo) toast('El archivo de datos aún no existe en GitHub: se creará la primera vez que publiques.');
  }

  async function publicar() {
    if (S.publicando) return;
    if (modoPrueba()) { exportar(); return; }
    S.publicando = true;
    render();
    const versionInicio = S.version;
    const copia = JSON.parse(JSON.stringify(S.data));
    copia.actualizado = new Date().toISOString();
    const contenido = JSON.stringify(copia, null, 2) + '\n';
    const repo = repoDe(S.conn);
    const msg = `Actualizar torneos (${new Date().toLocaleString('es-MX')})`;
    try {
      let sha;
      try {
        sha = await P.escribirGitHub(repo, S.conn.token, contenido, S.sha, msg);
      } catch (e) {
        if (e.status === 409 || (e.status === 422 && /sha/i.test(e.message))) {
          const ok = await dialogo({
            titulo: 'Hay una versión más nueva',
            texto: 'Alguien (o tú desde otro dispositivo) publicó cambios después de que abriste este panel. Si continúas, tus cambios reemplazarán esa versión.',
            ok: 'Publicar mis cambios', cancelar: 'Cancelar', peligro: true
          });
          if (!ok) { const c = new Error('cancelado'); c.cancelado = true; throw c; }
          const actual = await P.leerGitHub(repo, S.conn.token);
          sha = await P.escribirGitHub(repo, S.conn.token, contenido, actual.sha, msg);
        } else throw e;
      }
      S.sha = sha;
      S.data.actualizado = copia.actualizado;
      if (S.version === versionInicio) { S.dirty = false; P.borrarBorrador(); }
      else P.guardarBorrador({ data: S.data, fecha: new Date().toISOString() });
      toast('¡Publicado! La página pública se actualiza en unos segundos.');
    } catch (e) {
      if (!e.cancelado) toast(mensajeError(e), 'err');
    } finally {
      S.publicando = false;
      render();
    }
  }

  function exportar() {
    const copia = JSON.parse(JSON.stringify(S.data));
    if (modoPrueba()) copia.actualizado = new Date().toISOString();
    const blob = new Blob([JSON.stringify(copia, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = modoPrueba() ? 'torneos.json' : `respaldo-punto10-${P.isoFecha(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (modoPrueba()) toast('Se descargó torneos.json. Súbelo a la carpeta data/ de tu repositorio para publicarlo.');
  }

  async function importar(input) {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    let json;
    try { json = JSON.parse(await f.text()); } catch (e) { toast('El archivo no es un respaldo válido (JSON).', 'err'); return; }
    if (!json || !Array.isArray(json.torneos)) { toast('El archivo no tiene el formato de torneos de Punto 10.', 'err'); return; }
    const ok = await dialogo({
      titulo: 'Importar respaldo',
      texto: `El respaldo tiene ${plural(json.torneos.length, 'torneo', 'torneos')}. Reemplazará todo lo que hay ahora en el panel (no se publica hasta que presiones Publicar).`,
      ok: 'Reemplazar', peligro: true
    });
    if (!ok) return;
    S.data = P.normalizar(json);
    S.torneoId = S.data.torneos[0] ? S.data.torneos[0].id : null;
    S.prog = null;
    cambio(true);
    toast('Respaldo importado.');
  }

  /* ---------- acciones ---------- */
  async function nuevoTorneo() {
    const fd = await dialogo({
      titulo: 'Nuevo torneo',
      html: `<div class="campos">
        <label class="f full">Nombre del torneo<input type="text" name="nombre" required maxlength="40" placeholder="Ej. Nocturno, Relámpago, Copa Punto 10" autofocus></label>
        <label class="f full">Descripción (opcional)<input type="text" name="descripcion" maxlength="120" placeholder="Ej. Domingos"></label>
      </div>`,
      ok: 'Crear torneo', campos: true
    });
    if (!fd) return;
    const nombre = String(fd.get('nombre') || '').trim();
    if (!nombre) return;
    const raiz = P.slug(nombre);
    let id = raiz, n = 2;
    while (S.data.torneos.some(t => t.id === id)) id = `${raiz}-${n++}`;
    const t = P.nuevoTorneo(nombre, id);
    t.descripcion = String(fd.get('descripcion') || '').trim();
    S.data.torneos.push(t);
    S.torneoId = id;
    S.seccion = 'equipos';
    cambio(true);
    toast(`Torneo “${nombre}” creado.`);
  }

  function agregarJornada(t) {
    const pr = prog(t);
    if (!pr.fecha) { toast('Elige el día de juego.', 'err'); return; }
    const existe = id => t.equipos.some(e => e.id === id);
    const medias = pr.filas.filter(f => (f.l && !f.v) || (!f.l && f.v));
    if (medias.length) { toast('Hay un enfrentamiento con un solo equipo elegido.', 'err'); return; }
    const completas = pr.filas.filter(f => f.l && f.v && existe(f.l) && existe(f.v));
    if (!completas.length) { toast('Elige los equipos de al menos un enfrentamiento.', 'err'); return; }
    if (completas.some(f => f.l === f.v)) { toast('Un equipo no puede jugar contra sí mismo.', 'err'); return; }
    completas.forEach(f => t.partidos.push({ id: P.uid(), local: f.l, visita: f.v, fecha: pr.fecha, estado: 'pendiente', sl: null, sv: null }));
    pr.filas = filasVacias(t);
    S.ocultarJugadas = false;
    S.irA = 's-' + P.lunesDe(pr.fecha);
    cambio(true);
    toast(`Se ${completas.length === 1 ? 'agregó 1 partido' : `agregaron ${completas.length} partidos`} al rol.`);
  }

  async function accion(b) {
    const act = b.dataset.act;
    if (act === 'modo-prueba') {
      S.conn = { modo: 'prueba' };
      P.guardarConexion(S.conn);
      await cargarDatos();
      return;
    }
    if (!S.data) return;
    const t = torneo();
    const { p, e } = t ? buscar(t, b.dataset) : {};

    switch (act) {
      case 'publicar': return publicar();
      case 'torneo': S.torneoId = b.dataset.id; render(); window.scrollTo(0, 0); return;
      case 'seccion': S.seccion = b.dataset.sec; render(); return;
      case 'nuevo-torneo': return nuevoTorneo();

      case 'borrar-equipo': {
        if (!e) return;
        const n = t.partidos.filter(x => x.local === e.id || x.visita === e.id).length;
        const ok = await dialogo({
          titulo: `Eliminar “${e.nombre}”`,
          texto: n ? `Este equipo tiene ${plural(n, 'partido', 'partidos')} en el rol. Si lo eliminas, también se borran esos partidos y sus resultados.` : '¿Seguro que quieres eliminar este equipo?',
          ok: 'Eliminar', peligro: true
        });
        if (!ok) return;
        t.equipos = t.equipos.filter(x => x.id !== e.id);
        t.partidos = t.partidos.filter(x => x.local !== e.id && x.visita !== e.id);
        cambio(true);
        return;
      }

      case 'prog-mas': {
        const pr = prog(t);
        pr.filas.push({ l: '', v: '' });
        S.foco = `prog:${pr.filas.length - 1}:l`;
        render();
        return;
      }
      case 'prog-quitar': {
        const pr = prog(t);
        if (pr.filas.length > 1) pr.filas.splice(+b.dataset.i, 1);
        render();
        return;
      }
      case 'prog-agregar': agregarJornada(t); return;

      case 'borrar-partido': {
        if (!p) return;
        if (P.resultado(p, t.reglas).contado) {
          const ok = await dialogo({ titulo: 'Eliminar partido', texto: 'Este partido ya tiene resultado. Si lo eliminas, la tabla se recalcula sin él.', ok: 'Eliminar', peligro: true });
          if (!ok) return;
        }
        t.partidos = t.partidos.filter(x => x !== p);
        cambio(true);
        return;
      }

      case 'reset-ajuste': if (e) { e.ajustes = {}; cambio(true); } return;
      case 'reset-todos': {
        const ok = await dialogo({ titulo: 'Quitar todos los ajustes', texto: 'La estadística de todos los equipos volverá a ser la calculada con los resultados. Las notas públicas se conservan.', ok: 'Quitar ajustes', peligro: true });
        if (!ok) return;
        t.equipos.forEach(x => { x.ajustes = {}; });
        cambio(true);
        return;
      }

      case 'copiar-enlace': {
        const url = b.dataset.url;
        try { await navigator.clipboard.writeText(url); toast('Enlace copiado.'); }
        catch (err) { window.prompt('Copia el enlace:', url); }
        return;
      }
      case 'borrar-torneo': {
        const ok = await dialogo({ titulo: `Eliminar “${t.nombre}”`, texto: 'Se borrará el torneo con sus equipos, rol y resultados. Esta acción no se puede deshacer desde el panel.', ok: 'Eliminar torneo', peligro: true });
        if (!ok) return;
        S.data.torneos = S.data.torneos.filter(x => x !== t);
        S.torneoId = S.data.torneos[0] ? S.data.torneos[0].id : null;
        S.seccion = 'equipos';
        cambio(true);
        return;
      }

      case 'exportar': exportar(); return;
      case 'importar': $('#archivo-importar').click(); return;
      case 'recargar': {
        if (S.dirty) {
          const ok = await dialogo({ titulo: 'Recargar desde GitHub', texto: 'Se descartarán los cambios que no has publicado.', ok: 'Descartar y recargar', peligro: true });
          if (!ok) return;
        }
        P.borrarBorrador();
        await cargarDatos();
        return;
      }
      case 'desconectar': {
        if (!modoPrueba()) {
          const ok = await dialogo({ titulo: 'Cambiar conexión', texto: 'Se borrará el token guardado en este navegador. Tus cambios sin publicar se conservan en este dispositivo.', ok: 'Continuar' });
          if (!ok) return;
        }
        const prev = modoPrueba() ? null : Object.assign({}, S.conn, { token: '' });
        P.borrarConexion();
        S.conn = null;
        renderSetup(null, prev);
        return;
      }
      default:
    }
  }

  function enviar(f) {
    const t = torneo();
    if (!t) return;
    const fd = new FormData(f);
    const existe = nombre => t.equipos.some(x => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    const nuevo = (nombre, jugadores) => ({ id: P.uid(), nombre: nombre.slice(0, 40), jugadores, ajustes: {}, notaAjuste: '' });

    if (f.dataset.form === 'equipo') {
      const nombre = String(fd.get('nombre') || '').trim();
      if (!nombre) return;
      if (existe(nombre)) { toast('Ya hay un equipo con ese nombre.', 'err'); return; }
      t.equipos.push(nuevo(nombre, separar(fd.get('jugadores'))));
      S.foco = 'nuevo-equipo';
      cambio(true);
      toast(`“${nombre}” agregado.`);
    } else if (f.dataset.form === 'lote') {
      let n = 0;
      String(fd.get('lista') || '').split('\n').forEach(linea => {
        const [nom, jug] = linea.split(/:(.*)/s);
        const nombre = String(nom || '').trim();
        if (!nombre || existe(nombre)) return;
        t.equipos.push(nuevo(nombre, separar(jug)));
        n++;
      });
      if (!n) { toast('No se agregó ningún equipo (vacío o repetidos).', 'err'); return; }
      cambio(true);
      toast(`Se agregaron ${plural(n, 'equipo', 'equipos')}.`);
    } else if (f.dataset.form === 'copiar') {
      const origen = S.data.torneos.find(x => x.id === fd.get('origen'));
      if (!origen) return;
      let n = 0;
      origen.equipos.forEach(x => {
        if (existe(x.nombre)) return;
        t.equipos.push(nuevo(x.nombre, x.jugadores.slice()));
        n++;
      });
      if (!n) { toast('Esos equipos ya están en este torneo.', 'err'); return; }
      cambio(true);
      toast(`Se copiaron ${plural(n, 'equipo', 'equipos')}.`);
    }
  }

  function editar(el) {
    const t = torneo();
    if (!t) return;
    const ch = el.dataset.ch, k = el.dataset.k;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    const { p, e } = buscar(t, el.dataset);

    switch (ch) {
      case 'ui': S[k] = val; render(); return;

      case 'prog': {
        const pr = prog(t);
        if (k === 'fecha') pr.fecha = String(val);
        else if (pr.filas[+el.dataset.i]) pr.filas[+el.dataset.i][k] = String(val);
        programarRender();
        return;
      }

      case 'torneo':
        if (k === 'nombre') { const v = String(val).trim(); if (!v) { render(); return; } t.nombre = v; }
        else if (k === 'visible') t.visible = !!val;
        else t[k] = String(val).trim();
        break;

      case 'regla': {
        let v = Math.round(P.num(val));
        if (k === 'setsParaGanar') v = Math.min(9, Math.max(1, v));
        if (k === 'clasifican') v = Math.max(0, v);
        t.reglas[k] = v;
        break;
      }

      case 'equipo':
        if (!e) return;
        if (k === 'nombre') { const v = String(val).trim(); if (!v) { render(); return; } e.nombre = v.slice(0, 40); }
        else if (k === 'jugadores') e.jugadores = separar(val);
        break;

      case 'partido':
        if (!p) return;
        p[k] = String(val);
        break;

      case 'marcador': {
        if (!p) return;
        p[k] = P.numONulo(val);
        const hay = p.sl != null || p.sv != null;
        if (hay && (p.estado === 'pendiente' || p.estado === 'pospuesto')) p.estado = 'jugado';
        if (!hay && p.estado === 'jugado') p.estado = 'pendiente';
        break;
      }

      case 'stat': {
        if (!e) return;
        const f = P.calcularTabla(t).find(x => x.equipo.id === e.id);
        if (!f) return;
        const v = Math.round(P.num(val));
        const auto = k === 'pts' ? f.ptsSinAjuste : f.auto[k];
        const adj = v - auto;
        if (adj) e.ajustes[k] = adj; else delete e.ajustes[k];
        break;
      }

      case 'nota':
        if (!e) return;
        e.notaAjuste = String(val).trim();
        break;

      default: return;
    }
    cambio(false);
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.tagName === 'A') return;
    ev.preventDefault();
    accion(b);
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.id === 'archivo-importar') { importar(el); return; }
    if (el.dataset && el.dataset.ch && S.data) editar(el);
  });
  document.addEventListener('submit', ev => {
    const f = ev.target;
    if (f.id === 'form-conexion') { ev.preventDefault(); conectar(f); return; }
    if (f.dataset && f.dataset.form) { ev.preventDefault(); enviar(f); }
  });
  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      setTimeout(() => { if (S.data && (S.dirty || modoPrueba())) publicar(); }, 0);
    }
  });
  window.addEventListener('beforeunload', ev => {
    if (S.dirty && !modoPrueba()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  /* ---------- inicio ---------- */
  S.conn = P.leerConexion();
  if (S.conn && (S.conn.modo === 'prueba' || S.conn.token)) cargarDatos();
  else renderSetup();
})();
