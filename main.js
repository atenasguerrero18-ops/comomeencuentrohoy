import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore(initializeApp({
  apiKey: "AIzaSyDR2P_E74_p134MphiUUktXGzVvKy4hn1Y",
  authDomain: "como-me-encuentro-hoy.firebaseapp.com",
  projectId: "como-me-encuentro-hoy",
  storageBucket: "como-me-encuentro-hoy.firebasestorage.app",
  messagingSenderId: "541073995310",
  appId: "1:541073995310:web:5f0de7d89242b8606451bf"
}));

const $ = id => document.getElementById(id);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10); // fecha local, no UTC
const avg = a => a.reduce((s, x) => s + x, 0) / a.length, cl = x => Math.max(0, Math.min(100, x));
const num = id => { const v = $(id).value.trim().replace(',', '.'); return v === '' || isNaN(v) ? null : parseFloat(v) };
const FACES = ['😖', '😕', '😐', '🙂', '😄'], sc = {};
let P = null;

function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3000) }
function mkScale(id, faces) { const el = $(id); sc[id] = null; el.innerHTML = ''; for (let i = 1; i <= 5; i++) { const b = document.createElement('button'); b.type = 'button'; b.textContent = faces ? FACES[i - 1] : i; b.setAttribute('aria-label', id + ' ' + i); b.onclick = () => { sc[id] = i; [...el.children].forEach((x, j) => x.classList.toggle('on', j === i - 1)) }; el.appendChild(b) } }
function resetScales() { ['sleepQ', 'body', 'mood', 'feel'].forEach(i => mkScale(i, 1)); ['pain', 'fatigue'].forEach(i => mkScale(i, 0)) }
const userPath = () => ['empresas', P.emp, 'usuarios', P.name];
const norm = d => ({ ...d, date: d.date || d.fecha, sleep: d.sleep ?? (d.sueno || null), hrv: d.hrv > 0 ? d.hrv : null, score: d.score ?? null });

// ---- Ingreso con código de empresa ----
$('btn-ingresar').onclick = async () => {
  const cod = $('codigo').value.trim().toUpperCase(), n = $('nombre').value.trim(), s = $('deporte').value;
  if (!cod || !n || !s) { toast('Escribe el código, tu nombre y tu deporte.'); return }
  if (/\//.test(cod + n)) { toast('El código y el nombre no pueden llevar "/".'); return }
  try {
    // El código se busca en Firestore: codigos/{CÓDIGO} con campos opcionales empresa, fecha (AAAA-MM-DD) y activo
    const cs = await getDoc(doc(db, 'codigos', cod)), cd = cs.exists() ? cs.data() : null;
    if (!cd || cd.activo === false || (cd.fecha && cd.fecha !== today())) { toast('El código no es válido o ya venció.'); return }
    P = { emp: cd.empresa || cod, name: n, sport: s, checks: [], trains: [] };
    const uref = doc(db, ...userPath());
    if ((await getDoc(uref)).exists()) await setDoc(uref, { deporte: s }, { merge: true });
    else await setDoc(uref, { nombre: n, deporte: s, fechaCreacion: new Date().toISOString() });
    const [rs, ts] = await Promise.all([
      getDocs(query(collection(db, ...userPath(), 'registros_diarios'), orderBy('fecha', 'desc'), limit(60))),
      getDocs(query(collection(db, ...userPath(), 'entrenamientos'), orderBy('fecha', 'desc'), limit(120)))]);
    rs.forEach(d => P.checks.push(norm(d.data()))); P.checks.reverse();
    ts.forEach(d => P.trains.push(d.data())); P.trains.reverse();
    $('hello').textContent = 'Hola, ' + n; $('seccion-ingreso').hidden = true; $('app').hidden = false;
    $('cdate').value = $('tdate').value = today(); resetScales(); $('res').hidden = true; go('check');
  } catch (e) { console.error(e); toast('No se pudo conectar con la base de datos.') }
};
$('out').onclick = () => { P = null; $('codigo').value = ''; $('app').hidden = true; $('seccion-ingreso').hidden = false };
function go(v) { ['check', 'train', 'hist'].forEach(k => $('v-' + k).hidden = k !== v); [...$('tabs').children].forEach(b => b.classList.toggle('on', b.dataset.v === v)); if (v === 'hist') render() }
$('tabs').onclick = e => { if (e.target.dataset.v) go(e.target.dataset.v) };

// ---- Cálculo ----
function loads() {
  const t0 = new Date(today() + 'T00:00:00');
  const sum = d => P.trains.filter(x => { const a = (t0 - new Date(x.date + 'T00:00:00')) / 864e5; return a >= 0 && a < d }).reduce((s, x) => s + (x.load || 0), 0);
  const a = sum(7), t = sum(28), c = t / 4; return { a, t, acwr: c > 0 ? a / c : null }
}
function compute(c) {
  const h = P.checks.filter(x => x.date < c.date).slice(-14);
  const base = k => { const v = h.map(x => x[k]).filter(x => x != null); return v.length >= 3 ? avg(v) : null };
  const B = {}; let p = [];
  if (c.hrv != null) { const m = base('hrv'); p.push(m ? cl(75 + (c.hrv / m - 1) * 250) : 65) }
  if (c.rhr != null) { const m = base('rhr'); p.push(m ? cl(75 - (c.rhr - m) * 6) : 65) }
  B.rec = p.length ? avg(p) : null;
  p = []; if (c.sleep != null) p.push(cl((c.sleep - 3) * 20)); if (c.sleepQ) p.push((c.sleepQ - 1) * 25); if (c.frag != null) p.push(cl(100 - c.frag * 12));
  B.sleep = p.length ? avg(p) : null;
  B.mind = c.body && c.mood ? (c.body + c.mood - 2) * 12.5 : null;
  B.pain = c.pain && c.fatigue ? 100 - (c.pain + c.fatigue - 2) * 12.5 : null;
  p = [];
  if (c.spo2 != null) p.push(cl(100 - Math.max(0, 95 - c.spo2) * 20));
  if (c.temp != null) p.push(cl(100 - Math.max(0, Math.abs(c.temp - 36.6) - 0.6) * 60));
  if (c.stress != null) p.push(cl(100 - (c.stress - 1) * 11));
  if (c.glu != null) p.push(c.glu >= 70 && c.glu <= 140 ? 100 : 55);
  if (c.sys != null && c.dia != null) p.push(c.sys >= 90 && c.sys <= 130 && c.dia >= 60 && c.dia <= 85 ? 100 : 55);
  B.band = p.length ? avg(p) : null;
  const W = { rec: .35, sleep: .2, mind: .15, pain: .2, band: .1 }; let s = 0, w = 0;
  for (const k in W) if (B[k] != null) { s += B[k] * W[k]; w += W[k] }
  let score = w ? s / w : 0; const L = loads();
  if (L.acwr > 1.5) score -= 8; else if (L.acwr > 1.3) score -= 4;
  return { score: Math.round(cl(score)), B, acwr: L.acwr }
}
const NAMES = { rec: 'Recuperación', sleep: 'Sueño', mind: 'Cuerpo y ánimo', pain: 'Dolor y fatiga', band: 'Datos de la banda' };
const lvl = s => s >= 75 ? 0 : s >= 50 ? 1 : 2;
const MSG = [['Listo para entrenar', 'Tu cuerpo respondió bien. Puedes seguir tu plan con normalidad.'], ['Entrena con precaución', 'Estás a medio camino. Baja un poco la intensidad o el volumen y escucha tu cuerpo.'], ['Hoy toca recuperar', 'Tus señales piden descanso. Prioriza dormir, hidratarte y una sesión suave o libre.']];
function showResult(r, c) {
  const l = lvl(r.score); $('res').hidden = false;
  [...$('lights').children].forEach((x, i) => x.classList.toggle('on', i === l));
  $('rnum').textContent = r.score; $('rtitle').textContent = MSG[l][0]; $('rtext').textContent = MSG[l][1];
  $('blocks').innerHTML = Object.keys(NAMES).map(k => { const v = r.B[k]; return `<div class="blk"><span>${NAMES[k]}</span><div class="bar"><i style="width:${v == null ? 0 : Math.round(v)}%"></i></div><b>${v == null ? '—' : Math.round(v)}</b></div>` }).join('');
  const t = [];
  if (c.pain >= 4) t.push('Tienes dolor alto: evita cargar fuerte la zona afectada.');
  if (r.acwr > 1.5) t.push('Tu carga de esta semana es mucho mayor que tu promedio (ACWR ' + r.acwr.toFixed(2) + '). Considera bajarla.');
  if (c.phase) t.push('Fase del ciclo registrada: ' + c.phase.toLowerCase() + '. Tenla en cuenta al leer tu recuperación.');
  if (P.checks.filter(x => x.hrv != null).length < 4) t.push('Tu línea base de HRV y pulso se afina después de unos 3 días de registro.');
  $('notes').innerHTML = t.map(x => '<li>' + x + '</li>').join(''); $('res').scrollIntoView();
}

// ---- Guardado en Firestore ----
$('fcheck').onsubmit = async e => {
  e.preventDefault();
  const c = { date: $('cdate').value, hrv: num('hrv'), rhr: num('rhr'), sleep: num('sleep'), frag: num('frag'), spo2: num('spo2'), temp: num('temp'), glu: num('glu'), sys: num('sys'), dia: num('dia'), stress: num('stress'), sleepQ: sc.sleepQ, body: sc.body, mood: sc.mood, pain: sc.pain, fatigue: sc.fatigue, phase: $('phase').value, pday: num('pday') };
  if (!c.date || c.hrv == null || c.rhr == null || c.sleep == null) { toast('Completa fecha, HRV, pulso y horas de sueño.'); return }
  const r = compute(c); c.score = r.score; c.fecha = c.date;
  try {
    await setDoc(doc(db, ...userPath(), 'registros_diarios', c.date), c);
    P.checks = P.checks.filter(x => x.date !== c.date); P.checks.push(c); P.checks.sort((a, b) => a.date < b.date ? -1 : 1);
    showResult(r, c);
  } catch (err) { console.error(err); toast('No se pudo guardar. Revisa tu conexión.') }
};
$('ftrain').onsubmit = async e => {
  e.preventDefault();
  const t = { date: $('tdate').value, type: $('ttype').value, min: num('tmin'), hr: num('thr'), hrmax: num('thrmax'), met: num('tmet'), feel: sc.feel, pain: $('tpain').checked, notes: $('tnotes').value.trim() };
  if (!t.date || !t.min || t.met == null || t.met < 1 || t.met > 10) { toast('Indica fecha, duración y esfuerzo MET entre 1 y 10.'); return }
  t.load = Math.round(t.min * t.met); t.fecha = t.date;
  try {
    await setDoc(doc(db, ...userPath(), 'entrenamientos', t.date + '-' + Date.now()), t);
    P.trains.push(t); P.trains.sort((a, b) => a.date < b.date ? -1 : 1);
    e.target.reset(); mkScale('feel', 1); $('tdate').value = today(); toast('Entrenamiento guardado. Carga: ' + t.load);
  } catch (err) { console.error(err); toast('No se pudo guardar. Revisa tu conexión.') }
};

// ---- Historial ----
function render() {
  const k = P.checks.filter(x => x.score != null);
  $('sdays').textContent = k.length; $('savg').textContent = k.length ? Math.round(avg(k.map(x => x.score))) : '—'; $('slast').textContent = k.length ? k[k.length - 1].date : '—';
  const L = loads(); $('l7').textContent = Math.round(L.a); $('l28').textContent = Math.round(L.t); $('acwr').textContent = L.acwr == null ? '—' : L.acwr.toFixed(2);
  const last = k.slice(-14);
  $('chart').innerHTML = last.length ? '<div class="chart">' + last.map(x => `<div class="col" title="${x.date}: ${x.score}"><i class="c${lvl(x.score)}" style="height:${x.score}%"></i><small>${x.date.slice(8)}</small></div>`).join('') + '</div>' : '<p class="muted">Aún no tienes registros. Haz tu primer chequeo y aparecerá aquí.</p>';
  const hv = P.checks.filter(x => x.hrv != null).slice(-14);
  if (hv.length < 2) $('hrvc').innerHTML = '<p class="muted">Registra al menos 2 días de HRV para ver la curva.</p>';
  else {
    const vs = hv.map(x => x.hrv), m = avg(vs), lo = Math.min(...vs, m) * .9, hi = Math.max(...vs, m) * 1.1, X = i => 10 + i * (280 / (vs.length - 1)), Y = v => 90 - (v - lo) / (hi - lo) * 80;
    $('hrvc').innerHTML = `<svg viewBox="0 0 300 100" role="img" aria-label="HRV de tus últimos días"><line x1="10" x2="290" y1="${Y(m)}" y2="${Y(m)}" stroke="#a39f92" stroke-dasharray="4 4"/><polyline fill="none" stroke="#4b7c59" stroke-width="2.5" stroke-linejoin="round" points="${vs.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>${vs.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="#4b7c59"/>`).join('')}</svg><p class="muted">La línea punteada es tu promedio (${m.toFixed(0)} ms).</p>`
  }
  const ss = P.trains.slice(-8).reverse();
  $('sess').innerHTML = ss.length ? ss.map(x => `<li>${x.date} · ${x.type} · ${x.min} min · carga ${x.load}</li>`).join('') : '<li class="muted">Aún no hay entrenamientos registrados.</li>';
}
resetScales();
