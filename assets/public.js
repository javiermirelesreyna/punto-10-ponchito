/* =====================================================================
   Punto 10 Fútbol Tenis — página pública
   ===================================================================== */
(function () {
  'use strict';
  const P = window.P10;
  const esc = P.esc;
  const $ = s => document.querySelector(s);

  const VISTAS = [['tabla', 'Tabla'], ['rol', 'Rol de juegos'], ['equipos', 'Equipos']];
  const SEMANAS_VISIBLES = 3;
  const st = {
    data: null, firma: '', torneoId: '', vista: 'tabla', filtro: '', completa: false, todosRes: false,
    preview: new URLSearchParams(location.search).has('borrador'), error: null
  };
  let TONOS = new Map();
  const bdg = (e, cls) => P.badge(e, cls, e ? TONOS.get(e.id) : null);

  const ICO = {
    aviso: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8v18L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    ojo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    balon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L3.5 8.5"/></svg>'
  };

  /* ---------- datos ---------- */
  const torneosVisibles = () => (st.data ? st.data.torneos.filter(t => t.visible) : []);
  function torneo() {
    const ts = torneosVisibles();
    return ts.find(t => t.id === st.torneoId) || ts[0] || null;
  }

  function leerHash() {
    const [t, v] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
    if (t) st.torneoId = t;
    if (v && VISTAS.some(x => x[0] === v)) st.vista = v;
  }
  function ponerHash() {
    const t = torneo();
    if (!t) return;
    const h = `#${t.id}/${st.vista}`;
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }

  async function cargar() {
    try {
      let data = null;
      if (st.preview) {
        const b = P.leerBorrador();
        data = b && b.data;
      }
      if (!data) data = await P.cargarDatosPublicos();
      st.error = null;
      const firma = JSON.stringify(data);
      if (firma !== st.firma) {
        st.firma = firma;
        st.data = P.normalizar(JSON.parse(firma));
        render();
      } else {
        pintarActualizado();
      }
    } catch (e) {
      st.error = e;
      if (!st.data) render(); else pintarActualizado();
    }
  }

  /* ---------- piezas ---------- */
  const vacio = texto => `<div class="card vacio">${ICO.balon}<p>${esc(texto)}</p></div>`;

  function filaPartido(t, p) {
    const L = P.equipoPorId(t, p.local), V = P.equipoPorId(t, p.visita);
    const r = P.resultado(p, t.reglas);
    const gL = r.ganador === 'local', gV = r.ganador === 'visita';
    let centro;
    if (r.contado) {
      centro = `<div class="sc"><b class="${gL ? 'win' : ''}">${r.sl}</b><span>-</span><b class="${gV ? 'win' : ''}">${r.sv}</b></div>` +
        (r.wo ? '<div class="sets">W.O.</div>' : '');
    } else if (p.estado === 'pospuesto') {
      centro = '<span class="chip warn">Pospuesto</span>';
    } else {
      centro = '<div class="vs">VS</div>';
    }
    const cls = (gana, pierde) => (gana ? 'gana' : pierde ? 'pierde' : '');
    return `<div class="partido">
      <div class="p-eq l ${cls(gL, gV)}"><span class="nom">${esc(L ? L.nombre : 'Por definir')}</span>${bdg(L)}</div>
      <div class="marcador">${centro}</div>
      <div class="p-eq v ${cls(gV, gL)}">${bdg(V)}<span class="nom">${esc(V ? V.nombre : 'Por definir')}</span></div>
      <div class="p-meta">${p.fecha ? P.capital(P.fmtFecha(p.fecha)) : 'Fecha por definir'}</div>
    </div>`;
  }

  function chipSemana(est, esProxima) {
    if (est === 'jugada') return '<span class="chip ok">Jornada jugada</span>';
    if (est === 'en-curso') return '<span class="chip next">En curso</span>';
    if (est === 'pospuesta') return '<span class="chip warn">Pospuesta</span>';
    if (esProxima) return '<span class="chip next">Próxima</span>';
    return est === 'pendiente' ? '<span class="chip">Por jugar</span>' : '';
  }

  function tarjetaSemana(t, g, chip, extraCls) {
    return `<section class="card jornada ${extraCls || ''}" id="semana-${esc(g.clave || 'sin-fecha')}">
      <div class="card-h"><h2>${esc(g.titulo)}</h2><div class="j-info">${chip || ''}</div></div>
      ${g.partidos.map(p => filaPartido(t, p)).join('')}
    </section>`;
  }

  function racha(arr) {
    if (!arr.length) return '<span class="muted">—</span>';
    return `<span class="racha">${arr.map(x => `<i class="${x}" title="${x === 'G' ? 'Ganó' : 'Perdió'}">${x}</i>`).join('')}</span>`;
  }

  const signo = n => (n > 0 ? '+' + n : String(n));
  const claseDif = n => (n > 0 ? 'posit' : n < 0 ? 'neg' : '');

  /* ---------- vistas ---------- */
  function vistaTabla(t, filas) {
    if (!filas.length) return vacio('Aún no hay equipos registrados en este torneo.');
    const cl = t.reglas.clasifican;
    const jugados = t.partidos.filter(p => P.resultado(p, t.reglas).contado);

    const filasHtml = filas.map(f => {
      const F = f.final, e = f.equipo;
      const clases = [TONOS.get(e.id) === 'oro' ? 'top1' : '', cl && f.pos <= cl ? 'clasifica' : ''].join(' ');
      return `<tr class="${clases}">
        <td class="c-eq sticky"><div class="eq-cell"><span class="pos">${f.pos}</span>${bdg(e)}<span class="nom">${esc(e.nombre)}${e.notaAjuste ? ' *' : ''}</span></div></td>
        <td>${F.pj}</td><td>${F.pg}</td><td>${F.pp}</td>
        <td>${F.sg}</td><td>${F.sp}</td><td class="${claseDif(F.ds)}">${signo(F.ds)}</td>
        <td class="c-pts">${F.pts}</td>
        <td class="ext">${racha(f.racha)}</td>
      </tr>`;
    }).join('');

    const notas = filas.filter(f => f.equipo.notaAjuste)
      .map(f => `<li><b>${esc(f.equipo.nombre)}:</b> ${esc(f.equipo.notaAjuste)}</li>`).join('');

    const grupos = P.agruparSemanas(t, jugados, true);
    const visibles = st.todosRes ? grupos : grupos.slice(0, SEMANAS_VISIBLES);
    const resultados = grupos.length
      ? visibles.map(g => {
        const toda = t.partidos.filter(p => P.lunesDe(p.fecha) === g.clave);
        return tarjetaSemana(t, g, chipSemana(P.estadoGrupo(t, toda), false));
      }).join('') +
        (grupos.length > SEMANAS_VISIBLES
          ? `<div style="text-align:center;margin-top:14px"><button class="btn" data-act="todos-res">${st.todosRes ? 'Ver solo las más recientes' : `Ver resultados anteriores (${grupos.length - SEMANAS_VISIBLES})`}</button></div>`
          : '')
      : '<div class="card"><p class="muted" style="margin:0">Todavía no hay partidos jugados.</p></div>';

    return `<section class="card">
        <div class="card-h">
          <h2>Tabla de posiciones</h2>
          <div class="j-info"><span class="muted small">${jugados.length} ${jugados.length === 1 ? 'partido jugado' : 'partidos jugados'}</span>
          <button class="btn sm ghost ver-mas" data-act="completa">${st.completa ? 'Ocultar racha' : 'Ver racha'}</button></div>
        </div>
        <div class="tabla-wrap">
          <table class="tabla ${st.completa ? 'completa' : ''}">
            <thead><tr>
              <th class="c-eq sticky">Equipo</th><th title="Partidos jugados">PJ</th><th title="Partidos ganados">PG</th><th title="Partidos perdidos">PP</th>
              <th title="Sets ganados">SG</th><th title="Sets perdidos">SP</th><th title="Diferencia de sets">DS</th>
              <th title="Puntos en la tabla">PTS</th><th class="ext">Últimos</th>
            </tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
        </div>
        <p class="leyenda">PJ jugados · PG ganados · PP perdidos · SG sets ganados · SP sets perdidos · DS diferencia de sets · PTS ${t.reglas.ptsVictoria} por partido ganado${cl ? ` · <span class="marca-cl"></span> Zona de clasificación (${cl})` : ''}</p>
        ${notas ? `<ul class="notas-aj">${notas}</ul>` : ''}
      </section>
      <h2 class="titulo-sec">Resultados</h2>
      ${resultados}`;
  }

  function vistaRol(t) {
    if (!t.partidos.length) return vacio('El rol de juegos se publicará pronto.');
    const lista = st.filtro ? t.partidos.filter(p => p.local === st.filtro || p.visita === st.filtro) : t.partidos;
    const grupos = P.agruparSemanas(t, lista, true);
    const proxima = grupos.filter(g => g.clave).reverse()
      .find(g => { const e = P.estadoGrupo(t, g.partidos); return e === 'pendiente' || e === 'en-curso'; });
    const opciones = t.equipos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(e => `<option value="${esc(e.id)}" ${e.id === st.filtro ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('');

    const html = grupos.map(g => tarjetaSemana(t, g, chipSemana(P.estadoGrupo(t, g.partidos), g === proxima), g === proxima ? 'es-proxima' : '')).join('');

    return `<div class="filtros">
        <label for="filtro">Ver partidos de:</label>
        <select id="filtro"><option value="">Todos los equipos</option>${opciones}</select>
        ${proxima ? `<a class="btn sm ghost" href="#semana-${esc(proxima.clave || 'sin-fecha')}" data-act="ir-proxima">Ir a la próxima jornada</a>` : ''}
      </div>
      ${html || vacio('Ese equipo todavía no tiene partidos en el rol.')}`;
  }

  function vistaEquipos(t, filas) {
    if (!filas.length) return vacio('Aún no hay equipos registrados en este torneo.');
    return `<div class="equipos">${filas.map(f => {
      const e = f.equipo, F = f.final;
      return `<article class="card eq-card">
        <div class="eq-top">${bdg(e, 'lg')}<div><h3>${esc(e.nombre)}</h3><span class="muted">Lugar ${f.pos} de ${filas.length}</span></div></div>
        <div class="eq-stats">
          <div class="pts"><b>${F.pts}</b><span>Pts</span></div>
          <div><b>${F.pg}</b><span>PG</span></div>
          <div><b>${F.pp}</b><span>PP</span></div>
          <div><b>${signo(F.ds)}</b><span>DS</span></div>
        </div>
        ${e.jugadores.length ? `<ul class="jugadores">${e.jugadores.map(j => `<li>${esc(j)}</li>`).join('')}</ul>` : ''}
        <div><button class="btn sm" data-act="ver-equipo" data-id="${esc(e.id)}">Ver sus partidos</button></div>
      </article>`;
    }).join('')}</div>`;
  }

  /* ---------- render ---------- */
  function pintarActualizado() {
    const el = $('#actualizado'), dot = $('#dot');
    if (st.preview) {
      el.textContent = 'Vista previa · cambios sin publicar';
      dot.className = 'dot prev';
      return;
    }
    if (st.error && !st.data) { el.textContent = 'Sin conexión'; dot.className = 'dot off'; return; }
    const a = st.data && st.data.actualizado;
    el.textContent = a ? `En vivo · actualizado ${P.haceCuanto(a)}` : 'En vivo';
    dot.className = st.error ? 'dot off' : 'dot';
  }

  function render() {
    if (!st.data) {
      $('#contenido').innerHTML = st.error
        ? `<div class="card vacio">${ICO.balon}<p>No se pudieron cargar los datos. Revisa tu conexión.</p><p style="margin-top:12px"><button class="btn" data-act="reintentar">Reintentar</button></p></div>`
        : '<div class="cargando">Cargando…</div>';
      pintarActualizado();
      return;
    }
    const ts = torneosVisibles();
    const t = torneo();
    $('#torneos').innerHTML = ts.length > 1
      ? ts.map(x => `<button type="button" data-torneo="${esc(x.id)}" aria-pressed="${x === t}">${esc(x.nombre)}</button>`).join('')
      : '';

    if (!t) {
      $('#titulo').innerHTML = '<span class="gold-text">Torneos</span>';
      $('#desc').textContent = '';
      $('#vistas').innerHTML = '';
      $('#aviso').innerHTML = '';
      $('#contenido').innerHTML = vacio('Muy pronto publicaremos los torneos.');
      pintarActualizado();
      return;
    }
    st.torneoId = t.id;
    if (st.filtro && !P.equipoPorId(t, st.filtro)) st.filtro = '';
    const filas = P.calcularTabla(t);
    TONOS = P.tonosEquipos(t, filas);

    document.title = `${t.nombre} · Punto 10 Fútbol Tenis`;
    $('#titulo').innerHTML = `<span class="gold-text">${esc(t.nombre)}</span>`;
    $('#desc').textContent = t.descripcion;

    let aviso = '';
    if (st.preview) aviso += `<div class="aviso prev">${ICO.ojo}<div>Estás viendo una <b>vista previa</b> con cambios que aún no se publican. El público todavía no los ve.</div></div>`;
    if (t.aviso.trim()) aviso += `<div class="aviso">${ICO.aviso}<div>${esc(t.aviso.trim())}</div></div>`;
    $('#aviso').innerHTML = aviso;

    $('#vistas').innerHTML = VISTAS.map(([id, nombre]) =>
      `<button type="button" role="tab" data-vista="${id}" aria-selected="${st.vista === id}">${nombre}</button>`).join('');

    $('#contenido').innerHTML = st.vista === 'rol' ? vistaRol(t) : st.vista === 'equipos' ? vistaEquipos(t, filas) : vistaTabla(t, filas);
    pintarActualizado();
    ponerHash();
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-torneo],[data-vista],[data-act]');
    if (!b) return;
    if (b.dataset.torneo) { st.torneoId = b.dataset.torneo; st.filtro = ''; st.todosRes = false; render(); return; }
    if (b.dataset.vista) {
      st.vista = b.dataset.vista;
      render();
      const tabs = $('#vistas');
      if (tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView();
      return;
    }
    const act = b.dataset.act;
    if (act === 'completa') { st.completa = !st.completa; render(); }
    else if (act === 'todos-res') { st.todosRes = !st.todosRes; render(); }
    else if (act === 'ver-equipo') { st.filtro = b.dataset.id; st.vista = 'rol'; render(); $('#vistas').scrollIntoView(); }
    else if (act === 'reintentar') { st.error = null; render(); cargar(); }
    else if (act === 'ir-proxima') {
      ev.preventDefault();
      const el = document.querySelector(b.getAttribute('href'));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'filtro') { st.filtro = ev.target.value; render(); }
  });
  window.addEventListener('hashchange', () => { leerHash(); render(); });
  window.addEventListener('storage', ev => { if (st.preview && ev.key === P.KEY_BORRADOR) cargar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cargar(); });

  leerHash();
  render();
  cargar();
  const cada = Math.max(15, Number(P.CFG.refreshSeconds) || 60) * 1000;
  setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, cada);
  setInterval(pintarActualizado, 30000);
})();
