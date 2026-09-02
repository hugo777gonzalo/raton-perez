import React, { useState, useMemo, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";

/* ============================================================
   🐭 RATÓN PÉREZ — Demo interactiva
   Mundo del niño (mapa → misión → XP → pista → tesoro) + panel de padres.
   Estado en memoria (sin backend). Un solo archivo, listo para artefacto.
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');

:root{
  --noche:#1E1B3A; --noche2:#332a6b; --pergamino:#F7ECD2; --pergamino2:#EFDDB8;
  --oro:#F5B841; --oro2:#E0912A; --coral:#FF6F61; --menta:#2FBFA0; --menta2:#1e9d82;
  --tinta:#34294F; --crema:#FFF8EC;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.rp-root{font-family:'Nunito',system-ui,sans-serif;color:var(--tinta)}
.rp-stage{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(120% 90% at 50% -10%,#3a2f7d 0%,var(--noche) 60%,#141230 100%);padding:16px}
.rp-phone{width:100%;max-width:430px;min-height:760px;background:var(--noche);border-radius:34px;
  position:relative;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);border:1px solid #4a3f8a}
.rp-fred{font-family:'Fredoka',sans-serif}
.stars{position:absolute;inset:0;pointer-events:none}
.star{position:absolute;background:#fff;border-radius:50%;opacity:.5;animation:tw 3s infinite}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:.9}}
@keyframes pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes rise{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fall{to{transform:translateY(120vh) rotate(540deg)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}

.scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden}
.pad{padding:20px}
.btn{border:none;cursor:pointer;font-family:'Fredoka',sans-serif;font-weight:600;border-radius:18px;
  padding:15px 20px;font-size:17px;width:100%;transition:transform .08s ease, filter .15s}
.btn:active{transform:scale(.97)}
.btn-oro{background:linear-gradient(180deg,var(--oro),var(--oro2));color:#4a2c00;box-shadow:0 6px 0 #b9711d}
.btn-oro:active{box-shadow:0 2px 0 #b9711d;transform:translateY(3px)}
.btn-menta{background:linear-gradient(180deg,var(--menta),var(--menta2));color:#fff;box-shadow:0 6px 0 #157460}
.btn-menta:active{box-shadow:0 2px 0 #157460;transform:translateY(3px)}
.btn-ghost{background:rgba(255,255,255,.08);color:#e9e2ff;border:1px solid rgba(255,255,255,.18)}
.pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);
  color:#fff;border-radius:999px;padding:6px 12px;font-weight:800;font-size:14px}
.card{background:var(--pergamino);border-radius:22px;padding:18px;
  box-shadow:0 10px 24px rgba(0,0,0,.28);border:2px solid var(--pergamino2)}
.hud{display:flex;align-items:center;gap:8px;padding:14px 16px}
.xpbar{height:14px;background:rgba(255,255,255,.15);border-radius:999px;overflow:hidden;flex:1}
.xpfill{height:100%;background:linear-gradient(90deg,var(--menta),var(--oro));border-radius:999px;transition:width .5s ease}
.node{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:28px;border:4px solid #fff3;position:relative;font-family:'Fredoka'}
.node.done{background:linear-gradient(180deg,var(--menta),var(--menta2));box-shadow:0 6px 0 #157460}
.node.now{background:linear-gradient(180deg,var(--oro),var(--oro2));box-shadow:0 6px 0 #b9711d;cursor:pointer;animation:floaty 2.4s infinite}
.node.lock{background:#3a3466;color:#8b83c0;box-shadow:0 6px 0 #26224a}
.opt{background:var(--crema);border:3px solid var(--pergamino2);border-radius:18px;padding:20px;
  font-family:'Fredoka';font-weight:700;font-size:26px;cursor:pointer;text-align:center;transition:transform .1s}
.opt:active{transform:scale(.96)}
.opt.ok{background:var(--menta);color:#fff;border-color:var(--menta2)}
.opt.no{background:#ffd9d4;border-color:var(--coral)}
.mcard{aspect-ratio:1;border-radius:16px;font-size:34px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;background:linear-gradient(160deg,#5a4fa8,#3a2f7d);color:transparent;user-select:none}
.mcard.up{background:var(--crema);color:var(--tinta)}
.mcard.matched{background:var(--menta);color:#fff}
.overlay{position:absolute;inset:0;background:rgba(15,12,40,.82);display:flex;align-items:center;
  justify-content:center;padding:22px;z-index:20;animation:rise .3s}
.confetti{position:absolute;top:-20px;width:10px;height:14px;border-radius:2px;animation:fall linear forwards}
.kpi{background:var(--pergamino);border-radius:16px;padding:14px;text-align:center;border:2px solid var(--pergamino2)}
.kpi b{font-family:'Fredoka';font-size:24px;display:block;color:var(--tinta)}
.kpi span{font-size:12px;color:#7a6f5a;font-weight:700}
.bar{height:10px;background:#e6d8b6;border-radius:999px;overflow:hidden}
.barfill{height:100%;border-radius:999px}
.tab{flex:1;padding:12px;text-align:center;font-family:'Fredoka';font-weight:600;border-radius:14px;cursor:pointer}
.tab.on{background:var(--oro);color:#4a2c00}
.input{width:100%;border:2px solid var(--pergamino2);border-radius:14px;padding:12px;font-family:'Nunito';
  font-weight:700;font-size:15px;background:#fff;color:var(--tinta)}
.mouse{font-size:64px;display:inline-block;animation:floaty 3s infinite;filter:drop-shadow(0 8px 10px rgba(0,0,0,.4))}
.small{font-size:13px;color:#7a6f5a;font-weight:700}
`;

/* ---------------- Datos ---------------- */
const LEVELS = [
  { min: 0, name: "Explorador" }, { min: 150, name: "Aventurero" },
  { min: 400, name: "Inventor" }, { min: 900, name: "Científico" },
  { min: 1800, name: "Maestro del Conocimiento" }, { min: 3000, name: "Sabio Ratón" },
  { min: 5000, name: "Leyenda del Saber" }, { min: 8000, name: "Campeón de Ratón Pérez" },
];
function levelFor(xp, levels = LEVELS) {
  let cur = levels[0], idx = 0;
  levels.forEach((l, i) => { if (xp >= l.min) { cur = l; idx = i; } });
  const next = levels[idx + 1] || null;
  return { name: cur.name, idx, next, toNext: next ? next.min - xp : 0,
    pct: next ? Math.min(100, ((xp - cur.min) / (next.min - cur.min)) * 100) : 100 };
}

// Traduce el enum age_group_t de la base de datos (g1_5_6...) a las
// franjas de edad que usa el cliente ("4-6"...).
const AGE_GROUP_FROM_DB = { g1_5_6: "4-6", g2_7_8: "7-8", g3_9_11: "9-10", g4_12_15: "11-15" };

function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
function avatarFor(age) {
  const n = Number(age);
  if (n && n <= 6) return "🦄";
  if (n && n <= 9) return "🦕";
  return "🚀";
}
// Franja de edad para elegir el banco de actividades correcto
function ageGroupFor(age) {
  if (age == null) return "7-8";
  if (age <= 6) return "4-6";
  if (age <= 8) return "7-8";
  if (age <= 10) return "9-10";
  return "11-15";
}
function buildProfiles(setup) {
  const age = ageFromBirthdate(setup.childBirthdate);
  return {
    child: {
      name: setup.childName,
      age,
      avatar: avatarFor(age),
      theme: `La aventura de ${setup.childName}`,
      accent: "var(--menta)",
      pin: "1234",
    },
  };
}

// Banco de actividades, dividido por franja de edad (age) con dificultad
// y recompensas crecientes. Cada franja tiene 6 misiones (los nodos del mapa).
const ACTS = [
  // ---------- 4-6 años: preescolar, muy simple ----------
  { id: "p1", age: "4-6", cat: "Matemáticas", diff: "easy", type: "choice", q: "2 + 1", options: ["2", "3", "4"], correct: 1, xp: 10, coins: 3 },
  { id: "p2", age: "4-6", cat: "Lógica", diff: "easy", type: "sequence", prompt: "¿Qué color sigue?", seq: ["🔴", "🔵", "🔴", "🔵", "❓"], options: ["🔴", "🔵", "🟢"], correct: 0, xp: 10, coins: 3 },
  { id: "p3", age: "4-6", cat: "Memoria", diff: "easy", type: "memory", pairs: ["🐶", "🐱"], xp: 10, coins: 3 },
  { id: "p4", age: "4-6", cat: "Lectura", diff: "easy", type: "choice", q: "¿Cuál es un animal?", options: ["🚗 Auto", "🐶 Perro", "🍎 Manzana"], correct: 1, xp: 10, coins: 3 },
  { id: "p5", age: "4-6", cat: "Ciencias", diff: "easy", type: "choice", q: "¿De qué color es el sol?", options: ["Azul", "Amarillo", "Verde"], correct: 1, xp: 10, coins: 3 },
  { id: "p6", age: "4-6", cat: "Matemáticas", diff: "easy", type: "choice", q: "¿Cuántas manzanas hay? 🍎🍎🍎", options: ["2", "3", "4"], correct: 1, xp: 10, coins: 3 },

  // ---------- 7-8 años ----------
  { id: "a1", age: "7-8", cat: "Matemáticas", diff: "easy", type: "choice", q: "7 + 5", options: ["10", "12", "13"], correct: 1, xp: 15, coins: 4 },
  { id: "a2", age: "7-8", cat: "Lógica", diff: "medium", type: "sequence", prompt: "¿Qué figura sigue?", seq: ["🔺", "🔵", "🔺", "🔵", "❓"], options: ["🔵", "🔺", "🟡"], correct: 1, xp: 25, coins: 5 },
  { id: "a3", age: "7-8", cat: "Memoria", diff: "medium", type: "memory", pairs: ["🦕", "🚀", "⭐"], xp: 25, coins: 5 },
  { id: "a4", age: "7-8", cat: "Lectura", diff: "easy", type: "choice", q: "¿Cuál es una fruta?", options: ["🐶 Perro", "🍎 Manzana", "🚗 Auto"], correct: 1, xp: 15, coins: 4 },
  { id: "a5", age: "7-8", cat: "Ciencias", diff: "medium", type: "choice", q: "¿Qué planeta es el nuestro?", options: ["Marte", "Tierra", "Júpiter"], correct: 1, xp: 25, coins: 5 },
  { id: "a6", age: "7-8", cat: "Matemáticas", diff: "medium", type: "choice", q: "15 - 6", options: ["8", "9", "10"], correct: 1, xp: 25, coins: 5 },

  // ---------- 9-10 años ----------
  { id: "m1", age: "9-10", cat: "Matemáticas", diff: "medium", type: "choice", q: "9 × 3", options: ["27", "21", "18"], correct: 0, xp: 30, coins: 6 },
  { id: "m2", age: "9-10", cat: "Lógica", diff: "medium", type: "sequence", prompt: "¿Qué número sigue?", seq: ["2", "4", "6", "8", "❓"], options: ["9", "10", "12"], correct: 1, xp: 30, coins: 6 },
  { id: "m3", age: "9-10", cat: "Memoria", diff: "medium", type: "memory", pairs: ["🦕", "🚀", "⭐", "🔬"], xp: 30, coins: 6 },
  { id: "m4", age: "9-10", cat: "Lectura", diff: "medium", type: "choice", q: "Un tren sale a las 3pm y tarda 2 horas. ¿A qué hora llega?", options: ["4pm", "5pm", "6pm"], correct: 1, xp: 30, coins: 6 },
  { id: "m5", age: "9-10", cat: "Ciencias", diff: "medium", type: "choice", q: "¿Cuántos planetas tiene el sistema solar?", options: ["7", "8", "9"], correct: 1, xp: 30, coins: 6 },
  { id: "m6", age: "9-10", cat: "Matemáticas", diff: "hard", type: "choice", q: "12 ÷ 4", options: ["3", "4", "6"], correct: 1, xp: 35, coins: 7 },

  // ---------- 11-15 años ----------
  { id: "h1", age: "11-15", cat: "Matemáticas", diff: "hard", type: "choice", q: "(6 + 4) × 2", options: ["18", "20", "22"], correct: 1, xp: 50, coins: 8 },
  { id: "h2", age: "11-15", cat: "Lógica", diff: "hard", type: "sequence", prompt: "¿Qué número sigue? (Fibonacci)", seq: ["1", "1", "2", "3", "5", "❓"], options: ["7", "8", "9"], correct: 1, xp: 50, coins: 8 },
  { id: "h3", age: "11-15", cat: "Memoria", diff: "hard", type: "memory", pairs: ["🦕", "🚀", "⭐", "🔬", "🎨", "🎵"], xp: 50, coins: 8 },
  { id: "h4", age: "11-15", cat: "Lectura", diff: "hard", type: "choice", q: "Un libro cuesta $15 con 20% de descuento. ¿Cuánto cuesta ahora?", options: ["$10", "$12", "$13"], correct: 1, xp: 50, coins: 8 },
  { id: "h5", age: "11-15", cat: "Ciencias", diff: "hard", type: "choice", q: "¿Cuál es la fórmula química del agua?", options: ["CO2", "H2O", "O2"], correct: 1, xp: 50, coins: 8 },
  { id: "h6", age: "11-15", cat: "Matemáticas", diff: "hard", type: "choice", q: "15% de 200", options: ["20", "30", "45"], correct: 1, xp: 50, coins: 8 },
];

const CLUE_AT = [2, 4, 6]; // misiones completadas para desbloquear pista 1,2,3

/* ---------------- Componentes de juego ---------------- */
function ChoiceGame({ act, onDone }) {
  const [pick, setPick] = useState(null);
  const isSeq = act.type === "sequence";
  const options = act.options;
  return (
    <div>
      <div className="small" style={{ marginBottom: 6 }}>{act.cat} · {act.diff === "easy" ? "Fácil" : act.diff === "medium" ? "Media" : "Difícil"}</div>
      {isSeq ? (
        <>
          <div className="rp-fred" style={{ fontSize: 20, marginBottom: 14 }}>{act.prompt}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", fontSize: 34, marginBottom: 20 }}>
            {act.seq.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </>
      ) : (
        <div className="rp-fred" style={{ fontSize: 34, textAlign: "center", margin: "10px 0 22px" }}>{act.q} = ?</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: options.length > 2 ? "1fr" : "1fr 1fr", gap: 12 }}>
        {options.map((o, i) => {
          const cls = pick == null ? "opt" : i === act.correct ? "opt ok" : i === pick ? "opt no" : "opt";
          return <button key={i} className={cls} disabled={pick != null}
            onClick={() => { setPick(i); setTimeout(() => onDone(i === act.correct), 850); }}>{o}</button>;
        })}
      </div>
      {pick != null && <div className="rp-fred" style={{ textAlign: "center", marginTop: 16, fontSize: 18, color: pick === act.correct ? "var(--menta2)" : "var(--coral)" }}>
        {pick === act.correct ? "¡Correcto! 🎉" : "¡Casi! Sigue intentando 💪"}
      </div>}
    </div>
  );
}

function MemoryGame({ act, onDone }) {
  const deck = useMemo(() => {
    const d = [...act.pairs, ...act.pairs].map((e, i) => ({ id: i, e }));
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }, [act]);
  const [up, setUp] = useState([]);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);
  const flip = (c) => {
    if (busy || up.includes(c.id) || matched.includes(c.e)) return;
    const nu = [...up, c.id];
    setUp(nu);
    if (nu.length === 2) {
      setBusy(true);
      const [a, b] = nu.map((id) => deck.find((x) => x.id === id));
      setTimeout(() => {
        if (a.e === b.e) {
          const nm = [...matched, a.e]; setMatched(nm); setUp([]); setBusy(false);
          if (nm.length === act.pairs.length) setTimeout(() => onDone(true), 500);
        } else { setUp([]); setBusy(false); }
      }, 700);
    }
  };
  return (
    <div>
      <div className="small" style={{ marginBottom: 10 }}>Memoria · Encuentra las parejas</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {deck.map((c) => {
          const shown = up.includes(c.id) || matched.includes(c.e);
          return <div key={c.id} className={"mcard" + (matched.includes(c.e) ? " matched" : shown ? " up" : "")}
            onClick={() => flip(c)}>{shown ? c.e : "🐭"}</div>;
        })}
      </div>
    </div>
  );
}

/* ---------------- App principal ---------------- */
export default function App() {
  const [screen, setScreen] = useState("login"); // login|setup|who|pin|map|play|parent
  const [account, setAccount] = useState(null);  // {provider, label, email}
  const [setup, setSetup] = useState(null);      // {parentName, childName, childBirthdate, hidingPlace}
  const [who, setWho] = useState(null);          // clave de profiles
  const [pinTry, setPinTry] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [oauthError, setOauthError] = useState(null);

  // Supabase adjunta errores de OAuth como parámetros en la URL al volver
  // del redirect (p.ej. "Unable to exchange external code"). Los leemos una
  // vez al cargar y limpiamos la URL para no dejarlos pegados si recargas.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.replace("#", "?"));
    const desc = params.get("error_description");
    if (desc) {
      setOauthError(desc.replace(/\+/g, " "));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const [childId, setChildId] = useState(null); // uuid real del hijo en la BD (children.id)

  // Si hay un proyecto Supabase configurado, revisa si ya existe una sesión
  // (p.ej. al volver del redirect de OAuth) y precarga familia/hijo/tesoro
  // ya guardados, saltándose login/setup.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    async function loadFromSession(session) {
      if (!session || !active) return;
      setAccount({
        provider: session.user.app_metadata?.provider || "supabase",
        label: session.user.email || "tu cuenta",
        email: session.user.email,
      });
      const { data: parentRow } = await supabase
        .from("parents").select("*").eq("auth_user_id", session.user.id).maybeSingle();
      if (!active) return;
      if (!parentRow) { setScreen((s) => (s === "login" ? "setup" : s)); return; }
      const { data: childRow } = await supabase
        .from("children").select("*").eq("family_id", parentRow.family_id).limit(1).maybeSingle();
      const { data: rewardRow } = await supabase
        .from("rewards").select("*").eq("family_id", parentRow.family_id).limit(1).maybeSingle();
      if (!active) return;
      if (!childRow) { setScreen((s) => (s === "login" ? "setup" : s)); return; }
      setChildId(childRow.id);
      setSetup({
        parentName: parentRow.full_name || "",
        childName: childRow.display_name,
        childBirthdate: childRow.birthdate,
        hidingPlace: rewardRow?.hiding_place_note || "",
      });
      setScreen((s) => (s === "login" ? "who" : s));
    }
    supabase.auth.getSession().then(({ data }) => loadFromSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => loadFromSession(session));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Actividades y niveles: si hay Supabase configurado, se cargan desde la
  // base de datos (banco global, family_id null). Si algo falla o no hay
  // backend, se usan los bancos locales ACTS/LEVELS como respaldo.
  const [dbActivities, setDbActivities] = useState(null);
  const [dbLevels, setDbLevels] = useState(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    (async () => {
      const [{ data: levelsData, error: levelsErr }, { data: actsData, error: actsErr }] = await Promise.all([
        supabase.from("levels").select("*").order("order"),
        supabase.from("activities").select("*").is("family_id", null),
      ]);
      if (!active) return;
      if (!levelsErr && levelsData?.length) {
        setDbLevels(levelsData.map((l) => ({ id: l.id, min: l.min_xp, name: l.name })));
      }
      if (!actsErr && actsData?.length) {
        setDbActivities(actsData.map((a) => ({
          id: a.id, // uuid real: se usa como FK en child_activity_attempts / xp_ledger
          age: AGE_GROUP_FROM_DB[a.age_group] || "7-8",
          cat: a.category,
          diff: a.difficulty,
          type: a.type,
          xp: a.xp_reward,
          coins: a.coin_reward,
          ...a.content,
        })));
      }
    })();
    return () => { active = false; };
  }, []);
  const effectiveActs = dbActivities || ACTS;
  const effectiveLevels = dbLevels || LEVELS;

  async function handleLogout() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setAccount(null); setSetup(null); setWho(null); setChildId(null);
    setPinTry(""); setPinErr(false);
    setXp(120); setCoins(24); setDone([]);
    setScreen("login");
  }

  const [xp, setXp] = useState(120);
  const [coins, setCoins] = useState(24);
  const [done, setDone] = useState([]);        // ids de misiones completadas
  const [current, setCurrent] = useState(null);
  const [reward, setReward] = useState({
    title: "Sorpresa de Ratón Pérez",
    clues: [
      "Tu tesoro está en una habitación donde normalmente descansas.",
      "Busca cerca de donde apoyas tu cabeza para soñar.",
      "¡Levanta la almohada! Ahí escondí tu premio. 🎁",
    ],
  });
  const [cluesUnlocked, setCluesUnlocked] = useState(0);
  const [overlay, setOverlay] = useState(null); // {kind, ...}

  // Carga el progreso ya guardado (XP, monedas, misiones completadas) en
  // cuanto se conoce el hijo real y las actividades vienen de la BD (o sea,
  // estamos en modo con backend de verdad, no demo).
  useEffect(() => {
    if (!isSupabaseConfigured || !childId || !dbActivities) return;
    let active = true;
    (async () => {
      const [{ data: stateRow }, { data: attempts }] = await Promise.all([
        supabase.from("child_state").select("*").eq("child_id", childId).maybeSingle(),
        supabase.from("child_activity_attempts").select("activity_id").eq("child_id", childId).eq("status", "completed"),
      ]);
      if (!active) return;
      if (stateRow) { setXp(stateRow.total_xp); setCoins(stateRow.coins); }
      if (attempts) { setDone(attempts.map((a) => a.activity_id)); }
    })();
    return () => { active = false; };
  }, [childId, dbActivities]);

  const profiles = useMemo(() => (setup ? buildProfiles(setup) : {}), [setup]);
  const prof = who ? profiles[who] : null;
  const lvl = levelFor(xp, effectiveLevels);
  const childAgeGroup = ageGroupFor(prof?.age);
  const missions = useMemo(() => effectiveActs.filter((a) => a.age === childAgeGroup), [effectiveActs, childAgeGroup]); // 6 nodos

  // Al completar una misión
  function finishMission(act, success) {
    setScreen("map");
    const gained = success ? act.xp : Math.round(act.xp * 0.4);
    const c = success ? act.coins : 1;
    const newDone = done.includes(act.id) ? done : [...done, act.id];
    const prevLvl = levelFor(xp, effectiveLevels).idx;
    const nextXp = xp + gained;
    setXp(nextXp); setCoins((v) => v + c); setDone(newDone);

    // ¿Sube de nivel?
    const newLevelIdx = levelFor(nextXp, effectiveLevels).idx;
    const leveled = newLevelIdx > prevLvl;

    // Guarda el intento y el progreso en la base de datos (solo si estamos
    // en modo con backend real: hay hijo conocido y las actividades vienen
    // de la BD, así act.id es un uuid válido para las foreign keys).
    if (isSupabaseConfigured && childId && dbActivities) {
      const levelDbId = effectiveLevels[newLevelIdx]?.id;
      supabase.from("child_activity_attempts").insert({
        child_id: childId, activity_id: act.id, status: "completed",
        score: success ? 1 : 0, xp_earned: gained, coins_earned: c,
      }).then(({ error }) => error && console.error("attempt insert:", error));
      supabase.from("xp_ledger").insert([
        { child_id: childId, kind: "xp", amount: gained, reason: "activity", ref_id: act.id },
        { child_id: childId, kind: "coins", amount: c, reason: "activity", ref_id: act.id },
      ]).then(({ error }) => error && console.error("ledger insert:", error));
      supabase.from("child_state").update({
        total_xp: nextXp, coins: coins + c, ...(levelDbId ? { level_id: levelDbId } : {}),
      }).eq("child_id", childId).then(({ error }) => error && console.error("state update:", error));
    }
    // ¿Desbloquea pista?
    const target = CLUE_AT[cluesUnlocked];
    const unlockedClue = target && newDone.length >= target;

    setTimeout(() => {
      if (unlockedClue) {
        const n = cluesUnlocked + 1; setCluesUnlocked(n);
        const isFinal = n >= reward.clues.length;
        setOverlay({ kind: isFinal ? "treasure" : "clue", text: reward.clues[n - 1], n, leveled, gained, c });
      } else if (leveled) {
        setOverlay({ kind: "level", name: levelFor(nextXp, effectiveLevels).name, gained, c });
      } else {
        setOverlay({ kind: "reward", gained, c });
      }
    }, 250);
  }

  /* ---------- Pantallas ---------- */
  const Stars = () => (
    <div className="stars">{Array.from({ length: 26 }).map((_, i) => (
      <span className="star" key={i} style={{
        left: `${(i * 37) % 100}%`, top: `${(i * 53) % 60}%`,
        width: 2 + (i % 3), height: 2 + (i % 3), animationDelay: `${(i % 5) * .6}s`
      }} />))}</div>
  );

  function LoginScreen() {
    const [authing, setAuthing] = useState(false);
    const [authErr, setAuthErr] = useState("");
    const chooseDemo = (provider, label) => {
      setAccount({ provider, label });
      setScreen(setup ? "who" : "setup");
    };
    const chooseReal = async (provider, label) => {
      setAuthErr(""); setAuthing(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider, options: { redirectTo: window.location.origin },
      });
      // Si no hay error, el navegador redirige a Google/Microsoft — la sesión
      // se recoge sola en el useEffect de arriba cuando vuelva.
      if (error) { setAuthing(false); setAuthErr(`No se pudo iniciar sesión con ${label}: ${error.message}`); }
    };
    const choose = (provider, label) => isSupabaseConfigured ? chooseReal(provider, label) : chooseDemo(provider, label);
    return (
      <div className="scroll"><Stars /><div className="pad" style={{ position: "relative" }}>
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <div className="mouse">🐭</div>
          <h1 className="rp-fred" style={{ color: "#fff", fontSize: 30, margin: "6px 0 2px" }}>Ratón Pérez</h1>
          <p style={{ color: "#c9c1f2", fontWeight: 700, marginTop: 0 }}>Inicia sesión para configurar la aventura</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 44 }}>
          <button className="btn" disabled={authing} style={{ background: "#fff", color: "#3c4043", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: authing ? .6 : 1 }}
            onClick={() => choose("google", "Google")}>
            <span className="rp-fred" style={{ fontSize: 18, color: "#4285F4" }}>G</span>
            Continuar con Google
          </button>
          <button className="btn" disabled={authing} style={{ background: "#2f2f2f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: authing ? .6 : 1 }}
            onClick={() => choose("azure", "Outlook")}>
            <span style={{ fontSize: 18 }}>📧</span>
            Continuar con Outlook
          </button>
        </div>
        {(authErr || oauthError) && <p className="small" style={{ textAlign: "center", color: "var(--coral)", marginTop: 14 }}>{authErr || oauthError}</p>}
        <p className="small" style={{ textAlign: "center", color: "#8b83c0", marginTop: 28 }}>
          {isSupabaseConfigured
            ? "Conectado a Supabase: el inicio de sesión es real."
            : "Modo demo: no se conecta a tu cuenta real, solo simula el acceso."}
        </p>
      </div></div>
    );
  }

  function SetupScreen() {
    const [form, setForm] = useState(setup || { parentName: "", childName: "", childBirthdate: "", hidingPlace: "" });
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState("");
    const canSave = form.parentName.trim() && form.childName.trim() && form.childBirthdate && form.hidingPlace.trim();
    const today = new Date().toISOString().slice(0, 10);
    const minDate = new Date(new Date().setFullYear(new Date().getFullYear() - 15)).toISOString().slice(0, 10);
    const save = async () => {
      setSaveErr(""); setSaving(true);
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc("onboard_family", {
          p_parent_name: form.parentName,
          p_parent_email: account?.email || "",
          p_child_name: form.childName,
          p_child_birthdate: form.childBirthdate,
          p_hiding_place: form.hidingPlace,
        });
        if (error) { setSaving(false); setSaveErr("No se pudo guardar: " + error.message); return; }
        if (data?.[0]?.child_id) setChildId(data[0].child_id);
      }
      setSetup(form); setScreen("who"); setSaving(false);
    };
    return (
      <div className="scroll"><Stars /><div className="pad" style={{ position: "relative" }}>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div className="mouse" style={{ fontSize: 44 }}>🐭</div>
          <h2 className="rp-fred" style={{ color: "#fff", margin: "4px 0 2px" }}>Configura la aventura</h2>
          <p className="small" style={{ color: "#c9c1f2" }}>Conectado con {account?.label || "tu cuenta"}</p>
        </div>
        <div className="card" style={{ marginTop: 18 }}>
          <label className="small">Nombre del Padre/Madre</label>
          <input className="input" style={{ margin: "4px 0 14px" }} value={form.parentName}
            onChange={(e) => setForm({ ...form, parentName: e.target.value })} placeholder="Ej. Hugo" />

          <label className="small">Nombre del Hijo/a</label>
          <input className="input" style={{ margin: "4px 0 14px" }} value={form.childName}
            onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="Ej. Mateo" />

          <label className="small">Fecha de nacimiento</label>
          <input className="input" type="date" min={minDate} max={today} style={{ margin: "4px 0 4px" }} value={form.childBirthdate}
            onChange={(e) => setForm({ ...form, childBirthdate: e.target.value })} />
          <p className="small" style={{ marginTop: 0, marginBottom: 14 }}>Se usará para calcular su grupo de edad y ajustar el nivel de los retos.</p>

          <label className="small">Lugar real donde guardarás la recompensa</label>
          <input className="input" style={{ margin: "4px 0 6px" }} value={form.hidingPlace}
            onChange={(e) => setForm({ ...form, hidingPlace: e.target.value })} placeholder="Ej. Depto 302, bajo la almohada" />
          <div style={{ background: "#fff4d6", border: "2px solid var(--oro)", borderRadius: 12, padding: 10, margin: "6px 0 4px" }}>
            <span className="small" style={{ color: "#8a5a00" }}>🛡️ Solo tú ves este dato. Evita lugares peligrosos (enchufes, químicos, exteriores).</span>
          </div>
        </div>
        {saveErr && <p className="small" style={{ textAlign: "center", color: "var(--coral)", marginTop: 10 }}>{saveErr}</p>}
        <button className="btn btn-oro" style={{ marginTop: 18, opacity: canSave && !saving ? 1 : .5 }} disabled={!canSave || saving}
          onClick={save}>{saving ? "Guardando..." : "Guardar y continuar"}</button>
      </div></div>
    );
  }

  function WhoScreen() {
    return (
      <div className="scroll"><Stars /><div className="pad" style={{ position: "relative" }}>
        <div style={{ textAlign: "center", marginTop: 26 }}>
          <div className="mouse">🐭</div>
          <h1 className="rp-fred" style={{ color: "#fff", fontSize: 30, margin: "6px 0 2px" }}>Ratón Pérez</h1>
          <p style={{ color: "#c9c1f2", fontWeight: 700, marginTop: 0 }}>¿Quién va a jugar hoy?</p>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 22 }}>
          {Object.entries(profiles).map(([k, p]) => (
            <button key={k} onClick={() => { setWho(k); setPinTry(""); setScreen("pin"); }}
              style={{ background: "rgba(255,255,255,.08)", border: "2px solid rgba(255,255,255,.18)", borderRadius: 22, padding: "18px 22px", cursor: "pointer", width: 130 }}>
              <div style={{ fontSize: 54 }}>{p.avatar}</div>
              <div className="rp-fred" style={{ color: "#fff", fontSize: 20, marginTop: 4 }}>{p.name}</div>
              <div className="small" style={{ color: "#a99fd8" }}>{p.theme}</div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 34 }}>
          <button className="btn btn-ghost" onClick={() => setScreen("parent")}>🔒 Entrar como Padres</button>
        </div>
        <p className="small" style={{ textAlign: "center", color: "#8b83c0", marginTop: 20 }}>
          Los niños entran con avatar + PIN. Sin correo ni contraseñas. (PIN demo: 1234)
        </p>
      </div></div>
    );
  }

  function PinScreen() {
    const press = (d) => {
      if (pinTry.length >= 4) return;
      const t = pinTry + d; setPinTry(t); setPinErr(false);
      if (t.length === 4) setTimeout(() => {
        if (t === prof.pin) setScreen("map");
        else { setPinErr(true); setPinTry(""); }
      }, 150);
    };
    return (
      <div className="scroll"><Stars /><div className="pad" style={{ position: "relative", textAlign: "center" }}>
        <button className="btn btn-ghost" style={{ width: "auto", padding: "8px 14px", position: "absolute", left: 16, top: 16 }} onClick={() => setScreen("who")}>←</button>
        <div style={{ fontSize: 60, marginTop: 40 }}>{prof.avatar}</div>
        <h2 className="rp-fred" style={{ color: "#fff" }}>Hola, {prof.name}</h2>
        <p style={{ color: "#c9c1f2", fontWeight: 700 }}>Escribe tu PIN secreto</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "16px 0 24px" }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{
            width: 20, height: 20, borderRadius: "50%",
            background: i < pinTry.length ? "var(--oro)" : "rgba(255,255,255,.2)"
          }} />)}
        </div>
        {pinErr && <p style={{ color: "var(--coral)", fontWeight: 800 }}>Ups, intenta otra vez 🙈</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 260, margin: "0 auto" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => k === "" ? <div key={i} /> :
            <button key={i} className="rp-fred" onClick={() => k === "⌫" ? setPinTry(p => p.slice(0, -1)) : press(String(k))}
              style={{ fontSize: 24, padding: "16px 0", borderRadius: 16, border: "none", cursor: "pointer", background: "rgba(255,255,255,.1)", color: "#fff" }}>{k}</button>)}
        </div>
      </div></div>
    );
  }

  function MapScreen() {
    const nextTarget = CLUE_AT[cluesUnlocked] || CLUE_AT[CLUE_AT.length - 1];
    const toClue = Math.max(0, nextTarget - done.length);
    return (
      <div className="scroll">
        <Stars />
        {/* HUD */}
        <div className="hud" style={{ position: "sticky", top: 0, background: "rgba(20,17,48,.9)", backdropFilter: "blur(6px)", zIndex: 5 }}>
          <span style={{ fontSize: 28 }}>{prof.avatar}</span>
          <div style={{ flex: 1 }}>
            <div className="rp-fred" style={{ color: "#fff", fontSize: 15 }}>Nivel {lvl.idx + 1} · {lvl.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <div className="xpbar"><div className="xpfill" style={{ width: `${lvl.pct}%` }} /></div>
              <span className="small" style={{ color: "#c9c1f2" }}>{lvl.next ? `${lvl.toNext} XP` : "MAX"}</span>
            </div>
          </div>
          <span className="pill">🪙 {coins}</span>
        </div>

        <div className="pad" style={{ position: "relative" }}>
          {/* Narrativa de Ratón Pérez */}
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 40 }}>🐭</span>
            <div>
              <div className="rp-fred" style={{ fontSize: 15 }}>{prof.theme}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{prof.name}, resuelve las misiones para ganar la próxima pista de tu tesoro.</div>
            </div>
          </div>
          <div style={{ textAlign: "center", margin: "10px 0" }}>
            <span className="pill" style={{ background: "var(--oro)", color: "#4a2c00" }}>
              🗺️ {toClue === 0 ? "¡Pista lista!" : `${toClue} misión(es) para la próxima pista`}
            </span>
          </div>

          {/* Sendero de misiones (zig-zag) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {missions.map((m, i) => {
              const isDone = done.includes(m.id);
              const firstUndone = missions.findIndex(x => !done.includes(x.id));
              const isNow = i === firstUndone;
              const side = i % 2 === 0 ? "flex-start" : "flex-end";
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: side, alignItems: "center", gap: 12 }}>
                  {i % 2 === 1 && <MissionLabel m={m} isDone={isDone} isNow={isNow} />}
                  <div className={"node " + (isDone ? "done" : isNow ? "now" : "lock")}
                    onClick={() => { if (isNow) { setCurrent(m); setScreen("play"); } }}>
                    {isDone ? "✓" : isNow ? (i + 1) : "🔒"}
                  </div>
                  {i % 2 === 0 && <MissionLabel m={m} isDone={isDone} isNow={isNow} />}
                </div>
              );
            })}
            {/* Tesoro final */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div className="node" style={{ width: 84, height: 84, background: cluesUnlocked >= reward.clues.length ? "linear-gradient(180deg,var(--oro),var(--oro2))" : "#3a3466", fontSize: 40, margin: "0 auto" }}>
                  {cluesUnlocked >= reward.clues.length ? "🎁" : "🗝️"}
                </div>
                <div className="rp-fred" style={{ color: "#fff", marginTop: 6 }}>{reward.title}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={() => setOverlay({ kind: "badges" })}>🎒 Insignias</button>
            <button className="btn btn-ghost" onClick={() => setOverlay({ kind: "shop" })}>🛒 Tienda</button>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setScreen("who")}>Cambiar de jugador</button>
        </div>
      </div>
    );
  }
  function MissionLabel({ m, isDone, isNow }) {
    return (
      <div style={{ maxWidth: 190 }}>
        <div className="rp-fred" style={{ color: isNow ? "#fff" : "#b7aee6", fontSize: 15 }}>{m.cat}</div>
        <div className="small" style={{ color: isDone ? "var(--menta)" : "#8b83c0" }}>
          {isDone ? "Completada ✓" : isNow ? `+${m.xp} XP · toca para jugar` : "Bloqueada"}
        </div>
      </div>
    );
  }

  function PlayScreen() {
    const m = current;
    return (
      <div className="scroll"><Stars />
        <div className="hud"><button className="btn btn-ghost" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setScreen("map")}>←</button>
          <div className="rp-fred" style={{ color: "#fff", flex: 1, textAlign: "center" }}>Misión: {m.cat}</div>
          <span style={{ width: 40 }} /></div>
        <div className="pad">
          <div className="card">
            {m.type === "memory"
              ? <MemoryGame act={m} onDone={(ok) => finishMission(m, ok)} />
              : <ChoiceGame act={m} onDone={(ok) => finishMission(m, ok)} />}
          </div>
          <p className="small" style={{ textAlign: "center", color: "#8b83c0", marginTop: 14 }}>
            Equivocarse no resta. Ratón Pérez quiere que sigas intentando. 🐭
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Overlays ---------- */
  function Confetti() {
    const cols = ["#F5B841", "#FF6F61", "#2FBFA0", "#8B7BF0", "#fff"];
    return <>{Array.from({ length: 40 }).map((_, i) => (
      <span key={i} className="confetti" style={{
        left: `${(i * 2.5) % 100}%`, background: cols[i % cols.length],
        animationDuration: `${1.6 + (i % 5) * .3}s`, animationDelay: `${(i % 7) * .08}s`,
        transform: `rotate(${i * 33}deg)`
      }} />))}</>;
  }
  function Overlay() {
    if (!overlay) return null;
    const o = overlay;
    const close = () => setOverlay(null);
    if (o.kind === "reward") return (
      <div className="overlay" onClick={close}>
        <div style={{ textAlign: "center", animation: "pop .4s" }}>
          <div style={{ fontSize: 66 }}>⭐</div>
          <h2 className="rp-fred" style={{ color: "#fff" }}>¡Misión superada!</h2>
          <p style={{ color: "#ffe9a8", fontWeight: 800, fontSize: 20 }}>+{o.gained} XP · +{o.c} 🪙</p>
          <button className="btn btn-oro" style={{ marginTop: 10, width: 220 }} onClick={close}>¡Seguir!</button>
        </div>
      </div>
    );
    if (o.kind === "level") return (
      <div className="overlay" onClick={close}><Confetti />
        <div style={{ textAlign: "center", animation: "pop .5s" }}>
          <div className="mouse">🐭</div>
          <h2 className="rp-fred" style={{ color: "#fff" }}>¡Subiste de nivel!</h2>
          <div className="pill" style={{ background: "var(--oro)", color: "#4a2c00", fontSize: 18, padding: "10px 18px" }}>{o.name}</div>
          <div><button className="btn btn-oro" style={{ marginTop: 18, width: 220 }} onClick={close}>¡Genial!</button></div>
        </div>
      </div>
    );
    if (o.kind === "clue") return (
      <div className="overlay">
        <div className="card" style={{ maxWidth: 340, textAlign: "center", animation: "pop .4s" }}>
          <div className="mouse">🐭</div>
          <h3 className="rp-fred" style={{ margin: "6px 0" }}>¡Pista {o.n} de Ratón Pérez!</h3>
          <p style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.5 }}>“{o.text}”</p>
          <p className="small" style={{ marginTop: 6 }}>Como cuando dejas un diente bajo la almohada… tu esfuerzo trae recompensa. ✨</p>
          <button className="btn btn-menta" style={{ marginTop: 12 }} onClick={close}>Buscaré en casa 🔦</button>
        </div>
      </div>
    );
    if (o.kind === "treasure") return (
      <div className="overlay"><Confetti />
        <div className="card" style={{ maxWidth: 340, textAlign: "center", animation: "pop .5s" }}>
          <div style={{ fontSize: 66 }}>🎁</div>
          <h2 className="rp-fred" style={{ margin: "4px 0" }}>¡Pista final!</h2>
          <p style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.5 }}>“{o.text}”</p>
          <p className="small" style={{ marginTop: 6 }}>Ratón Pérez escondió: <b style={{ color: "var(--oro2)" }}>{reward.title}</b></p>
          <button className="btn btn-oro" style={{ marginTop: 12 }} onClick={() => { setOverlay({ kind: "found" }); }}>¡Lo encontré! 🎉</button>
        </div>
      </div>
    );
    if (o.kind === "found") return (
      <div className="overlay" onClick={close}><Confetti />
        <div style={{ textAlign: "center", animation: "pop .5s" }}>
          <div className="mouse">🐭</div>
          <h2 className="rp-fred" style={{ color: "#fff" }}>¡Tesoro encontrado!</h2>
          <p style={{ color: "#ffe9a8", fontWeight: 800 }}>{prof.name} completó la aventura 🏆</p>
          <button className="btn btn-oro" style={{ marginTop: 16, width: 220 }} onClick={close}>Cerrar</button>
        </div>
      </div>
    );
    if (o.kind === "badges") {
      const badges = [["👑", "Rey de las Matemáticas"], ["🧠", "Maestro de la Memoria"], ["⚡", "Genio de la Lógica"], ["🌅", "Madrugador"]];
      return <div className="overlay" onClick={close}><div className="card" style={{ maxWidth: 340, animation: "pop .3s" }}>
        <h3 className="rp-fred" style={{ marginTop: 0, textAlign: "center" }}>🎒 Tus insignias</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {badges.map(([ic, n], i) => <div key={i} style={{ textAlign: "center", opacity: i < 2 ? 1 : .4 }}>
            <div style={{ fontSize: 40 }}>{ic}</div><div className="small">{n}{i >= 2 ? " 🔒" : ""}</div></div>)}
        </div>
        <button className="btn btn-menta" style={{ marginTop: 14 }} onClick={close}>Volver</button>
      </div></div>;
    }
    if (o.kind === "shop") {
      const items = [["🔦", "Pista extra", 20], ["🎩", "Sombrero de aventurero", 15], ["🌈", "Fondo de mapa", 12]];
      return <div className="overlay" onClick={close}><div className="card" style={{ maxWidth: 340, animation: "pop .3s" }}>
        <h3 className="rp-fred" style={{ marginTop: 0, textAlign: "center" }}>🛒 Tienda de Ratón Pérez</h3>
        <p className="small" style={{ textAlign: "center" }}>Tienes {coins} 🪙</p>
        {items.map(([ic, n, price], i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--pergamino2)" }}>
          <span style={{ fontSize: 30 }}>{ic}</span><span style={{ flex: 1, fontWeight: 700 }}>{n}</span>
          <button className="btn btn-oro" style={{ width: "auto", padding: "8px 14px", fontSize: 14 }}
            onClick={() => { if (coins >= price) setCoins(c => c - price); }}>{price} 🪙</button>
        </div>)}
        <button className="btn btn-menta" style={{ marginTop: 14 }} onClick={close}>Volver</button>
      </div></div>;
    }
    return null;
  }

  /* ---------- Panel de padres ---------- */
  function ParentScreen() {
    const [tab, setTab] = useState("stats");
    const [editReward, setEditReward] = useState(reward);
    const strengths = [["Matemáticas", 82, "var(--menta)"], ["Lógica", 68, "var(--oro)"], ["Lectura", 40, "var(--coral)"], ["Ciencias", 55, "#8B7BF0"]];
    const childAge = ageFromBirthdate(setup?.childBirthdate);
    return (
      <div className="scroll" style={{ background: "linear-gradient(180deg,#241f4a,#141230)" }}>
        <div className="hud"><button className="btn btn-ghost" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setScreen("who")}>←</button>
          <div className="rp-fred" style={{ color: "#fff", flex: 1, textAlign: "center" }}>Panel de Padres</div><span style={{ width: 40 }} /></div>
        <div className="pad">
          <p className="small" style={{ color: "#8b83c0", marginTop: -4 }}>Hola, {setup?.parentName || "—"} 👋</p>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 40 }}>{avatarFor(childAge)}</span>
            <div><div className="rp-fred" style={{ fontSize: 18 }}>{setup?.childName}{childAge != null ? ` · ${childAge} años` : ""}</div>
              <div className="small">Nivel {lvl.idx + 1} · {lvl.name}</div></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div className={"tab " + (tab === "stats" ? "on" : "")} onClick={() => setTab("stats")} style={{ background: tab === "stats" ? "var(--oro)" : "rgba(255,255,255,.08)", color: tab === "stats" ? "#4a2c00" : "#c9c1f2" }}>Estadísticas</div>
            <div className={"tab " + (tab === "reward" ? "on" : "")} onClick={() => setTab("reward")} style={{ background: tab === "reward" ? "var(--oro)" : "rgba(255,255,255,.08)", color: tab === "reward" ? "#4a2c00" : "#c9c1f2" }}>Recompensa</div>
          </div>

          {tab === "stats" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="kpi"><b>42m</b><span>Tiempo hoy</span></div>
                <div className="kpi"><b>{done.length}</b><span>Actividades</span></div>
                <div className="kpi"><b>{lvl.idx + 1}</b><span>Nivel</span></div>
                <div className="kpi"><b>5 días</b><span>Racha</span></div>
              </div>
              <div className="card" style={{ marginTop: 14 }}>
                <div className="rp-fred" style={{ marginBottom: 10 }}>Rendimiento por materia</div>
                {strengths.map(([n, v, c]) => <div key={n} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}><span>{n}</span><span>{v}%</span></div>
                  <div className="bar"><div className="barfill" style={{ width: `${v}%`, background: c }} /></div>
                </div>)}
                <p className="small" style={{ marginTop: 8 }}>💡 Sugerencia: reforzar <b>Lectura</b> con misiones cortas de comprensión.</p>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="rp-fred" style={{ marginBottom: 10 }}>🎁 Tesoro escondido</div>
              <label className="small">Nombre del premio real</label>
              <input className="input" value={editReward.title} style={{ margin: "4px 0 14px" }}
                onChange={(e) => setEditReward({ ...editReward, title: e.target.value })} />
              <div className="small" style={{ marginBottom: 6 }}>Pistas progresivas (de vaga a específica)</div>
              {editReward.clues.map((c, i) => <input key={i} className="input" value={c} style={{ marginBottom: 8 }}
                onChange={(e) => { const cl = [...editReward.clues]; cl[i] = e.target.value; setEditReward({ ...editReward, clues: cl }); }} />)}
              <div style={{ background: "#fff4d6", border: "2px solid var(--oro)", borderRadius: 12, padding: 10, margin: "6px 0 12px" }}>
                <span className="small" style={{ color: "#8a5a00" }}>🛡️ Seguridad: evita escondites peligrosos (enchufes, químicos, exteriores). Las pistas siempre las escribes y apruebas tú.</span>
              </div>
              <button className="btn btn-menta" onClick={() => { setReward(editReward); alert("¡Tesoro y pistas guardados! Ratón Pérez está listo. 🐭"); }}>Guardar tesoro</button>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "2px solid var(--pergamino2)" }}>
                <div className="small" style={{ marginBottom: 4 }}>📍 Lugar real guardado (solo tú lo ves)</div>
                <div style={{ fontWeight: 700 }}>{setup?.hidingPlace || "—"}</div>
              </div>
            </div>
          )}
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={handleLogout}>Cerrar sesión</button>
          <p className="small" style={{ textAlign: "center", color: "#8b83c0", marginTop: 12 }}>
            Demo: datos en memoria. En producción, protegido con Supabase + RLS.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-root">
      <style>{CSS}</style>
      <div className="rp-stage">
        <div className="rp-phone">
          {screen === "login" && <LoginScreen />}
          {screen === "setup" && <SetupScreen />}
          {screen === "who" && <WhoScreen />}
          {screen === "pin" && <PinScreen />}
          {screen === "map" && <MapScreen />}
          {screen === "play" && <PlayScreen />}
          {screen === "parent" && <ParentScreen />}
          <Overlay />
        </div>
      </div>
    </div>
  );
}
