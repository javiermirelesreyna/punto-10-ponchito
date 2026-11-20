/* =====================================================================
   Punto 10 Fútbol Tenis — página pública (también funciona como app instalable)
   ===================================================================== */
(function () {
  'use strict';
  const P = window.P10;
  const esc = P.esc;
  const $ = s => document.querySelector(s);

  const VISTAS = [['tabla', 'Tabla'], ['rol', 'Rol de juegos'], ['equipos', 'Equipos'], ['info', 'Información']];
  const SEMANAS_VISIBLES = 3;
  const st = {
    data: null, firma: '', torneoId: '', vista: 'tabla', filtro: '', todosRes: false,
    preview: new URLSearchParams(location.search).has('borrador'), error: null
  };
  let TONOS = new Map();
  const bdg = (e, cls) => P.badge(e, cls, e ? TONOS.get(e.id) : null);

  const ICO = {
    aviso: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8v18L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    ojo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    balon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L3.5 8.5"/></svg>',
    trofeo: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    doc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    compartir: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'
  };

  /* ---------- datos ---------- */
  const torneosVisibles = () => (st.data ? st.data.torneos.filter(t => t.visible) : []);
  function torneo() {
    const ts = torneosVisibles();
    return ts.find(t => t.id === st.torneoId) || ts.find(t => !t.finalizado) || ts[0] || null;
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
      centro = `<div class="vs">VS</div>${p.hora ? `<div class="hora">${P.fmtHora(p.hora)}</div>` : ''}`;
    }
    const meta = [
      p.fecha ? P.capital(P.fmtFecha(p.fecha)) : 'Fecha por definir',
      r.contado && p.hora ? P.fmtHora(p.hora) : ''
    ].filter(Boolean).join(' · ');
    const cls = (gana, pierde) => (gana ? 'gana' : pierde ? 'pierde' : '');
    return `<div class="partido">
      <div class="p-eq l ${cls(gL, gV)}"><span class="nom">${esc(L ? L.nombre : 'Por definir')}</span>${bdg(L)}</div>
      <div class="marcador">${centro}</div>
      <div class="p-eq v ${cls(gV, gL)}">${bdg(V)}<span class="nom">${esc(V ? V.nombre : 'Por definir')}</span></div>
      <div class="p-meta">${meta}</div>
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
        <td>${racha(f.racha)}</td>
        <td class="c-pts sticky-r">${F.pts}</td>
      </tr>`;
    }).join('');

    const notas = filas.filter(f => f.equipo.notaAjuste)
      .map(f => `<li><b>${esc(f.equipo.nombre)}:</b> ${esc(f.equipo.notaAjuste)}</li>`).join('');

    const campeon = t.finalizado && jugados.length ? filas[0] : null;
    const tarjetaCampeon = campeon ? `<section class="card campeon">
        <div class="trofeo">${ICO.trofeo}</div>
        <div class="campeon-txt"><p class="eyebrow">Campeón</p><h2 class="display gold-text">${esc(campeon.equipo.nombre)}</h2>
        <p class="muted small">${campeon.final.pts} puntos · ${campeon.final.pg} ganados · ${signo(campeon.final.ds)} en sets</p></div>
        ${bdg(campeon.equipo, 'xl')}
      </section>` : '';

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

    return `${tarjetaCampeon}
      <section class="card tabla-card">
        <div class="card-h">
          <h2>${t.finalizado ? 'Tabla final' : 'Tabla de posiciones'}</h2>
          <span class="muted small">${jugados.length} ${jugados.length === 1 ? 'partido jugado' : 'partidos jugados'}</span>
        </div>
        <p class="desliza">Desliza la tabla hacia los lados para ver todas las columnas →</p>
        <div class="tabla-wrap">
          <table class="tabla">
            <thead><tr>
              <th class="c-eq sticky">Equipo</th><th title="Partidos jugados">PJ</th><th title="Partidos ganados">PG</th><th title="Partidos perdidos">PP</th>
              <th title="Sets ganados">SG</th><th title="Sets perdidos">SP</th><th title="Diferencia de sets">DS</th>
              <th>Últimos</th><th class="c-pts sticky-r" title="Puntos en la tabla">PTS</th>
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
      const plantel = e.jugadores.map(j => `<li>
          <span class="jug-foto">${esc(P.iniciales(j.nombre))}${j.foto ? P.imgTag(j.foto, j.nombre) : ''}</span>
          <span class="jug-nom">${esc(j.nombre)}</span>
        </li>`).join('');
      return `<article class="card eq-card${e.foto ? ' con-foto' : ''}">
        ${e.foto ? `<div class="eq-foto">${P.imgTag(e.foto, `Foto de ${e.nombre}`)}</div>` : ''}
        <div class="eq-top">${bdg(e, 'lg')}<div><h3>${esc(e.nombre)}</h3><span class="muted">Lugar ${f.pos} de ${filas.length}</span></div></div>
        <div class="eq-stats">
          <div class="pts"><b>${F.pts}</b><span>Pts</span></div>
          <div><b>${F.pg}</b><span>PG</span></div>
          <div><b>${F.pp}</b><span>PP</span></div>
          <div><b>${signo(F.ds)}</b><span>DS</span></div>
        </div>
        ${plantel ? `<ul class="plantel">${plantel}</ul>` : ''}
        <div><button class="btn sm" data-act="ver-equipo" data-id="${esc(e.id)}">Ver sus partidos</button></div>
      </article>`;
    }).join('')}</div>`;
  }

  function vistaInfo(t) {
    const texto = P.formatoInfo(t.info);
    const imgs = t.infoAdjuntos.filter(a => a.tipo === 'img');
    const pdfs = t.infoAdjuntos.filter(a => a.tipo === 'pdf');
    if (!texto && !t.infoAdjuntos.length) return vacio('Pronto publicaremos el reglamento y la información del torneo.');
    const docs = pdfs.map(a => `<a class="btn" href="${esc(a.ruta)}" target="_blank" rel="noopener"${a.ruta.startsWith('data:') ? ` download="${esc(a.nombre)}.pdf"` : ''}>
        ${ICO.doc} ${esc(a.nombre)} <span class="muted small">PDF</span></a>`).join('');
    const figuras = imgs.map(a => `<figure>
        ${a.ruta.startsWith('data:') ? P.imgTag(a.ruta, a.nombre) : `<a href="${esc(a.ruta)}" target="_blank" rel="noopener">${P.imgTag(a.ruta, a.nombre)}</a>`}
        <figcaption>${esc(a.nombre)}</figcaption>
      </figure>`).join('');
    return `<section class="card info">
      <div class="card-h"><h2>Reglamento e información del torneo</h2></div>
      ${docs ? `<div class="info-docs">${docs}</div>` : ''}
      ${texto ? `<div class="info-texto">${texto}</div>` : ''}
      ${figuras ? `<div class="info-imgs">${figuras}</div>` : ''}
    </section>`;
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
    const sinRed = st.error || navigator.onLine === false;
    el.textContent = sinRed ? `Sin conexión · datos ${a ? 'de ' + P.haceCuanto(a).replace(/^el /, '') : 'guardados'}`
      : a ? `En vivo · actualizado ${P.haceCuanto(a)}` : 'En vivo';
    dot.className = sinRed ? 'dot off' : 'dot';
  }

  function botonTorneo(x, t) {
    return `<button type="button" data-torneo="${esc(x.id)}" aria-pressed="${x === t}">${esc(x.nombre)}</button>`;
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
    const activos = ts.filter(x => !x.finalizado), anteriores = ts.filter(x => x.finalizado);
    $('#torneos').innerHTML = ts.length > 1
      ? activos.map(x => botonTorneo(x, t)).join('') +
        (anteriores.length ? `<span class="seg-sep">Anteriores</span>${anteriores.map(x => botonTorneo(x, t)).join('')}` : '')
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
    $('#desc').textContent = [t.descripcion, t.finalizado ? 'Torneo finalizado' : ''].filter(Boolean).join(' · ');

    let aviso = '';
    if (st.preview) aviso += `<div class="aviso prev">${ICO.ojo}<div>Estás viendo una <b>vista previa</b> con cambios que aún no se publican. El público todavía no los ve.</div></div>`;
    if (t.aviso.trim()) aviso += `<div class="aviso">${ICO.aviso}<div>${esc(t.aviso.trim())}</div></div>`;
    $('#aviso').innerHTML = aviso;

    $('#vistas').innerHTML = VISTAS.map(([id, nombre]) =>
      `<button type="button" role="tab" data-vista="${id}" aria-selected="${st.vista === id}">${nombre}</button>`).join('');
    const pestana = $('#vistas [aria-selected="true"]'), barraTabs = $('#vistas');
    if (pestana && barraTabs.scrollWidth > barraTabs.clientWidth) barraTabs.scrollLeft = Math.max(0, pestana.offsetLeft - 24);

    $('#contenido').innerHTML = st.vista === 'rol' ? vistaRol(t) : st.vista === 'equipos' ? vistaEquipos(t, filas)
      : st.vista === 'info' ? vistaInfo(t) : vistaTabla(t, filas);
    pintarActualizado();
    ponerHash();
  }

  /* ---------- app instalable ---------- */
  let promptInstalar = null;
  const esApp = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function actualizarBotonInstalar() {
    const b = $('#instalar');
    if (b) b.hidden = esApp() || !(promptInstalar || esIOS);
  }

  function ayudaIOS() {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog"><div class="dlg-b">
        <h3>Instalar en iPhone</h3>
        <ol class="pasos">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca el botón <b>Compartir</b> ${ICO.compartir} (abajo en la pantalla).</li>
          <li>Elige <b>Agregar a inicio</b> y luego <b>Agregar</b>.</li>
        </ol>
        <p>Aparecerá el ícono de Punto 10 en tu pantalla de inicio, como cualquier app.</p>
      </div><div class="dlg-f"><button class="btn primary" value="ok">Entendido</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();
  }

  async function instalar() {
    if (promptInstalar) {
      promptInstalar.prompt();
      try { await promptInstalar.userChoice; } catch (e) { /* cancelado */ }
      promptInstalar = null;
      actualizarBotonInstalar();
    } else if (esIOS) {
      ayudaIOS();
    }
  }

  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); promptInstalar = ev; actualizarBotonInstalar(); });
  window.addEventListener('appinstalled', () => { promptInstalar = null; actualizarBotonInstalar(); });

  const usarSW = 'serviceWorker' in navigator &&
    (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'));
  if (usarSW) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ }); });
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
    if (act === 'todos-res') { st.todosRes = !st.todosRes; render(); }
    else if (act === 'instalar') { instalar(); }
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
  window.addEventListener('online', cargar);
  window.addEventListener('offline', pintarActualizado);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cargar(); });

  leerHash();
  render();
  cargar();
  actualizarBotonInstalar();
  const cada = Math.max(15, Number(P.CFG.refreshSeconds) || 60) * 1000;
  setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, cada);
  setInterval(pintarActualizado, 30000);
})();
