/* =====================================================================
   Punto 10 Fútbol Tenis — lógica compartida
   Datos, cálculo de la tabla, semanas, fechas y lectura/escritura en GitHub.
   ===================================================================== */
(function () {
  'use strict';

  const CFG = Object.assign(
    { owner: '', repo: '', branch: 'main', dataPath: 'data/torneos.json', refreshSeconds: 60 },
    window.PUNTO10_CONFIG || {}
  );

  const KEY_BORRADOR = 'punto10_borrador';
  const KEY_CONEXION = 'punto10_conexion';

  const REGLAS_DEF = {
    ptsVictoria: 3,    // puntos por partido ganado
    ptsDerrota: 0,     // puntos por partido perdido
    ptsDerrotaWO: 0,   // puntos por perder por W.O. (puede ser negativo)
    setsParaGanar: 3,  // 3 = se juega a ganar 3 de 5 sets
    clasifican: 0      // equipos marcados en zona de clasificación (0 = ninguno)
  };

  // Columnas de la tabla que se pueden ajustar a mano
  const CAMPOS = ['pg', 'pp', 'sg', 'sp'];
  const ESTADOS = ['pendiente', 'jugado', 'wo_local', 'wo_visita', 'pospuesto'];

  /* ---------- utilidades ---------- */
  const uid = () => Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const numONulo = v => (v === '' || v == null || !isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const capital = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'torneo';
  }

  function iniciales(nombre) {
    const p = String(nombre || '?').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
  }

  /** Circulito del equipo. tono: 'oro' (1.º), 'blanco' (último) o 'azul'. */
  function badge(e, cls, tono) {
    return `<span class="badge ${tono || 'azul'} ${cls || ''}" aria-hidden="true">${esc(e ? iniciales(e.nombre) : '?')}</span>`;
  }

  /* ---------- fechas ---------- */
  function fechaLocal(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function isoFecha(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function fmtFecha(s, opts) {
    const d = fechaLocal(s);
    if (!d) return '';
    return d.toLocaleDateString('es-MX', opts || { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  }
  function haceCuanto(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'hace un momento';
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return 'el ' + new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  /* ---------- modelo de datos ---------- */
  function nuevoTorneo(nombre, id) {
    return { id: id || uid(), nombre: nombre || 'Torneo', descripcion: '', aviso: '', visible: true,
      reglas: Object.assign({}, REGLAS_DEF), equipos: [], partidos: [] };
  }

  function datosIniciales() {
    const a = nuevoTorneo('Intersemanal', 'intersemanal');
    a.descripcion = 'Torneo entre semana';
    const b = nuevoTorneo('Sabatino', 'sabatino');
    b.descripcion = 'Torneo de los sábados';
    return normalizar({ version: 2, actualizado: null, torneos: [a, b] });
  }

  function normalizar(d) {
    d = d && typeof d === 'object' ? d : {};
    d.version = 2;
    d.actualizado = d.actualizado || null;
    d.torneos = Array.isArray(d.torneos) ? d.torneos.filter(t => t && typeof t === 'object') : [];
    d.torneos.forEach(t => {
      t.id = String(t.id || uid());
      t.nombre = String(t.nombre || 'Torneo');
      t.descripcion = String(t.descripcion || '');
      t.aviso = String(t.aviso || '');
      t.visible = t.visible !== false;

      const r = Object.assign({}, REGLAS_DEF, t.reglas || {});
      const reglas = {};
      Object.keys(REGLAS_DEF).forEach(k => { reglas[k] = Math.round(num(r[k])); });
      reglas.setsParaGanar = Math.min(9, Math.max(1, reglas.setsParaGanar || 3));
      reglas.clasifican = Math.max(0, reglas.clasifican);
      t.reglas = reglas;

      t.equipos = (Array.isArray(t.equipos) ? t.equipos : []).filter(Boolean).map(e => {
        const viejo = e.ajustes && typeof e.ajustes === 'object' ? e.ajustes : {};
        const fuente = { pg: viejo.pg, pp: viejo.pp, sg: viejo.sg != null ? viejo.sg : viejo.sf, sp: viejo.sp != null ? viejo.sp : viejo.sc, pts: viejo.pts };
        const ajustes = {};
        CAMPOS.concat('pts').forEach(k => { const v = Math.round(num(fuente[k])); if (v) ajustes[k] = v; });
        return {
          id: String(e.id || uid()),
          nombre: String(e.nombre || 'Equipo'),
          jugadores: Array.isArray(e.jugadores) ? e.jugadores.map(String).filter(s => s.trim()) : [],
          ajustes,
          notaAjuste: String(e.notaAjuste || '')
        };
      });

      // Formato anterior (jornadas numeradas) → lista de partidos por fecha
      const crudos = Array.isArray(t.partidos) ? t.partidos.slice() : [];
      if (Array.isArray(t.jornadas)) {
        t.jornadas.forEach(j => (j && Array.isArray(j.partidos) ? j.partidos : []).forEach(p => {
          crudos.push(Object.assign({}, p, { fecha: p.fecha || j.fecha }));
        }));
      }
      delete t.jornadas;

      t.partidos = crudos.filter(p => p && typeof p === 'object').map(p => {
        let sl = numONulo(p.sl), sv = numONulo(p.sv);
        if (sl == null && sv == null && Array.isArray(p.sets) && p.sets.length) {
          sl = 0; sv = 0;
          p.sets.forEach(s => { if (Array.isArray(s) && num(s[0]) > num(s[1])) sl++; else if (Array.isArray(s) && num(s[1]) > num(s[0])) sv++; });
        }
        return {
          id: String(p.id || uid()),
          local: String(p.local || ''),
          visita: String(p.visita || ''),
          fecha: /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') ? p.fecha : '',
          estado: ESTADOS.includes(p.estado) ? p.estado : 'pendiente',
          sl, sv
        };
      });
    });
    return d;
  }

  /* ---------- resultados y tabla ---------- */
  function resultado(p, reglas) {
    const out = { contado: false, wo: false, invalido: false, sl: 0, sv: 0, ganador: null };
    if (!p || !p.local || !p.visita || p.local === p.visita) return out;
    const g = reglas.setsParaGanar || 3;

    if (p.estado === 'wo_local' || p.estado === 'wo_visita') {
      const gL = p.estado === 'wo_local';
      return Object.assign(out, { contado: true, wo: true, ganador: gL ? 'local' : 'visita', sl: gL ? g : 0, sv: gL ? 0 : g });
    }
    if (p.estado !== 'jugado' || p.sl == null || p.sv == null) return out;
    const valido = (p.sl === g && p.sv < g) || (p.sv === g && p.sl < g);
    if (!valido) { out.invalido = true; return out; }
    return Object.assign(out, { contado: true, sl: p.sl, sv: p.sv, ganador: p.sl > p.sv ? 'local' : 'visita' });
  }

  /** Partidos ordenados por fecha; con `recientes` el más reciente va primero. Sin fecha, al final. */
  function partidosOrdenados(t, lista, recientes) {
    return (lista || t.partidos).map((p, i) => [p, i]).sort((a, b) => {
      const fa = a[0].fecha, fb = b[0].fecha;
      if (!fa !== !fb) return !fa ? 1 : -1;
      const c = (fa || '').localeCompare(fb || '');
      return (recientes ? -c : c) || a[1] - b[1];
    }).map(x => x[0]);
  }

  const equipoPorId = (t, id) => t.equipos.find(e => e.id === id) || null;

  /** Tabla: resultados capturados + ajustes manuales. */
  function calcularTabla(t) {
    const r = t.reglas;
    const filas = t.equipos.map(e => ({ equipo: e, auto: { pg: 0, pp: 0, sg: 0, sp: 0, woPerdidos: 0 }, racha: [] }));
    const idx = new Map(filas.map(f => [f.equipo.id, f]));

    partidosOrdenados(t).forEach(p => {
      const res = resultado(p, r);
      if (!res.contado) return;
      const L = idx.get(p.local), V = idx.get(p.visita);
      if (!L || !V) return;
      L.auto.sg += res.sl; L.auto.sp += res.sv;
      V.auto.sg += res.sv; V.auto.sp += res.sl;
      const [G, X] = res.ganador === 'local' ? [L, V] : [V, L];
      G.auto.pg++; X.auto.pp++;
      G.racha.push('G'); X.racha.push('P');
      if (res.wo) X.auto.woPerdidos++;
    });

    filas.forEach(f => {
      const a = f.equipo.ajustes || {};
      const fin = {};
      CAMPOS.forEach(k => { fin[k] = f.auto[k] + num(a[k]); });
      fin.pj = fin.pg + fin.pp;
      fin.ds = fin.sg - fin.sp;
      f.ptsSinAjuste = fin.pg * r.ptsVictoria + fin.pp * r.ptsDerrota + f.auto.woPerdidos * (r.ptsDerrotaWO - r.ptsDerrota);
      fin.pts = f.ptsSinAjuste + num(a.pts);
      f.final = fin;
      f.racha = f.racha.slice(-5);
      f.tieneAjuste = CAMPOS.concat('pts').some(k => num(a[k]) !== 0);
    });

    filas.sort((x, y) =>
      y.final.pts - x.final.pts ||
      y.final.ds - x.final.ds ||
      y.final.sg - x.final.sg ||
      y.final.pg - x.final.pg ||
      x.equipo.nombre.localeCompare(y.equipo.nombre, 'es'));
    filas.forEach((f, i) => { f.pos = i + 1; });
    return filas;
  }

  /** Color del circulito según la posición: 1.º dorado, último blanco, los demás azules. */
  function tonosEquipos(t, filas) {
    filas = filas || calcularTabla(t);
    const arranco = filas.some(f => f.final.pj || f.final.pts);
    const m = new Map();
    filas.forEach((f, i) => {
      let tono = 'azul';
      if (arranco && i === 0) tono = 'oro';
      else if (arranco && i === filas.length - 1 && filas.length > 1) tono = 'blanco';
      m.set(f.equipo.id, tono);
    });
    return m;
  }

  /* ---------- jornadas por semana ---------- */
  function lunesDe(s) {
    const d = fechaLocal(s);
    if (!d) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoFecha(d);
  }

  /** ¿Todos los partidos del torneo caen en el mismo día de la semana? (ej. sabatino) */
  function unSoloDia(t) {
    const dias = new Set(t.partidos.map(p => fechaLocal(p.fecha)).filter(Boolean).map(d => d.getDay()));
    return dias.size === 1;
  }

  function tituloSemana(clave, ps, mismoDia) {
    if (!clave) return 'Fecha por definir';
    const fechas = [...new Set(ps.map(p => p.fecha).filter(Boolean))].sort();
    if (mismoDia && fechas.length === 1) return capital(fmtFecha(fechas[0], { weekday: 'long', day: 'numeric', month: 'long' }));
    const ini = fechaLocal(clave), fin = fechaLocal(clave);
    const finde = fechas.some(f => { const g = fechaLocal(f).getDay(); return g === 0 || g === 6; });
    fin.setDate(fin.getDate() + (finde ? 6 : 4));
    const mes = d => d.toLocaleDateString('es-MX', { month: 'long' });
    return mes(ini) === mes(fin)
      ? `Semana del ${ini.getDate()} al ${fin.getDate()} de ${mes(fin)}`
      : `Semana del ${ini.getDate()} de ${mes(ini)} al ${fin.getDate()} de ${mes(fin)}`;
  }

  /** Agrupa los partidos por semana (lunes a domingo). Con `recientes`, la semana y el partido más recientes van primero. */
  function agruparSemanas(t, lista, recientes) {
    const ps = partidosOrdenados(t, lista, recientes);
    const mapa = new Map();
    ps.forEach(p => { const k = lunesDe(p.fecha); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(p); });
    const mismoDia = unSoloDia(t);
    return [...mapa.keys()]
      .sort((a, b) => (!a ? 1 : !b ? -1 : recientes ? b.localeCompare(a) : a.localeCompare(b)))
      .map(k => ({ clave: k, partidos: mapa.get(k), titulo: tituloSemana(k, mapa.get(k), mismoDia) }));
  }

  function estadoGrupo(t, ps) {
    const validos = ps.filter(p => p.local && p.visita && p.estado !== 'pospuesto');
    if (!validos.length) return ps.length ? 'pospuesta' : 'vacia';
    const hechos = validos.filter(p => resultado(p, t.reglas).contado).length;
    if (hechos === validos.length) return 'jugada';
    return hechos ? 'en-curso' : 'pendiente';
  }

  /* ---------- base64 con acentos ---------- */
  function b64Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64Decode(b64) {
    const bin = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- GitHub ---------- */
  function detectarRepo() {
    let owner = CFG.owner, repo = CFG.repo;
    const host = location.hostname;
    if (host.endsWith('.github.io')) {
      if (!owner) owner = host.slice(0, -'.github.io'.length);
      if (!repo) {
        const seg = location.pathname.split('/').filter(Boolean)[0];
        repo = seg && !seg.includes('.') ? seg : host;
      }
    }
    return { owner: owner || '', repo: repo || '', branch: CFG.branch || 'main', dataPath: CFG.dataPath };
  }

  function urlContenido(repo) {
    const ruta = String(repo.dataPath || CFG.dataPath).split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${ruta}`;
  }

  async function errorDe(r) {
    let msg = `Error ${r.status}`;
    try { const j = await r.json(); if (j && j.message) msg = j.message; } catch (e) { /* sin cuerpo */ }
    const e = new Error(msg);
    e.status = r.status;
    return e;
  }

  let apiPublicaDisponible = true;

  async function leerGitHub(repo, token) {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(`${urlContenido(repo)}?ref=${encodeURIComponent(repo.branch || 'main')}`,
      { headers, cache: token ? 'no-store' : 'no-cache' });
    const rest = r.headers.get('x-ratelimit-remaining');
    if (!token && rest !== null && Number(rest) < 5) apiPublicaDisponible = false;
    if (!r.ok) throw await errorDe(r);
    const j = await r.json();
    return { sha: j.sha, data: JSON.parse(b64Decode(j.content)) };
  }

  async function escribirGitHub(repo, token, contenido, sha, mensaje) {
    const body = { message: mensaje, content: b64Encode(contenido), branch: repo.branch || 'main' };
    if (sha) body.sha = sha;
    const r = await fetch(urlContenido(repo), {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw await errorDe(r);
    const j = await r.json();
    return j.content && j.content.sha;
  }

  async function verificarRepo(repo, token) {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }, cache: 'no-store'
    });
    if (!r.ok) throw await errorDe(r);
    return r.json();
  }

  async function leerArchivoLocal() {
    try {
      const r = await fetch(`${CFG.dataPath}?t=${Date.now()}`, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }

  /** Página pública: toma la versión más reciente entre el sitio y la API de GitHub. */
  async function cargarDatosPublicos() {
    const tareas = [leerArchivoLocal()];
    const repo = detectarRepo();
    if (repo.owner && repo.repo && apiPublicaDisponible) {
      tareas.push(leerGitHub(repo).then(x => x.data).catch(() => null));
    }
    const res = (await Promise.all(tareas)).filter(Boolean);
    if (!res.length) throw new Error('No se pudieron cargar los datos.');
    res.sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')));
    return res[0];
  }

  /* ---------- almacenamiento local ---------- */
  function leerLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function guardarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function borrarLS(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  window.P10 = {
    CFG, REGLAS_DEF, CAMPOS, KEY_BORRADOR, KEY_CONEXION,
    uid, num, numONulo, esc, capital, slug, iniciales, badge,
    fechaLocal, isoFecha, fmtFecha, haceCuanto,
    nuevoTorneo, datosIniciales, normalizar,
    resultado, partidosOrdenados, equipoPorId, calcularTabla, tonosEquipos,
    lunesDe, agruparSemanas, estadoGrupo,
    b64Encode, b64Decode,
    detectarRepo, leerGitHub, escribirGitHub, verificarRepo, leerArchivoLocal, cargarDatosPublicos,
    leerBorrador: () => leerLS(KEY_BORRADOR),
    guardarBorrador: v => guardarLS(KEY_BORRADOR, v),
    borrarBorrador: () => borrarLS(KEY_BORRADOR),
    leerConexion: () => leerLS(KEY_CONEXION),
    guardarConexion: v => guardarLS(KEY_CONEXION, v),
    borrarConexion: () => borrarLS(KEY_CONEXION)
  };
})();
