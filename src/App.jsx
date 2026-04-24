import { useState, useEffect, useRef } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";
import { PLAN_PROMPT } from "./planPrompt";
import { FOLLOWUP_PROMPT } from "./followupPrompt";
import { SCREENTIME_PROMPT } from "./screentimePrompt";

// ═══════════════════════════════════════
// DESIGN — Abloh × Müller
// ═══════════════════════════════════════
const F = { display: "'Bebas Neue', sans-serif", mono: "'IBM Plex Mono', monospace", serif: "'Cormorant Garamond', Georgia, serif" };
const C = { bg: "#F5F0E8", card: "#FDFBF7", ink: "#1A1A1A", orange: "#E85D2B", muted: "#999999", border: "#E0DCD4", light: "#F0ECE4" };

// ═══════════════════════════════════════
// DIMENSION INFO
// ═══════════════════════════════════════
const DIM_INFO = {
  dop: { n: "Reward patterns", desc: "How much your phone pulls you back — the compulsive checking, the craving, the need for more to feel the same. This is the dependency pattern." },
  att: { n: "Attention continuity", desc: "How fragmented your focus has become. How long you can sit with one thing before reaching for a screen. The cost of constant interruption." },
  emo: { n: "Emotional coping", desc: "Using screens to avoid feeling something — stress, boredom, silence, loneliness. The phone as a comfort blanket you never put down." },
  env: { n: "Environment & defaults", desc: "How your physical space and device settings work against you. The charger by the bed. Autoplay on. Notifications never configured." },
  val: { n: "Values alignment", desc: "The gap between what you say matters most and how you actually spend your hours. When the gap is big, something's off." },
  drn: { n: "Time & money drain", desc: "What's bleeding out through subscriptions you forgot, hours you can't account for, purchases you didn't mean to make." },
  num: { n: "The actual number", desc: "The hours you actually spend looking at your phone. Not what you think. Not what you guess. What your phone says. This is the one dimension that cannot lie." },
};

// Apps known to be designed for maximum engagement — these get score amplification
const SOCIAL_APPS = ["tiktok","instagram","facebook","twitter","x","snapchat","threads","reddit","youtube","pinterest","linkedin"];

// ═══════════════════════════════════════
// LOADING QUOTES
// ═══════════════════════════════════════
const LOADING_QUOTES = [
  { q: "The apps on your phone had 10,000 engineers. You had willpower. That was never a fair fight.", a: "Noorah" },
  { q: "Most people don't own their attention. They rent it out, 23 minutes at a time.", a: "Noorah" },
  { q: "Nobody scrolls for 3 hours because they love scrolling. They scroll because something else feels too hard to sit with.", a: "Noorah" },
  { q: "You know what silence is? It's not empty. It's where everything you've been running from has been waiting for you.", a: "Noorah" },
  { q: "Trying and failing doesn't mean you can't do this. It means you've been practicing. Now you have a map.", a: "Noorah" },
  { q: "The phone isn't the problem. The absence is. The phone is just the part you can point to.", a: "Noorah" },
  { q: "Kids don't complain about things they've given up on. They're still asking for you.", a: "Noorah" },
  { q: "Your hands will reach for something that isn't there. That's not a relapse. That's the start.", a: "Noorah" },
];

// ═══════════════════════════════════════
// QUIZ — 10 MOM TEST QUESTIONS
// ═══════════════════════════════════════
const Q = {
  // PART 1 — YOUR PATTERN
  p1_lastnight: { t: "What was the last thing you did last night before you closed your eyes?", type: "text", part: 1 },
  p1_location: { t: "Your phone right now — where is it?", o: ["In my hand", "Within arm's reach", "In this room but not close", "In another room entirely"], s: [5,3,1,0], d: "dop", part: 1 },
  p1_pickups: { t: "Yesterday — roughly how many times did you pick up your phone just to check?", o: ["Fewer than 10", "20 to 50", "50 to 100", "I honestly have no idea"], s: [0,2,4,6], d: "dop", part: 1 },
  p1_focus: { t: "When was the last time you finished a movie, chapter, or real conversation without checking your phone once?", o: ["This week", "This month", "I can't remember", "I don't know if I ever do"], s: [0,2,4,6], d: "att", part: 1 },
  p1_reach: { t: "When something hard happens — stress, boredom, loneliness — how often does your first instinct tell you to grab your phone?", o: ["Rarely, I reach for something else", "Sometimes, it's a coin flip", "Most of the time", "Always, before I even think about it"], s: [0,2,4,6], d: "emo", part: 1 },

  // PART 2 — YOUR LIFE
  p2_bedtime: { t: "Last night when you got into bed — where was your phone?", o: ["In another room", "In my room but across the room", "On my nightstand, face-down", "On my nightstand or in my bed with me"], s: [0,1,3,5], d: "env", part: 2 },
  p2_screentime: { t: "Let's look at your actual screen time. What does yesterday tell us?", type: "screentime", part: 2 },
  p2_spend: { t: "In the last month, roughly how much did you spend on things your phone showed you — ads, impulse buys, subscriptions?", o: ["Under $20", "$20 to $100", "$100 to $300", "More than $300 — or I don't want to know"], s: [0,2,4,6], d: "drn", part: 2 },
  p2_analog: { t: "Something you used to do off your phone that you miss. What was it?", type: "text", part: 2 },
  p2_context: { t: "Who are you doing this for? And what's your work setup?", type: "double", o1: ["Alone", "With partner", "With family/kids", "With roommates"], o2: ["Fully remote", "Hybrid", "In-office", "Not currently working"], part: 2 },
};

const QUIZ_ORDER = ["p1_lastnight","p1_location","p1_pickups","p1_focus","p1_reach","p2_bedtime","p2_screentime","p2_spend","p2_analog","p2_context"];
const DIM = {
  dop: {n:"Reward patterns",x:25},
  att: {n:"Attention continuity",x:20},
  emo: {n:"Emotional coping",x:20},
  env: {n:"Environment & defaults",x:15},
  val: {n:"Values alignment",x:10},
  drn: {n:"Time & money drain",x:10},
  num: {n:"The actual number",x:20}, // Only shown if screen time is provided
};

function calc(a, screentimeData) {
  const hasScreentime = screentimeData?.valid && screentimeData.total_minutes > 0;
  const dimKeys = hasScreentime ? Object.keys(DIM) : Object.keys(DIM).filter(k => k !== "num");
  const dims = {};
  dimKeys.forEach(k => dims[k] = {raw:0, max:DIM[k].x});

  // Score button answers into their dimensions
  Object.entries(a).forEach(([id, v]) => {
    const q = Q[id];
    if (!q || q.type === "text" || q.type === "double" || q.type === "screentime") return;
    const s = q.s?.[v] || 0;
    if (q.d && dims[q.d]) dims[q.d].raw += s;
  });

  // Scale raw button scores to dimension max
  // dop: p1_location (5) + p1_pickups (6) = 11 max → 25
  // att: p1_focus (6) = 6 max → 20
  // emo: p1_reach (6) = 6 max → 20
  // env: p2_bedtime (5) = 5 max → 15
  // drn: p2_spend (6) = 6 max → 10
  dims.dop.raw = Math.round(dims.dop.raw * (25 / 11));
  dims.att.raw = Math.round(dims.att.raw * (20 / 6));
  dims.emo.raw = Math.round(dims.emo.raw * (20 / 6));
  dims.env.raw = Math.round(dims.env.raw * (15 / 5));
  dims.drn.raw = Math.round(dims.drn.raw * (10 / 6));

  // Baseline for values dimension (not directly asked)
  // Use screen time to calibrate if available, else use conservative default
  if (hasScreentime) {
    const hours = screentimeData.total_minutes / 60; // Always daily (average if weekly view)
    const isWeeklyView = screentimeData.view_type === "weekly";
    const topApps = (screentimeData.top_apps || []).map(a => (a.name || "").toLowerCase());
    const hasSocialHeavy = topApps.some(name => SOCIAL_APPS.some(s => name.includes(s)));
    // App minutes in top_apps: if weekly view, these are WEEKLY totals — convert to daily for thresholds
    const topAppMinutesRaw = (screentimeData.top_apps?.[0]?.minutes || 0);
    const topAppMinutesDaily = isWeeklyView ? topAppMinutesRaw / 7 : topAppMinutesRaw;

    // Dimension 7 — The Actual Number (drives 0-20 based on pure daily hours)
    if (hours >= 8) dims.num.raw = 20;
    else if (hours >= 6) dims.num.raw = 18;
    else if (hours >= 4) dims.num.raw = 14;
    else if (hours >= 2) dims.num.raw = 8;
    else dims.num.raw = 2;

    // Values alignment: only this dimension is inferred now (not directly asked)
    // The gap between values and behavior grows with hours on phone
    if (hours >= 8) dims.val.raw = 8;
    else if (hours >= 5) dims.val.raw = 6;
    else if (hours >= 3) dims.val.raw = 4;
    else dims.val.raw = 2;

    // ═══ INTELLIGENT BOOSTS ═══
    // Social-heavy usage at 3+ hours daily → boost reward patterns (addictive apps)
    if (hasSocialHeavy && hours >= 3) dims.dop.raw = Math.min(dims.dop.raw + Math.round(dims.dop.raw * 0.4), 25);
    // One app dominating daily (3+ hours per day on top app) → boost emotional coping
    if (topAppMinutesDaily >= 180) dims.emo.raw = Math.min(dims.emo.raw + Math.round(dims.emo.raw * 0.3), 20);
    // 6+ hours total daily → boost attention fragmentation
    if (hours >= 6) dims.att.raw = Math.min(dims.att.raw + Math.round(dims.att.raw * 0.25), 20);

    // ═══ HONESTY CHECK — data vs button answers ═══
    // If their button said "fewer than 10 pickups" but screen time shows heavy usage — boost reward patterns
    if (a.p1_pickups === 0 && hours >= 4) dims.dop.raw = Math.min(25, dims.dop.raw + 5);
    // If they said "last uninterrupted focus this week" but screen time is 6+ hours — boost attention
    if (a.p1_focus === 0 && hours >= 6) dims.att.raw = Math.min(20, dims.att.raw + 4);
    // If they said they "rarely" reach for phone when stressed but usage is heavy — boost emo
    if (a.p1_reach === 0 && hours >= 5) dims.emo.raw = Math.min(20, dims.emo.raw + 4);
  } else {
    // No screen time uploaded — conservative default for values dimension only
    dims.val.raw = 5;
  }

  // Cap everything to max
  Object.keys(dims).forEach(k => { dims[k].raw = Math.min(dims[k].raw, dims[k].max); });

  const total = Object.values(dims).reduce((s, d) => s + d.raw, 0);
  const maxPossible = Object.values(dims).reduce((s, d) => s + d.max, 0);
  const normalizedTotal = Math.round((total / maxPossible) * 100);

  const sev = normalizedTotal <= 25 ? "Minimal" : normalizedTotal <= 45 ? "Moderate" : normalizedTotal <= 65 ? "Significant" : "Critical";
  const fast = normalizedTotal <= 25 ? "Level 1 (3 days)" : normalizedTotal <= 45 ? "Levels 1-2 (7 days)" : normalizedTotal <= 65 ? "Levels 1-3 (14 days)" : "Full protocol (14+ days)";
  const top = Object.entries(dims).sort((a,b) => (b[1].raw / b[1].max) - (a[1].raw / a[1].max))[0][0];
  return {total: normalizedTotal, dims, mk:{tolerance:0,withdrawal:0,imbalance:0,honesty:0}, sev, fast, top, dataVerified: hasScreentime};
}

function cleanText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")      // remove bold
    .replace(/\*(.+?)\*/g, "$1")          // remove italic
    .replace(/^####+\s*/gm, "")           // remove h4+ (but keep ### h3)
    .replace(/^—+$/gm, "")                // remove divider lines
    .trim();
}

const Lbl = ({children, orange, style}) => <span style={{fontFamily:F.mono, fontSize:10, letterSpacing:3, textTransform:"uppercase", color:orange?C.orange:C.muted, fontWeight:500, ...style}}>{children}</span>;
const Quote = ({children}) => <><span style={{color:C.orange, fontWeight:600}}>"</span>{children}<span style={{color:C.orange, fontWeight:600}}>"</span></>;

function DimRow({ dimKey, rank, val, isTop }) {
  const [hover, setHover] = useState(false);
  const info = DIM_INFO[dimKey];
  return (
    <div style={{position:"relative"}}>
      <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onClick={()=>setHover(!hover)} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`0.5px solid ${C.border}`, cursor:"help"}}>
        <span style={{fontFamily:F.mono, fontSize:10, color:C.orange, fontWeight:600, minWidth:20}}>{String(rank).padStart(2,"0")}</span>
        <span style={{fontFamily:F.mono, fontSize:10, color:C.muted}}>→</span>
        <span style={{fontFamily:F.mono, fontSize:11, letterSpacing:1, textTransform:"uppercase", flex:1, borderBottom:hover?`1px dotted ${C.orange}`:"none", paddingBottom:1}}>{info.n}</span>
        <div style={{width:100, height:4, background:C.border, flexShrink:0}}><div style={{height:4, background:isTop?C.orange:C.ink, width:`${(val.raw/val.max)*100}%`, transition:"width .8s"}}/></div>
        <span style={{fontFamily:F.mono, fontSize:11, color:C.muted, minWidth:36, textAlign:"right"}}>{val.raw}/{val.max}</span>
      </div>
      {hover && (<div style={{position:"absolute", top:"100%", left:0, right:0, zIndex:10, background:C.ink, color:C.bg, padding:"12px 16px", fontFamily:F.serif, fontSize:13, lineHeight:1.6, marginTop:-1, boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><Lbl orange style={{display:"block", marginBottom:6, color:C.orange}}>{info.n}</Lbl>{info.desc}</div>)}
    </div>
  );
}

function PlanDim({ dimKey, score, max }) {
  const [hover, setHover] = useState(false);
  const info = DIM_INFO[dimKey];
  return (
    <div style={{position:"relative", display:"inline"}}>
      <span onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onClick={()=>setHover(!hover)} style={{cursor:"help", borderBottom:`1px dotted ${C.orange}`, color:C.orange, fontWeight:500}}>{info.n}</span>
      {score !== undefined && <span style={{color:C.ink, fontWeight:400}}> — {score}/{max}</span>}
      {hover && (<div style={{position:"absolute", top:"100%", left:0, zIndex:20, width:280, background:C.ink, color:C.bg, padding:"12px 16px", fontFamily:F.serif, fontSize:13, lineHeight:1.6, marginTop:4, fontStyle:"normal", boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}><Lbl orange style={{display:"block", marginBottom:6, color:C.orange}}>{info.n}</Lbl>{info.desc}</div>)}
    </div>
  );
}

// ═══════════════════════════════════════
// SCREEN TIME UPLOAD COMPONENT
// ═══════════════════════════════════════
function ScreenTimeUpload({ onComplete, onSkip }) {
  const [hoverInfo, setHoverInfo] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [manual, setManual] = useState({ app1:"", m1:"", app2:"", m2:"", app3:"", m3:"", total:"" });
  const fileInputRef = useRef(null);

  async function handleFileUpload(file) {
    if (!file) return;
    setUploading(true); setUploadError("");
    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type;
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        system: SCREENTIME_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extract the screen time data from this image. Return only the JSON." }
          ]
        }]
      })});
      const data = await res.json();
      const jsonText = (data.text || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(jsonText);
      if (parsed.valid === false) { setUploadError("Couldn't read that screenshot. Try again or enter manually."); setUploading(false); return; }
      onComplete(parsed);
    } catch (err) {
      setUploadError("Something went wrong. Try again or enter manually.");
      setUploading(false);
    }
  }

  function submitManual() {
    const parseTime = (t) => {
      if (!t) return 0;
      const n = parseInt(t.replace(/[^\d]/g, "")) || 0;
      return n;
    };
    const data = {
      valid: true,
      view_type: "daily", // Manual entry is always daily — user types their daily numbers
      total_minutes: parseTime(manual.total) || (parseTime(manual.m1) + parseTime(manual.m2) + parseTime(manual.m3)),
      top_apps: [
        manual.app1 && { name: manual.app1, minutes: parseTime(manual.m1) },
        manual.app2 && { name: manual.app2, minutes: parseTime(manual.m2) },
        manual.app3 && { name: manual.app3, minutes: parseTime(manual.m3) },
      ].filter(Boolean)
    };
    onComplete(data);
  }

  if (uploading) {
    return (
      <div style={{textAlign:"center", padding:"40px 20px"}}>
        <Lbl orange style={{display:"block", marginBottom:16}}><Quote>Reading your numbers</Quote></Lbl>
        <p style={{fontFamily:F.serif, fontStyle:"italic", fontSize:16, color:C.ink, marginBottom:20}}>Noorah is looking at your screenshot...</p>
        <div style={{display:"flex", justifyContent:"center", gap:8}}>
          {[0,1,2,3,4].map(i=>(<div key={i} style={{width:8, height:8, background:C.orange, opacity:.3, animation:`f 1.5s ease-in-out ${i*.2}s infinite`}}/>))}
        </div>
        <style>{`@keyframes f{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div>
        <Lbl orange style={{display:"block", marginBottom:16}}>Enter your top 3 apps</Lbl>
        {[1,2,3].map(n => (
          <div key={n} style={{display:"flex", gap:8, marginBottom:10}}>
            <input type="text" placeholder={`App ${n} (e.g., TikTok)`} value={manual[`app${n}`]} onChange={e=>setManual({...manual,[`app${n}`]:e.target.value})} style={{flex:2, padding:"10px 12px", fontSize:14, fontFamily:F.serif, border:`1px solid ${C.border}`, background:C.card, boxSizing:"border-box"}} />
            <input type="text" placeholder="Minutes" value={manual[`m${n}`]} onChange={e=>setManual({...manual,[`m${n}`]:e.target.value})} style={{flex:1, padding:"10px 12px", fontSize:14, fontFamily:F.mono, border:`1px solid ${C.border}`, background:C.card, boxSizing:"border-box"}} />
          </div>
        ))}
        <div style={{marginTop:16, marginBottom:12}}>
          <Lbl style={{display:"block", marginBottom:4}}>Total screen time yesterday (optional)</Lbl>
          <input type="text" placeholder="e.g., 420 (minutes)" value={manual.total} onChange={e=>setManual({...manual,total:e.target.value})} style={{width:"100%", padding:"10px 12px", fontSize:14, fontFamily:F.mono, border:`1px solid ${C.border}`, background:C.card, boxSizing:"border-box"}} />
        </div>
        <button onClick={submitManual} disabled={!manual.app1||!manual.m1} style={{width:"100%", padding:14, fontFamily:F.mono, fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase", background:manual.app1&&manual.m1?C.ink:"#ddd", color:manual.app1&&manual.m1?C.bg:C.muted, border:"none", cursor:manual.app1&&manual.m1?"pointer":"not-allowed"}}>Continue →</button>
        <button onClick={()=>setManualMode(false)} style={{width:"100%", marginTop:8, padding:8, background:"transparent", border:"none", color:C.muted, fontFamily:F.mono, fontSize:10, letterSpacing:2, cursor:"pointer"}}>← BACK TO UPLOAD</button>
      </div>
    );
  }

  return (
    <div>
      {/* UPLOAD ZONE */}
      <div style={{position:"relative"}}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={e=>handleFileUpload(e.target.files?.[0])} style={{display:"none"}} />
        <div onClick={()=>fileInputRef.current?.click()} style={{border:`2px dashed ${C.orange}`, padding:"32px 20px", textAlign:"center", cursor:"pointer", background:C.card, transition:"all .2s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(232,93,43,.04)"}
          onMouseLeave={e=>e.currentTarget.style.background=C.card}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="1.5" style={{margin:"0 auto 12px", display:"block"}}><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          <div style={{fontFamily:F.mono, fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.ink, marginBottom:4}}>Upload screenshot</div>
          <div style={{fontFamily:F.serif, fontSize:13, color:C.muted, fontStyle:"italic"}}>Your screen time screenshot</div>
          <div style={{marginTop:12, position:"relative", display:"inline-block"}}
            onMouseEnter={()=>setHoverInfo(true)}
            onMouseLeave={()=>setHoverInfo(false)}
            onClick={e=>{e.stopPropagation();setHoverInfo(!hoverInfo)}}>
            <span style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, color:C.orange, borderBottom:`1px dotted ${C.orange}`, cursor:"help"}}>HOW TO FIND IT ⓘ</span>
            {hoverInfo && (
              <div style={{position:"absolute", bottom:"100%", left:"50%", transform:"translateX(-50%)", marginBottom:8, zIndex:30, width:300, background:C.ink, color:C.bg, padding:"14px 16px", fontFamily:F.serif, fontSize:13, lineHeight:1.6, textAlign:"left", boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>
                <Lbl orange style={{display:"block", marginBottom:8, color:C.orange}}>On iPhone</Lbl>
                <div style={{marginBottom:12}}>Settings → Screen Time → See All Activity → Screenshot</div>
                <Lbl orange style={{display:"block", marginBottom:8, color:C.orange}}>On Android</Lbl>
                <div style={{marginBottom:12}}>Settings → Digital Wellbeing → Dashboard → Screenshot</div>
                <div style={{fontSize:11, fontStyle:"italic", color:"rgba(255,255,255,0.6)", paddingTop:10, borderTop:`0.5px solid rgba(255,255,255,0.15)`}}>Either the daily view or the weekly view works. We'll read whichever you send.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadError && <p style={{fontFamily:F.mono, fontSize:11, color:C.orange, textAlign:"center", marginTop:10}}>{uploadError}</p>}

      {/* ALTERNATIVES */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:20}}>
        <button onClick={()=>setManualMode(true)} style={{background:"transparent", border:"none", color:C.ink, fontFamily:F.mono, fontSize:11, letterSpacing:1, cursor:"pointer", textDecoration:"underline", textDecorationColor:C.border, textUnderlineOffset:4}}>Type it manually →</button>
        <button onClick={onSkip} style={{background:"transparent", border:"none", color:C.muted, fontFamily:F.mono, fontSize:10, letterSpacing:2, cursor:"pointer"}}>SKIP THIS</button>
      </div>
      <p style={{fontFamily:F.serif, fontSize:12, fontStyle:"italic", color:C.muted, textAlign:"center", marginTop:16, lineHeight:1.6}}>Your screenshot is read and discarded. We never store images.</p>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ans, setAns] = useState({});
  const [followupAnswers, setFollowupAnswers] = useState({});
  const [currentFollowup, setCurrentFollowup] = useState(null);
  const [followupInput, setFollowupInput] = useState("");
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [qi, setQi] = useState(0);
  const [showPart2Intro, setShowPart2Intro] = useState(false);
  const [screentimeData, setScreentimeData] = useState(null);
  const [scores, setScores] = useState(null);
  const [plan, setPlan] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState(new Set([1])); // Week 1 expanded by default
  const [errorDetails, setErrorDetails] = useState("");
  const [loadingQuoteIdx, setLoadingQuoteIdx] = useState(0);
  const [adminPw, setAdminPw] = useState("");
  const [subs, setSubs] = useState([]);
  const topRef = useRef(null);

  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("paid") === "true") { window.history.replaceState({}, "", window.location.pathname); const s = sessionStorage.getItem("n_scores"), a = sessionStorage.getItem("n_ans"), nm = sessionStorage.getItem("n_name"), em = sessionStorage.getItem("n_email"), fu = sessionStorage.getItem("n_followups"), st = sessionStorage.getItem("n_screentime"); if (s && a) { setScores(JSON.parse(s)); setAns(JSON.parse(a)); setName(nm || ""); setEmail(em || ""); if (fu) setFollowupAnswers(JSON.parse(fu)); if (st) setScreentimeData(JSON.parse(st)); setMode("generating"); } } }, []);
  useEffect(() => { if (mode === "generating" && scores && !plan) genPlan(); }, [mode, scores]);
  useEffect(() => { if (topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); }, [mode, qi, showPart2Intro]);
  useEffect(() => { if (mode !== "generating") return; const iv = setInterval(() => setLoadingQuoteIdx(i => (i+1) % LOADING_QUOTES.length), 5000); return () => clearInterval(iv); }, [mode]);

  const pg = { maxWidth:580, margin:"0 auto", padding:"2rem 20px", fontFamily:F.mono, minHeight:"100vh" };
  const btnStyle = (active=true) => ({ width:"100%", padding:"14px", fontFamily:F.mono, fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase", background:active?C.ink:"#ddd", color:active?C.bg:C.muted, border:"none", cursor:active?"pointer":"not-allowed", transition:"background .2s" });
  const inputStyle = { width:"100%", padding:"12px 14px", fontSize:15, fontFamily:F.serif, border:`1px solid ${C.border}`, background:C.card, boxSizing:"border-box" };

  async function fetchFollowup(question, answer) {
    setLoadingFollowup(true);
    try {
      const ctx = `Original question: ${question}\nTheir answer: ${answer}\n\nGenerate ONE sharp follow-up question. Output only the question.`;
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ system:FOLLOWUP_PROMPT, messages:[{role:"user",content:ctx}] }) });
      const data = await res.json();
      return (data.text || "").trim().replace(/^["']|["']$/g, "");
    } catch(e) { return null; } finally { setLoadingFollowup(false); }
  }

  async function answer(val) {
    const qid = QUIZ_ORDER[qi];
    const q = Q[qid];
    const newAns = { ...ans, [qid]: val };
    setAns(newAns);

    // AI follow-ups on text questions
    const textQsWithFollowup = ["p1_lastnight", "p2_analog"];
    if (textQsWithFollowup.includes(qid) && q.type === "text" && typeof val === "string" && val.trim().length > 10) {
      const followupQ = await fetchFollowup(q.t, val);
      if (followupQ) {
        setCurrentFollowup({ qid, question: followupQ, originalAnswer: val });
        setFollowupInput("");
        return;
      }
    }
    advanceQuestion(newAns);
  }

  function handleScreenTimeComplete(data) {
    setScreentimeData(data);
    setAns({...ans, p2_screentime: data});
    advanceQuestion({...ans, p2_screentime: data});
  }

  function handleScreenTimeSkip() {
    setAns({...ans, p2_screentime: null});
    advanceQuestion({...ans, p2_screentime: null});
  }

  function advanceQuestion(newAns) {
    if (qi === 4) { setShowPart2Intro(true); return; }
    if (qi === QUIZ_ORDER.length - 1) {
      const s = calc(newAns, screentimeData); setScores(s);
      sessionStorage.setItem("n_scores", JSON.stringify(s));
      sessionStorage.setItem("n_ans", JSON.stringify(newAns));
      sessionStorage.setItem("n_name", name);
      sessionStorage.setItem("n_email", email);
      sessionStorage.setItem("n_followups", JSON.stringify(followupAnswers));
      if (screentimeData) sessionStorage.setItem("n_screentime", JSON.stringify(screentimeData));
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:newAns.p1_lastnight||"", total:s.total, dimensions:s.dims, severity:s.sev, prescription:s.fast, lembke:s.mk, context:{ living:Q.p2_context.o1?.[newAns.p2_context?.a]||"", work:Q.p2_context.o2?.[newAns.p2_context?.b]||"", lostActivity:newAns.p2_analog||"" }, plan:"" }).catch(()=>{});
      setMode("results"); return;
    }
    setQi(qi + 1);
  }

  function submitFollowup() {
    if (!followupInput.trim() || !currentFollowup) return;
    const updatedFollowups = { ...followupAnswers, [currentFollowup.qid]: { question:currentFollowup.question, answer:followupInput } };
    setFollowupAnswers(updatedFollowups);
    setCurrentFollowup(null);
    setFollowupInput("");
    advanceQuestion(ans);
  }

  function skipFollowup() { setCurrentFollowup(null); setFollowupInput(""); advanceQuestion(ans); }

  async function genPlan() {
    const topDims = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw).slice(0,3);
    const followupContext = Object.entries(followupAnswers).map(([qid, fu]) => `Follow-up after "${Q[qid]?.t}": Q: ${fu.question} A: ${fu.answer}`).join("\n");
    let screentimeContext = "";
    if (screentimeData?.valid) {
      const isWeekly = screentimeData.view_type === "weekly";
      const totalH = Math.floor((screentimeData.total_minutes||0)/60);
      const totalM = (screentimeData.total_minutes||0)%60;
      const totalLabel = isWeekly ? "Daily average screen time" : "Screen time yesterday";
      const appsLabel = isWeekly ? "Top apps this week (weekly totals)" : "Top apps yesterday";
      screentimeContext = `
ACTUAL SCREEN TIME DATA (${isWeekly ? "weekly view — daily average shown" : "daily view"}):
${totalLabel}: ${totalH}h ${totalM}m
${appsLabel}: ${(screentimeData.top_apps||[]).map(a => `${a.name} (${Math.floor(a.minutes/60)}h ${a.minutes%60}m${isWeekly ? " this week" : ""})`).join(", ")}

USE THIS DATA THROUGHOUT THE PLAN. Reference exact apps and exact minutes.${isWeekly ? " When mentioning app usage, say 'this week' (e.g., 'you gave 14 hours to TikTok this week'). When mentioning total time, use the daily average (e.g., 'you spend 4 hours a day on your phone on average')." : " When mentioning screen time, it's yesterday's data — reference it as 'yesterday' or 'your most recent day'."}`;
    }

    const ctx = `Generate a personalized 8-week plan for:
Name: ${name}
Score: ${scores.total}/100 (${scores.sev})
Top dimension: ${DIM[scores.top].n}
Dimensions: ${topDims.map(([k,v])=>`${DIM[k].n}: ${v.raw}/${v.max}`).join(", ")}
Last thing last night: "${ans.p1_lastnight||""}"
Phone location right now: "${Q.p1_location.o?.[ans.p1_location]||""}"
Phone pickups yesterday: "${Q.p1_pickups.o?.[ans.p1_pickups]||""}"
Last uninterrupted focus: "${Q.p1_focus.o?.[ans.p1_focus]||""}"
Reaching for phone under stress: "${Q.p1_reach.o?.[ans.p1_reach]||""}"
Phone at bedtime: "${Q.p2_bedtime.o?.[ans.p2_bedtime]||""}"
Recent impulse spending: "${Q.p2_spend.o?.[ans.p2_spend]||""}"
Thing they miss doing off phone: "${ans.p2_analog||""}"
Living: ${Q.p2_context.o1?.[ans.p2_context?.a]||""}
Work: ${Q.p2_context.o2?.[ans.p2_context?.b]||""}
Prescribed fast: ${scores.fast}${screentimeContext}
${followupContext ? "\nFOLLOW-UP CONTEXT:\n"+followupContext : ""}

Write their plan now. Reference their specific words and numbers. NO markdown bold, NO markdown italic, NO hashtags except ### for sections.`;
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ system:PLAN_PROMPT, messages:[{role:"user",content:ctx}] }) });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      if (data.error || !data.text) throw new Error(data.error || "Empty response from plan generator");
      const text = cleanText(data.text);
      if (text.length < 200) throw new Error("Plan output too short");
      setPlan(text);
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:ans.p1_lastnight||"", total:scores.total, dimensions:scores.dims, severity:scores.sev, prescription:scores.fast, lembke:scores.mk, context:{ living:Q.p2_context.o1?.[ans.p2_context?.a]||"", work:Q.p2_context.o2?.[ans.p2_context?.b]||"", lostActivity:ans.p2_analog||"" }, plan:text }).catch(()=>{});
      setMode("plan");
    } catch(e) {
      console.error("Plan generation failed:", e);
      // Save the failed attempt so admin knows to regenerate
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:ans.p1_lastnight||"", total:scores.total, dimensions:scores.dims, severity:scores.sev, prescription:scores.fast, lembke:scores.mk, context:{ living:Q.p2_context.o1?.[ans.p2_context?.a]||"", work:Q.p2_context.o2?.[ans.p2_context?.b]||"", lostActivity:ans.p2_analog||"" }, plan:`[ERROR — needs manual regeneration] ${e.message||"Unknown"}` }).catch(()=>{});
      setErrorDetails(e.message || "Unknown error");
      setMode("error");
    }
  }

  async function retryPlan() {
    setErrorDetails("");
    setPlan("");
    setMode("generating");
  }

  // ═══════════════════════════════════════
  // PARSE PLAN INTO STRUCTURED DATA
  // ═══════════════════════════════════════
  function parsePlan() {
    // Known section header patterns (case-insensitive, match whole line)
    const SECTION_PATTERNS = [
      { re: /^YOUR\s+PATTERN$/i, key: "pattern" },
      { re: /^YOUR\s+NUMBERS$/i, key: "numbers" },
      { re: /^WEEK\s+(\d+)(?:\s*[—–-]\s*(.*))?$/i, key: "week" },
      { re: /^YOUR\s+TWO[-\s]*MINUTE\s+MAP$/i, key: "map" },
      { re: /^YOUR\s+SEVEN$/i, key: "seven" },
      { re: /^ONE\s+THING$/i, key: "onething" },
      { re: /^YOUR\s+RULES$/i, key: "seven" },
      { re: /^DIGITAL\s+CONSTITUTION$/i, key: "seven" },
    ];

    const lines = plan.split("\n");
    const sections = [];  // [{key, title, num?, body[]}]
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      // Strip optional ### prefix before matching
      const rawLine = lines[i].replace(/^#{1,6}\s*/, "").trim();

      let matched = null;
      for (const pat of SECTION_PATTERNS) {
        const m = rawLine.match(pat.re);
        if (m) {
          matched = { key: pat.key, title: rawLine, num: pat.key === "week" ? parseInt(m[1]) : null, weekTitle: pat.key === "week" ? (m[2] || "").trim() : null };
          break;
        }
      }

      if (matched) {
        // Special case: if we hit a NEW Week header right after a previous empty Week header
        // (e.g., "WEEK 1 — THE FAST BEGINS" was the phase label, then "Week 1 — Delete Reddit Now" is the real week)
        // → replace the previous one instead of pushing a new section
        if (
          matched.key === "week" &&
          current &&
          current.key === "week" &&
          current.num === matched.num &&
          current.body.filter(l => l.trim()).length === 0
        ) {
          // Previous was empty (just the phase label) — replace its title with this one
          current = { ...matched, body: [] };
        } else {
          if (current) sections.push(current);
          current = { ...matched, body: [] };
        }
      } else if (current) {
        current.body.push(lines[i]);
      }
      // If no current section yet and no match, skip (preamble text)
    }
    if (current) sections.push(current);

    // Now assemble result from sections
    const result = {
      pattern: null,
      numbers: null,
      weeks: [],
      twoMinuteMap: null,
      seven: null,
      oneThing: null,
      other: [],
    };

    sections.forEach(sec => {
      const body = sec.body.join("\n").trim();
      switch (sec.key) {
        case "pattern":
          result.pattern = { title: sec.title, body };
          break;
        case "numbers":
          result.numbers = { title: sec.title, body };
          break;
        case "week":
          const week = parseSingleWeek(sec.num, sec.weekTitle, body);
          if (week) result.weeks.push(week);
          break;
        case "map":
          result.twoMinuteMap = { title: sec.title, body };
          break;
        case "seven":
          result.seven = { title: sec.title, body };
          break;
        case "onething":
          result.oneThing = { title: sec.title, body };
          break;
        default:
          result.other.push({ title: sec.title, body });
      }
    });

    // Sort weeks by number, dedupe (prefer ones with content)
    result.weeks.sort((a, b) => a.num - b.num);
    const byNum = {};
    result.weeks.forEach(w => {
      const existing = byNum[w.num];
      // Prefer the week with more content
      const score = (w.shift ? 10 : 0) + w.rhythm.length + (w.notice ? 5 : 0);
      const existingScore = existing ? ((existing.shift ? 10 : 0) + existing.rhythm.length + (existing.notice ? 5 : 0)) : -1;
      if (!existing || score > existingScore) {
        byNum[w.num] = w;
      }
    });
    result.weeks = Object.values(byNum).sort((a, b) => a.num - b.num);

    return result;
  }

  // Parse a single WEEK section's body into a structured week object
  function parseSingleWeek(num, headerTitle, body) {
    const rawLines = body.split("\n");
    const week = {
      num,
      title: headerTitle || "",
      shift: "",
      rhythm: [],
      notice: "",
    };
    let section = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) { section = null; continue; }

      const titleMatch = line.match(/^TITLE:?\s*(.*)/i);
      const shiftMatch = line.match(/^SHIFT:?\s*(.*)/i);
      const rhythmMatch = line.match(/^RHYTHM:?\s*(.*)/i);
      const noticeMatch = line.match(/^NOTICE:?\s*(.*)/i);
      const innerWeekMatch = line.match(/^Week\s+\d+\s*[—–-]\s*(.*)$/i);
      const bulletMatch = line.startsWith("-") || line.startsWith("→") || line.startsWith("•");

      if (titleMatch) {
        if (titleMatch[1].trim()) week.title = titleMatch[1].trim();
        section = null;
      } else if (innerWeekMatch && !week.title) {
        week.title = innerWeekMatch[1].trim();
        section = null;
      } else if (shiftMatch) {
        section = "shift";
        if (shiftMatch[1].trim()) week.shift = shiftMatch[1].trim();
      } else if (rhythmMatch) {
        section = "rhythm";
        if (rhythmMatch[1].trim() && rhythmMatch[1].trim().startsWith("-")) {
          week.rhythm.push(rhythmMatch[1].trim().replace(/^-\s*/, ""));
        }
      } else if (noticeMatch) {
        section = "notice";
        if (noticeMatch[1].trim()) week.notice = noticeMatch[1].trim();
      } else if (bulletMatch && section === "rhythm") {
        week.rhythm.push(line.replace(/^[-→•]\s*/, ""));
      } else if (section === "shift") {
        week.shift = (week.shift + " " + line).trim();
      } else if (section === "notice") {
        week.notice = (week.notice + " " + line).trim();
      }
    }

    // Only return if we got at least a shift OR rhythm
    if (week.shift || week.rhythm.length > 0) return week;
    return null;
  }

  // ═══════════════════════════════════════
  // RENDER A SINGLE WEEK CARD (full version)
  // ═══════════════════════════════════════
  function WeekCard({ week, expanded, onToggle, isCurrent }) {
    return (
      <div style={{marginBottom:16}}>
        {isCurrent && (
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", marginBottom:10}}>
            <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.orange, fontWeight:600}}>▼ NOW SHOWING</div>
            <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2, color:C.muted}}>WEEK {week.num} OF 8</div>
          </div>
        )}
        <div
          className="week-card"
          style={{background:C.card, border:`0.5px solid ${C.border}`, borderLeft:`3px solid ${C.orange}`, padding:expanded?"22px 24px":"14px 18px", cursor:expanded?"default":"pointer", transition:"padding .2s"}}
          onClick={!expanded ? onToggle : undefined}
        >
          {/* Week header — always visible */}
          <div style={{display:"flex", alignItems:"baseline", gap:14, paddingBottom:expanded?12:0, marginBottom:expanded?16:0, borderBottom:expanded?`0.5px dashed ${C.border}`:"none"}}>
            <div style={{fontFamily:F.display, fontSize:expanded?40:26, color:C.orange, lineHeight:.9, letterSpacing:-1, minWidth:44}}>{String(week.num).padStart(2,"0")}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.muted, textTransform:"uppercase", marginBottom:2}}>Week {week.num}</div>
              {week.title && <div style={{fontFamily:F.serif, fontSize:expanded?19:15, fontStyle:"italic", color:C.ink, lineHeight:1.3}}>{week.title}</div>}
              {!expanded && week.shift && (
                <div style={{fontFamily:F.mono, fontSize:10, color:C.muted, marginTop:3, lineHeight:1.4}}>{week.shift.slice(0,60)}{week.shift.length>60?"...":""}</div>
              )}
            </div>
            {!expanded && (
              <button onClick={(e)=>{e.stopPropagation(); onToggle();}} style={{background:"transparent", border:"none", color:C.orange, fontFamily:F.mono, fontSize:14, cursor:"pointer", padding:4}}>+</button>
            )}
            {expanded && (
              <button onClick={(e)=>{e.stopPropagation(); onToggle();}} className="no-print" style={{background:"transparent", border:"none", color:C.muted, fontFamily:F.mono, fontSize:10, cursor:"pointer", padding:4, letterSpacing:2}}>COLLAPSE</button>
            )}
          </div>

          {/* Week body — only when expanded */}
          {expanded && (
            <>
              {week.shift && (
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2.5, color:C.orange, fontWeight:600, marginBottom:5}}>
                    THE SHIFT <span style={{color:C.muted, fontWeight:400, marginLeft:6, letterSpacing:1}}>one-time</span>
                  </div>
                  <div style={{fontFamily:F.serif, fontSize:15.5, lineHeight:1.55, color:C.ink}}>{week.shift}</div>
                </div>
              )}
              {week.rhythm && week.rhythm.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2.5, color:C.orange, fontWeight:600, marginBottom:6}}>
                    DAILY RHYTHM <span style={{color:C.muted, fontWeight:400, marginLeft:6, letterSpacing:1}}>every day this week</span>
                  </div>
                  <div>
                    {week.rhythm.map((r, rIdx) => (
                      <div key={rIdx} style={{fontFamily:F.serif, fontSize:14.5, lineHeight:1.55, color:C.ink, marginBottom:4, paddingLeft:16, position:"relative"}}>
                        <span style={{position:"absolute", left:0, color:C.orange, fontFamily:F.mono, fontSize:11}}>→</span>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {week.notice && (
                <div>
                  <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2.5, color:C.orange, fontWeight:600, marginBottom:5}}>
                    NOTICE THIS <span style={{color:C.muted, fontWeight:400, marginLeft:6, letterSpacing:1}}>sit with it all week</span>
                  </div>
                  <div style={{fontFamily:F.serif, fontSize:14, fontStyle:"italic", lineHeight:1.55, color:C.muted}}>{week.notice}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // FORMAT BODY TEXT (for non-week sections)
  // ═══════════════════════════════════════
  function formatBody(text) {
    if (!text) return null;
    const rawLines = text.split("\n");
    const elements = [];
    for (let j = 0; j < rawLines.length; j++) {
      const line = rawLines[j].trim();
      if (!line) continue;
      const rule = line.match(/^(\d+)\.\s+(.*)/);
      const bullet = line.startsWith("-") || line.startsWith("→");
      const menuHeader = line.match(/^When you.*:$/i);

      if (rule) {
        elements.push(
          <div key={j} style={{display:"flex", gap:12, padding:"10px 0", borderBottom:`0.5px solid ${C.border}`}}>
            <span style={{fontFamily:F.display, fontSize:22, color:C.orange, minWidth:26, lineHeight:1}}>{rule[1].padStart(2,"0")}</span>
            <div style={{fontFamily:F.serif, fontSize:14.5, lineHeight:1.6, color:C.ink, flex:1}}>{rule[2]}</div>
          </div>
        );
      } else if (bullet) {
        elements.push(
          <div key={j} style={{fontFamily:F.serif, fontSize:14.5, lineHeight:1.6, color:C.ink, marginBottom:5, paddingLeft:16, position:"relative"}}>
            <span style={{position:"absolute", left:0, color:C.orange, fontFamily:F.mono, fontSize:11}}>→</span>
            {line.replace(/^[-→]\s*/, "")}
          </div>
        );
      } else if (menuHeader) {
        elements.push(
          <div key={j} style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C.orange, fontWeight:600, margin:"16px 0 8px", paddingTop:10, borderTop:`0.5px solid ${C.border}`}}>{line}</div>
        );
      } else {
        elements.push(
          <div key={j} style={{fontFamily:F.serif, fontSize:15, lineHeight:1.75, color:C.ink, marginBottom:8}}>{line}</div>
        );
      }
    }
    return elements;
  }


  // ═══ ADMIN ═══
  if (mode === "adminLogin") return (<div style={{...pg, maxWidth:420, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}><Lbl orange>Admin access</Lbl><div style={{height:16}}/><input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} placeholder="Password" style={{...inputStyle, fontFamily:F.mono, fontSize:13, marginBottom:12}}/><button onClick={async()=>{if(adminPw==="noorah2026"){setSubs(await loadSubmissions());setMode("admin")}else alert("Wrong")}} style={btnStyle()}>Enter</button><button onClick={()=>setMode("start")} style={{...btnStyle(false), background:"transparent", color:C.muted, border:"none", marginTop:8, cursor:"pointer", fontSize:10}}>← Back</button></div>);

  if (mode === "admin") return (<div style={{...pg, maxWidth:720}} ref={topRef}><Lbl orange>Admin — {subs.length} submissions</Lbl><div style={{marginTop:16}}>{subs.map((s,i)=>(<details key={s.id||i} style={{marginBottom:8, border:`0.5px solid ${C.border}`, padding:"12px 16px"}}><summary style={{cursor:"pointer", fontFamily:F.mono, fontSize:12}}><span style={{color:C.orange, fontWeight:600}}>{String(i+1).padStart(2,"0")}</span> → {s.name} — {s.total} ({s.severity}) — {new Date(s.timestamp).toLocaleDateString()}</summary><div style={{marginTop:12, fontFamily:F.mono, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", background:C.light, padding:14, maxHeight:300, overflow:"auto"}}>{s.plan||"No plan"}</div></details>))}</div><button onClick={()=>setMode("start")} style={{...btnStyle(false), background:"transparent", color:C.muted, border:`0.5px solid ${C.border}`, marginTop:16, cursor:"pointer", width:"auto", padding:"8px 20px", fontSize:10}}>Exit</button></div>);

  // ═══ START ═══
  if (mode === "start") return (<div style={{...pg, maxWidth:520, display:"flex", flexDirection:"column", justifyContent:"center", textAlign:"center"}} ref={topRef}>
    <Lbl orange style={{display:"block", marginBottom:16}}>Est. 2026</Lbl>
    <h1 style={{fontFamily:F.display, fontSize:80, letterSpacing:4, lineHeight:.9, color:C.ink, marginBottom:8}}>NOORAH</h1>
    <p style={{fontFamily:F.serif, fontSize:17, fontStyle:"italic", color:C.muted, marginBottom:4}}><Quote>The light before your screen</Quote></p>
    <Lbl style={{display:"block", marginTop:8}}>The digital intent company</Lbl>
    <div style={{borderTop:`1.5px solid ${C.ink}`, borderBottom:`0.5px dashed ${C.border}`, padding:"20px 0", margin:"28px 0 24px", textAlign:"left"}}>
      <p style={{fontFamily:F.serif, fontSize:18, lineHeight:1.8, color:C.ink}}>You already know something's off. This gives it a number. Ten questions. Six dimensions. One score that tells you exactly what your screens are costing you. Then — if you're ready — 56 days that only belong to you.</p>
    </div>
    <div style={{display:"flex", justifyContent:"space-between", marginBottom:28, borderBottom:`0.5px dashed ${C.border}`, paddingBottom:20}}>
      {[{v:"3 min",l:"assessment"},{v:"10",l:"questions"},{v:"56",l:"days in plan"},{v:"$0",l:"to start"}].map((s,i)=>(<div key={i} style={{textAlign:"center", flex:1, borderRight:i<3?`0.5px solid ${C.border}`:"none"}}><div style={{fontFamily:F.display, fontSize:28, color:C.ink}}>{s.v}</div><Lbl style={{fontSize:8}}>{s.l}</Lbl></div>))}
    </div>
    <button onClick={()=>setMode("intake")} style={btnStyle()} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Take the free assessment →</button>
    <button onClick={()=>setMode("adminLogin")} style={{background:"transparent", border:"none", color:C.border, fontFamily:F.mono, fontSize:9, letterSpacing:2, marginTop:20, cursor:"pointer"}}>ADMIN</button>
  </div>);

  // ═══ INTAKE ═══
  if (mode === "intake") return (<div style={{...pg, maxWidth:440, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
    <Lbl orange style={{display:"block", marginBottom:12}}>Before we start</Lbl>
    <h2 style={{fontFamily:F.display, fontSize:36, letterSpacing:2, marginBottom:4}}>YOUR DETAILS</h2>
    <p style={{fontFamily:F.serif, fontSize:14, color:C.muted, fontStyle:"italic", marginBottom:24}}>So your results have somewhere to live.</p>
    <Lbl style={{display:"block", marginBottom:4}}>01 → First name</Lbl>
    <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{...inputStyle, marginBottom:16}}/>
    <Lbl style={{display:"block", marginBottom:4}}>02 → Email</Lbl>
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={{...inputStyle, marginBottom:24}}/>
    <button onClick={()=>{setMode("quiz");setQi(0);setShowPart2Intro(false)}} disabled={!name||!email} style={btnStyle(name&&email)}>Begin →</button>
  </div>);

  // ═══ PART 2 INTRO ═══
  if (mode === "quiz" && showPart2Intro) {
    return (<div style={{...pg, maxWidth:500, display:"flex", flexDirection:"column", justifyContent:"center", textAlign:"center"}} ref={topRef}>
      <Lbl orange style={{display:"block", marginBottom:16}}><Quote>Part 1 complete</Quote></Lbl>
      <div style={{fontFamily:F.display, fontSize:72, color:C.ink, letterSpacing:2, lineHeight:1, marginBottom:8}}>HALFWAY.</div>
      <p style={{fontFamily:F.serif, fontSize:18, fontStyle:"italic", color:C.muted, lineHeight:1.7, marginBottom:24}}>Your pattern is emerging. Five more questions — about your life this time — and Noorah will know enough to build your plan.</p>
      <div style={{borderTop:`1.5px solid ${C.ink}`, borderBottom:`0.5px dashed ${C.border}`, padding:"16px 0", margin:"8px 0 24px"}}>
        <Lbl>Part 2 of 2 → Your life</Lbl>
      </div>
      <button onClick={()=>{setShowPart2Intro(false);setQi(5)}} style={btnStyle()} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Continue →</button>
    </div>);
  }

  // ═══ QUIZ ═══
  if (mode === "quiz") {
    if (currentFollowup) {
      return (<div style={{...pg, maxWidth:520, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
        <Lbl orange style={{display:"block", marginBottom:12}}><Quote>Noorah wants to know more</Quote></Lbl>
        <div style={{borderLeft:`2px solid ${C.orange}`, paddingLeft:16, marginBottom:24}}>
          <p style={{fontFamily:F.mono, fontSize:10, color:C.muted, marginBottom:6}}>You said:</p>
          <p style={{fontFamily:F.serif, fontSize:14, fontStyle:"italic", color:C.ink, lineHeight:1.6}}>{currentFollowup.originalAnswer}</p>
        </div>
        <h2 style={{fontFamily:F.serif, fontSize:22, fontWeight:400, fontStyle:"italic", lineHeight:1.6, marginBottom:20}}>{currentFollowup.question}</h2>
        <textarea value={followupInput} onChange={e=>setFollowupInput(e.target.value)} placeholder="Type here..." rows={3} style={{...inputStyle, fontFamily:F.serif, fontSize:16, resize:"none", lineHeight:1.7, marginBottom:12}}/>
        <button onClick={submitFollowup} disabled={!followupInput.trim()} style={btnStyle(!!followupInput.trim())}>Continue →</button>
        <button onClick={skipFollowup} style={{background:"transparent", border:"none", color:C.muted, fontFamily:F.mono, fontSize:10, letterSpacing:2, marginTop:12, cursor:"pointer"}}>SKIP THIS QUESTION</button>
      </div>);
    }

    const qid = QUIZ_ORDER[qi], q = Q[qid];
    if (!q) { setMode("results"); return null; }
    const part = q.part;
    const partIndex = qi < 5 ? qi + 1 : qi - 4;
    const pct = ((qi+1)/10)*100;

    return (<div style={{...pg, maxWidth:520, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <Lbl orange>Part {part} of 2 → {part===1?"Your pattern":"Your life"}</Lbl>
        <Lbl>{String(partIndex).padStart(2,"0")} / 05</Lbl>
      </div>
      <div style={{height:2, background:C.border, marginBottom:28}}><div style={{height:2, background:C.orange, width:`${pct}%`, transition:"width 0.3s"}}/></div>
      <h2 style={{fontFamily:F.serif, fontSize:22, fontWeight:400, fontStyle:"italic", lineHeight:1.6, marginBottom:24, minHeight:60}}>{q.t}</h2>

      {loadingFollowup && (<div style={{textAlign:"center", padding:40}}><Lbl orange>Noorah is thinking...</Lbl></div>)}

      {!loadingFollowup && q.type === "screentime" && (<ScreenTimeUpload onComplete={handleScreenTimeComplete} onSkip={handleScreenTimeSkip} />)}

      {!loadingFollowup && q.type === "text" && (
        <div>
          <textarea value={ans[qid]||""} onChange={e=>setAns({...ans,[qid]:e.target.value})} placeholder="Type here..." rows={3} style={{...inputStyle, fontFamily:F.serif, fontSize:16, resize:"none", lineHeight:1.7, marginBottom:14}}/>
          <button onClick={()=>answer(ans[qid])} disabled={!ans[qid]?.trim()} style={btnStyle(!!ans[qid]?.trim())}>Continue →</button>
        </div>
      )}
      {!loadingFollowup && q.type === "double" && (
        <div>
          <Lbl style={{display:"block", marginBottom:8}}>Who you live with</Lbl>
          <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:16}}>
            {q.o1.map((opt,i)=>(<button key={i} onClick={()=>setAns({...ans,[qid]:{...(ans[qid]||{}),a:i}})} style={{padding:"12px 14px", fontSize:13, fontFamily:F.serif, textAlign:"left", background:(ans[qid]?.a===i)?"rgba(232,93,43,.1)":"transparent", border:`0.5px solid ${(ans[qid]?.a===i)?C.orange:C.border}`, cursor:"pointer", transition:"all .15s"}}><span style={{fontFamily:F.mono, fontSize:10, color:C.orange, fontWeight:600, marginRight:8}}>{String.fromCharCode(65+i)}.</span>{opt}</button>))}
          </div>
          <Lbl style={{display:"block", marginBottom:8}}>Work setup</Lbl>
          <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:20}}>
            {q.o2.map((opt,i)=>(<button key={i} onClick={()=>setAns({...ans,[qid]:{...(ans[qid]||{}),b:i}})} style={{padding:"12px 14px", fontSize:13, fontFamily:F.serif, textAlign:"left", background:(ans[qid]?.b===i)?"rgba(232,93,43,.1)":"transparent", border:`0.5px solid ${(ans[qid]?.b===i)?C.orange:C.border}`, cursor:"pointer", transition:"all .15s"}}><span style={{fontFamily:F.mono, fontSize:10, color:C.orange, fontWeight:600, marginRight:8}}>{String.fromCharCode(65+i)}.</span>{opt}</button>))}
          </div>
          <button onClick={()=>answer(ans[qid])} disabled={ans[qid]?.a===undefined||ans[qid]?.b===undefined} style={btnStyle(ans[qid]?.a!==undefined&&ans[qid]?.b!==undefined)}>See your Noorah Score →</button>
        </div>
      )}
      {!loadingFollowup && !q.type && (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {q.o.map((opt,i)=>(<button key={i} onClick={()=>answer(i)} style={{padding:"14px 16px", fontSize:14, fontFamily:F.serif, textAlign:"left", background:"transparent", border:`0.5px solid ${C.border}`, cursor:"pointer", lineHeight:1.6, transition:"all .15s"}} onMouseEnter={e=>{e.target.style.borderColor=C.orange;e.target.style.background="rgba(232,93,43,.04)"}} onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.background="transparent"}}><span style={{fontFamily:F.mono, fontSize:11, color:C.orange, fontWeight:600, marginRight:10}}>{String.fromCharCode(65+i)}.</span>{opt}</button>))}
        </div>
      )}
    </div>);
  }

  // ═══ RESULTS ═══
  if (mode === "results" && scores) {
    const sorted = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw);
    const topDimKey = scores.top;
    const topDimName = DIM_INFO[topDimKey]?.n || "";

    return (<div style={{...pg, maxWidth:580}} ref={topRef}>
      {/* ═══ SCORE SECTION ═══ */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
        <Lbl orange><Quote>Your Noorah score</Quote></Lbl>
        <span style={{display:"inline-block", padding:"4px 14px", border:`1.5px solid ${scores.sev === "Critical" ? C.orange : C.border}`, fontFamily:F.mono, fontSize:10, letterSpacing:2, textTransform:"uppercase", color:scores.sev === "Minimal" ? "#7B8F6B" : scores.sev === "Moderate" ? C.muted : C.orange}}>{scores.sev}</span>
      </div>
      <div style={{display:"flex", alignItems:"baseline", gap:12}}>
        <div style={{fontFamily:F.display, fontSize:140, lineHeight:.85, letterSpacing:-4, color:C.ink}}>{scores.total}</div>
        <div style={{fontFamily:F.mono, fontSize:13, color:C.muted}}>/100</div>
      </div>
      {scores.dataVerified && (
        <div style={{marginTop:8, display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:C.orange, color:C.bg, fontFamily:F.mono, fontSize:9, letterSpacing:2, fontWeight:600}}>
          <span style={{width:6, height:6, background:C.bg, borderRadius:"50%"}}></span>
          DATA-VERIFIED SCORE
        </div>
      )}

      {screentimeData?.valid && (() => {
        const isWeekly = screentimeData.view_type === "weekly";
        const label = isWeekly ? "Your week's data" : "Yesterday's data";
        const totalLabel = isWeekly ? "Daily average" : "Total";
        const appLabel = isWeekly ? "weekly" : "yesterday";
        return (
          <div style={{background:C.ink, color:C.bg, padding:"16px 20px", marginTop:16, borderLeft:`3px solid ${C.orange}`}}>
            <Lbl orange style={{display:"block", marginBottom:8, color:C.orange}}>{label}</Lbl>
            <div style={{fontFamily:F.mono, fontSize:12, lineHeight:1.8}}>
              {screentimeData.total_minutes > 0 && <div>{totalLabel}: {Math.floor(screentimeData.total_minutes/60)}h {screentimeData.total_minutes%60}m</div>}
              {screentimeData.top_apps?.length > 0 && (
                <div style={{marginTop:8, paddingTop:8, borderTop:`0.5px solid rgba(255,255,255,0.15)`}}>
                  <div style={{fontSize:10, letterSpacing:1, color:"rgba(255,255,255,0.6)", marginBottom:4, textTransform:"uppercase"}}>Top apps ({appLabel})</div>
                  {screentimeData.top_apps.map((app,i) => (<div key={i}>{String(i+1).padStart(2,"0")} → {app.name} ({Math.floor(app.minutes/60)}h {app.minutes%60}m)</div>))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ DIMENSIONS ═══ */}
      <div style={{borderTop:`1.5px solid ${C.ink}`, marginTop:24, paddingTop:16, marginBottom:28}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
          <Lbl>Dimensions</Lbl>
          <Lbl orange style={{fontSize:9}}>Hover for details</Lbl>
        </div>
        {sorted.map(([k,v],i)=>(<DimRow key={k} dimKey={k} rank={i+1} val={v} isTop={k === scores.top}/>))}
      </div>

      {/* ═══ TRANSITION — from score to plan ═══ */}
      <div style={{textAlign:"center", padding:"32px 16px", borderTop:`2px solid ${C.ink}`, borderBottom:`2px solid ${C.ink}`, marginBottom:32}}>
        <Lbl orange style={{display:"block", marginBottom:12}}>A number is just a number</Lbl>
        <p style={{fontFamily:F.serif, fontSize:22, fontStyle:"italic", lineHeight:1.4, color:C.ink, maxWidth:420, margin:"0 auto"}}>
          {name}, you've seen where you are. Now here's what it takes to get where you're going.
        </p>
      </div>

      {/* ═══ BENEFITS GRID ═══ */}
      <Lbl orange style={{display:"block", marginBottom:6, textAlign:"center"}}>What your plan includes</Lbl>
      <h2 style={{fontFamily:F.display, fontSize:32, letterSpacing:2, textAlign:"center", marginBottom:28, color:C.ink, lineHeight:1}}>BUILT FOR YOUR LIFE</h2>

      <div style={{display:"grid", gridTemplateColumns:"1fr", gap:14, marginBottom:32}}>
        {[
          { n:"01", t:"Your actual pattern, named", d:"Not a template. A plan built from your specific answers, your top apps, your actual hours, the thing you said you miss." },
          { n:"02", t:"8 weeks, week by week", d:"One shift per week. Three daily rhythms. One thing to notice. Not 56 tasks. A real rhythm that holds." },
          { n:"03", t:"Your Digital Constitution", d:"Seven personal rules you build to carry with you. Specific to your life, work, and family setup." },
          { n:"04", t:"Your Two-Minute Map", d:"What to do when the urge hits. Organized by the time you have — 2 minutes, 15 minutes, an hour, all afternoon." },
        ].map((b,i)=>(
          <div key={i} style={{display:"flex", gap:16, padding:"18px 20px", background:C.card, border:`0.5px solid ${C.border}`, borderLeft:`3px solid ${C.orange}`}}>
            <div style={{fontFamily:F.display, fontSize:32, color:C.orange, lineHeight:1, minWidth:40}}>{b.n}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C.ink, fontWeight:600, marginBottom:6}}>{b.t}</div>
              <div style={{fontFamily:F.serif, fontSize:14.5, lineHeight:1.6, color:C.muted}}>{b.d}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 8-WEEK TIMELINE ═══ */}
      <Lbl orange style={{display:"block", marginBottom:6, textAlign:"center"}}>What happens in 8 weeks</Lbl>
      <h2 style={{fontFamily:F.display, fontSize:32, letterSpacing:2, textAlign:"center", marginBottom:24, color:C.ink, lineHeight:1}}>THE JOURNEY</h2>

      <div style={{display:"grid", gridTemplateColumns:"1fr", gap:12, marginBottom:32}}>
        {[
          { w:"WEEK 1-2", p:"The Fast", d:"You break the loop. Apps come off. Withdrawal happens. You feel it honestly for the first time." },
          { w:"WEEK 3-4", p:"The Rebuild", d:"You rebuild what was replaced. Movement, connection, your lost analog activity returns." },
          { w:"WEEK 5-6", p:"The Return", d:"You let tools back in. One at a time. Under strict rules. Your rules this time." },
          { w:"WEEK 7-8", p:"The Anchor", d:"The new you holds. You teach someone else. You retake your score and see the number move." },
        ].map((ph,i)=>(
          <div key={i} style={{padding:"16px 18px", background:i===0?C.ink:C.card, color:i===0?C.bg:C.ink, border:`0.5px solid ${i===0?C.ink:C.border}`, position:"relative"}}>
            <div style={{display:"flex", alignItems:"baseline", gap:14, marginBottom:4}}>
              <Lbl style={{color:i===0?C.orange:C.orange, fontSize:9, letterSpacing:2}}>{ph.w}</Lbl>
              <span style={{fontFamily:F.serif, fontSize:16, fontStyle:"italic", color:i===0?C.bg:C.ink}}>{ph.p}</span>
            </div>
            <div style={{fontFamily:F.serif, fontSize:13.5, lineHeight:1.6, color:i===0?"rgba(245,240,232,0.75)":C.muted}}>{ph.d}</div>
          </div>
        ))}
      </div>

      {/* ═══ OUTCOMES ═══ */}
      <Lbl orange style={{display:"block", marginBottom:6, textAlign:"center"}}>What changes in your life</Lbl>
      <h2 style={{fontFamily:F.display, fontSize:32, letterSpacing:2, textAlign:"center", marginBottom:24, color:C.ink, lineHeight:1}}>ON THE OTHER SIDE</h2>

      <div style={{padding:"24px 20px", background:C.light, borderLeft:`3px solid ${C.orange}`, marginBottom:40}}>
        {[
          "Sleep that actually restores you.",
          "Meals and conversations with no phone on the table.",
          "Weekends that leave you lighter, not heavier.",
          "The feeling of being present in your own life again.",
        ].map((o,i)=>(
          <div key={i} style={{display:"flex", gap:12, marginBottom:i<3?14:0, alignItems:"flex-start"}}>
            <span style={{fontFamily:F.mono, fontSize:11, color:C.orange, fontWeight:600, lineHeight:1.5}}>→</span>
            <div style={{fontFamily:F.serif, fontSize:17, fontStyle:"italic", lineHeight:1.5, color:C.ink, flex:1}}>{o}</div>
          </div>
        ))}
      </div>

      {/* ═══ MAIN CTA ═══ */}
      <div style={{border:`2px solid ${C.ink}`, padding:24, position:"relative", marginBottom:32}}>
        <span style={{position:"absolute", top:-8, left:16, background:C.bg, padding:"0 8px", fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.orange, fontWeight:600}}>UNLOCK YOUR PLAN</span>
        <p style={{fontFamily:F.serif, fontSize:18, fontStyle:"italic", lineHeight:1.6, marginBottom:18, color:C.ink, textAlign:"center"}}>
          Your plan is ready to build. We already have your answers, your score, and your top pattern — <span style={{color:C.orange, fontWeight:500}}>{topDimName}</span>.
        </p>
        <button onClick={()=>setMode("generating")} style={{...btnStyle(), background:C.orange, padding:"18px", fontSize:13}} onMouseEnter={e=>e.target.style.background=C.ink} onMouseLeave={e=>e.target.style.background=C.orange}>Get your 8-week plan → $9.99</button>
        <div style={{display:"flex", justifyContent:"center", gap:14, marginTop:12, flexWrap:"wrap"}}>
          <Lbl style={{fontSize:8}}>8 weeks</Lbl>
          <span style={{color:C.border}}>·</span>
          <Lbl style={{fontSize:8}}>Printable PDF</Lbl>
          <span style={{color:C.border}}>·</span>
          <Lbl style={{fontSize:8}}>Yours forever</Lbl>
          <span style={{color:C.border}}>·</span>
          <Lbl style={{fontSize:8}}>Ready in 60 seconds</Lbl>
        </div>
      </div>

      {/* ═══ FAQ ═══ */}
      <Lbl orange style={{display:"block", marginBottom:6, textAlign:"center"}}>Before you decide</Lbl>
      <h2 style={{fontFamily:F.display, fontSize:28, letterSpacing:2, textAlign:"center", marginBottom:20, color:C.ink, lineHeight:1}}>COMMON QUESTIONS</h2>

      <div style={{marginBottom:32}}>
        {[
          { q:"Is this just another detox?", a:"No. A detox is subtraction. This is replacement. You remove what's hurting and rebuild what you actually want in its place." },
          { q:"What if I can't follow it perfectly?", a:"Nobody does. The plan assumes you'll fall off somewhere — that's built in. Week by week, not day by day. You can't fail a rhythm, you can only restart it." },
          { q:"Why $9.99?", a:"Because free products get ignored. A small commitment you made is one you're more likely to honor. It's priced to matter but not to block anyone." },
        ].map((f,i)=>(
          <details key={i} style={{marginBottom:10, border:`0.5px solid ${C.border}`}}>
            <summary style={{cursor:"pointer", padding:"14px 18px", fontFamily:F.serif, fontSize:15, fontWeight:500, color:C.ink, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <span>{f.q}</span>
              <span style={{color:C.orange, fontFamily:F.mono, fontSize:11}}>+</span>
            </summary>
            <div style={{padding:"0 18px 16px", fontFamily:F.serif, fontSize:14, lineHeight:1.7, color:C.muted}}>{f.a}</div>
          </details>
        ))}
      </div>

      {/* ═══ SECONDARY CTA ═══ */}
      <div style={{textAlign:"center", padding:"24px 16px", background:C.card, border:`0.5px solid ${C.border}`, marginBottom:20}}>
        <p style={{fontFamily:F.serif, fontSize:16, fontStyle:"italic", color:C.ink, lineHeight:1.5, marginBottom:16}}>Ready when you are.</p>
        <button onClick={()=>setMode("generating")} style={{...btnStyle(), background:C.ink}} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Get your 8-week plan → $9.99</button>
      </div>
    </div>);
  }

  // ═══ GENERATING ═══
  if (mode === "generating") {
    const quote = LOADING_QUOTES[loadingQuoteIdx];
    return (<div style={{...pg, maxWidth:500, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
      <div style={{textAlign:"center", marginBottom:32}}>
        <Lbl orange style={{display:"block", marginBottom:12}}><Quote>Building your 8-week plan</Quote></Lbl>
        <p style={{fontFamily:F.mono, fontSize:11, color:C.muted, letterSpacing:1}}>30–45 seconds. Stay with it.</p>
      </div>
      <div style={{borderTop:`1.5px solid ${C.ink}`, borderBottom:`1.5px solid ${C.ink}`, padding:"32px 20px", margin:"0 0 24px", minHeight:180, display:"flex", flexDirection:"column", justifyContent:"center", position:"relative"}}>
        <span style={{position:"absolute", top:-8, left:16, background:C.bg, padding:"0 8px", fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.orange, fontWeight:600}}>{String(loadingQuoteIdx+1).padStart(2,"0")} / {String(LOADING_QUOTES.length).padStart(2,"0")}</span>
        <p key={loadingQuoteIdx} style={{fontFamily:F.serif, fontSize:21, fontStyle:"italic", lineHeight:1.6, color:C.ink, textAlign:"center", animation:"fi 0.6s ease-in"}}><span style={{color:C.orange, fontWeight:600, fontSize:24}}>"</span>{quote.q}<span style={{color:C.orange, fontWeight:600, fontSize:24}}>"</span></p>
        <p style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, color:C.muted, textAlign:"center", marginTop:16}}>— {quote.a.toUpperCase()}</p>
      </div>
      <div style={{display:"flex", justifyContent:"center", gap:8, marginTop:8}}>{[0,1,2,3,4].map(i=>(<div key={i} style={{width:8, height:8, background:C.orange, opacity:.3, animation:`f 1.5s ease-in-out ${i*.2}s infinite`}}/>))}</div>
      <style>{`@keyframes f{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>);
  }

  // ═══ ERROR ═══
  if (mode === "error") return (<div style={{...pg, maxWidth:540, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
    <div style={{borderTop:`2px solid ${C.orange}`, borderBottom:`0.5px dashed ${C.border}`, padding:"24px 0", marginBottom:24}}>
      <Lbl orange style={{display:"block", marginBottom:12}}><Quote>Something interrupted us</Quote></Lbl>
      <h2 style={{fontFamily:F.display, fontSize:42, letterSpacing:2, lineHeight:1, marginBottom:16, color:C.ink}}>A PAUSE.</h2>
      <p style={{fontFamily:F.serif, fontSize:17, lineHeight:1.7, color:C.ink, marginBottom:12, fontStyle:"italic"}}>{name}, something interrupted your plan while it was being built. Not you. Us.</p>
      <p style={{fontFamily:F.serif, fontSize:15, lineHeight:1.7, color:C.muted}}>
        Your answers are saved. Your score is saved. We've been notified. Either try again right now, or your plan will arrive at <span style={{color:C.ink, fontWeight:500}}>{email}</span> within 24 hours. You don't need to do anything.
      </p>
    </div>

    <button onClick={retryPlan} style={{...btnStyle(), background:C.orange, marginBottom:10}} onMouseEnter={e=>e.target.style.background=C.ink} onMouseLeave={e=>e.target.style.background=C.orange}>
      Try again →
    </button>

    <button onClick={()=>{setMode("start");setName("");setEmail("");setAns({});setFollowupAnswers({});setScreentimeData(null);setScores(null);setPlan("");setErrorDetails("");setQi(0);setShowPart2Intro(false)}} style={{background:"transparent", border:`0.5px solid ${C.border}`, padding:"12px", fontFamily:F.mono, fontSize:11, letterSpacing:2, textTransform:"uppercase", color:C.muted, cursor:"pointer"}}>
      Return to start
    </button>

    {errorDetails && (
      <details style={{marginTop:20, fontFamily:F.mono, fontSize:10, color:C.border}}>
        <summary style={{cursor:"pointer", letterSpacing:2}}>TECHNICAL DETAILS</summary>
        <div style={{marginTop:8, padding:10, background:C.light, color:C.muted, lineHeight:1.6}}>{errorDetails}</div>
      </details>
    )}
  </div>);

  // ═══ PLAN ═══
  if (mode === "plan") {
    const parsed = parsePlan();
    const topDimName = scores?.top ? (DIM_INFO[scores.top]?.n || "") : "";
    // Find the current week (lowest numbered expanded week, else week 1)
    const currentWeekNum = parsed.weeks.length > 0 ? Math.min(...Array.from(expandedWeeks)) || 1 : 1;
    const currentWeek = parsed.weeks.find(w => w.num === currentWeekNum) || parsed.weeks[0];
    // Determine current phase based on current week
    const phaseMap = [
      {weeks:[1,2], label:"The fast"},
      {weeks:[3,4], label:"The rebuild"},
      {weeks:[5,6], label:"The return"},
      {weeks:[7,8], label:"The anchor"},
    ];
    const getPhaseForWeek = (n) => phaseMap.findIndex(p => p.weeks.includes(n));
    const currentPhaseIdx = getPhaseForWeek(currentWeekNum);
    // Rotate today's focus through current week's rhythm
    const todayIdx = new Date().getDate() % Math.max(1, currentWeek?.rhythm?.length || 1);
    const todaysFocus = currentWeek?.rhythm?.[todayIdx] || currentWeek?.shift || "";

    const toggleWeek = (num) => {
      setExpandedWeeks(prev => {
        const next = new Set(prev);
        if (next.has(num)) next.delete(num); else next.add(num);
        return next;
      });
    };

    return (<div style={{...pg, maxWidth:640}} ref={topRef}>
      {/* ═══ HEADER ═══ */}
      <div style={{textAlign:"center", paddingBottom:18, borderBottom:`2px solid ${C.ink}`, marginBottom:20}}>
        <Lbl orange style={{display:"block", marginBottom:6}}>Noorah</Lbl>
        <h1 style={{fontFamily:F.display, fontSize:34, letterSpacing:2, lineHeight:1}}>{name.toUpperCase()}'S 8-WEEK PLAN</h1>
        <Lbl style={{display:"block", marginTop:6, fontSize:9}}>Score {scores?.total}/100 · {scores?.sev?.toUpperCase()} · {new Date().toLocaleDateString()}</Lbl>
      </div>

      {/* ═══ HERO CARD — dark, score + this week's focus ═══ */}
      {currentWeek && (
        <div className="hero-card" style={{background:C.ink, color:C.bg, padding:"26px 24px", marginBottom:24, position:"relative", borderLeft:`4px solid ${C.orange}`}}>
          <div style={{position:"absolute", top:-9, left:18, background:C.bg, padding:"0 8px", fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.orange, fontWeight:600}}>THIS WEEK</div>

          <div style={{display:"flex", gap:20, alignItems:"flex-start", marginBottom:18, flexWrap:"wrap"}}>
            {/* LEFT: Name + score + top pattern */}
            <div style={{flex:"1 1 200px", minWidth:180}}>
              <div style={{fontFamily:F.mono, fontSize:10, letterSpacing:2.5, color:C.orange, marginBottom:4}}>{name.toUpperCase()}</div>
              <div style={{fontFamily:F.display, fontSize:72, lineHeight:.85, color:C.bg, letterSpacing:-3}}>{scores?.total}</div>
              <div style={{fontFamily:F.mono, fontSize:11, color:"rgba(245,240,232,0.55)", marginTop:2}}>/100 · {scores?.sev?.toUpperCase()}</div>
              {topDimName && (
                <div style={{display:"inline-block", marginTop:14, padding:"4px 10px", background:"rgba(232,93,43,0.2)", color:C.orange, fontFamily:F.mono, fontSize:9, letterSpacing:2, fontWeight:600, border:`0.5px solid ${C.orange}`}}>
                  ▲ TOP PATTERN — {topDimName.toUpperCase()}
                </div>
              )}
            </div>
            {/* RIGHT: this week's shift */}
            <div style={{flex:"1 1 240px", minWidth:200, paddingLeft:18, borderLeft:`0.5px dashed rgba(245,240,232,0.2)`}}>
              <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2.5, color:C.orange, fontWeight:600, marginBottom:6}}>WEEK {currentWeek.num} → {(currentWeek.title || "").toUpperCase()}</div>
              <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2, color:"rgba(245,240,232,0.5)", marginBottom:8}}>THIS WEEK'S SHIFT</div>
              <div style={{fontFamily:F.serif, fontSize:16, lineHeight:1.5, color:C.bg, marginBottom:14}}>{currentWeek.shift}</div>
              <button onClick={()=>{
                if (!expandedWeeks.has(currentWeek.num)) toggleWeek(currentWeek.num);
                setTimeout(()=>{document.getElementById(`week-${currentWeek.num}`)?.scrollIntoView({behavior:"smooth", block:"start"});}, 80);
              }} style={{padding:"10px 16px", background:C.orange, color:C.bg, fontFamily:F.mono, fontSize:10, letterSpacing:2, fontWeight:600, border:"none", cursor:"pointer"}}>START WITH WEEK {currentWeek.num} →</button>
            </div>
          </div>

          {/* Today's focus strip */}
          {todaysFocus && (
            <div style={{paddingTop:14, borderTop:`0.5px dashed rgba(245,240,232,0.2)`, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
              <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2, color:C.orange, fontWeight:600, flexShrink:0}}>TODAY →</div>
              <div style={{fontFamily:F.serif, fontSize:14, fontStyle:"italic", color:"rgba(245,240,232,0.85)", lineHeight:1.4}}>{todaysFocus}</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PHASE GRID with current highlighted ═══ */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, border:`0.5px solid ${C.border}`, marginBottom:24}}>
        {phaseMap.map((ph,i)=>(
          <div key={i} style={{padding:"12px 14px", borderRight:i%2===0?`0.5px solid ${C.border}`:"none", borderBottom:i<2?`0.5px solid ${C.border}`:"none", background:i===currentPhaseIdx?C.card:"transparent"}}>
            <Lbl orange style={{fontSize:9}}>{`WEEK ${ph.weeks[0]}-${ph.weeks[1]}`}{i===currentPhaseIdx?" · NOW":""}</Lbl>
            <div style={{fontFamily:F.serif, fontSize:14, marginTop:2, color:i===currentPhaseIdx?C.ink:C.muted, fontStyle:i===currentPhaseIdx?"normal":"italic"}}>{ph.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ JUMP NAV ═══ */}
      <div className="no-print" style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`0.5px solid ${C.border}`, marginBottom:22, flexWrap:"wrap", gap:8}}>
        <div style={{fontFamily:F.mono, fontSize:9, letterSpacing:2, color:C.muted}}>JUMP TO:</div>
        <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
          {[
            {label:"PATTERN", id:"sec-pattern"},
            {label:"WEEKS", id:"sec-weeks"},
            {label:"MAP", id:"sec-map"},
            {label:"RULES", id:"sec-rules"},
            {label:"ONE THING", id:"sec-onething"},
          ].map((item,i)=>(
            <span key={i} style={{display:"inline-flex", alignItems:"center", gap:10}}>
              <button onClick={()=>document.getElementById(item.id)?.scrollIntoView({behavior:"smooth"})} style={{background:"transparent", border:"none", padding:0, color:C.muted, fontFamily:F.mono, fontSize:9, letterSpacing:1.5, cursor:"pointer", fontWeight:500}} onMouseEnter={e=>e.target.style.color=C.orange} onMouseLeave={e=>e.target.style.color=C.muted}>{item.label}</button>
              {i<4 && <span style={{color:C.border}}>·</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ EXPAND/COLLAPSE CONTROLS ═══ */}
      <div className="no-print" style={{display:"flex", gap:8, marginBottom:16, justifyContent:"flex-end"}}>
        <button onClick={()=>{
          setExpandedWeeks(new Set(parsed.weeks.map(w=>w.num)));
          document.querySelectorAll('details').forEach(d=>d.open=true);
        }} style={{background:"transparent", border:`0.5px solid ${C.border}`, padding:"6px 12px", fontFamily:F.mono, fontSize:9, letterSpacing:2, textTransform:"uppercase", color:C.muted, cursor:"pointer"}}>Expand all</button>
        <button onClick={()=>{
          setExpandedWeeks(new Set());
          document.querySelectorAll('details').forEach(d=>d.open=false);
        }} style={{background:"transparent", border:`0.5px solid ${C.border}`, padding:"6px 12px", fontFamily:F.mono, fontSize:9, letterSpacing:2, textTransform:"uppercase", color:C.muted, cursor:"pointer"}}>Collapse all</button>
      </div>

      {/* ═══ YOUR PATTERN ═══ */}
      {parsed.pattern && (
        <details open id="sec-pattern" style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Quote>{parsed.pattern.title}</Quote>
            <span className="no-print" style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO TOGGLE</span>
          </summary>
          <div style={{fontFamily:F.serif, fontSize:15, lineHeight:1.75, color:C.ink}}>{parsed.pattern.body}</div>
        </details>
      )}

      {/* ═══ YOUR NUMBERS ═══ */}
      {parsed.numbers && scores && (
        <details open id="sec-numbers" style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Quote>{parsed.numbers.title}</Quote>
            <span className="no-print" style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO TOGGLE</span>
          </summary>
          <div style={{fontFamily:F.serif, fontSize:15, lineHeight:1.75, color:C.ink}}>{formatBody(parsed.numbers.body)}</div>
          <div style={{marginTop:14, padding:"12px 16px", background:C.light, borderLeft:`2px solid ${C.orange}`}}>
            <Lbl orange style={{display:"block", marginBottom:8, fontSize:9}}>Hover the dimension name to learn more</Lbl>
            {Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw).slice(0,3).map(([k,v],idx)=>(
              <div key={k} style={{fontFamily:F.serif, fontSize:14, marginBottom:6, lineHeight:1.6}}>
                <span style={{fontFamily:F.mono, fontSize:10, color:C.orange, marginRight:8}}>{String(idx+1).padStart(2,"0")}</span>
                <PlanDim dimKey={k} score={v.raw} max={v.max} />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ═══ WEEKS SECTION ═══ */}
      {parsed.weeks.length > 0 && (
        <div id="sec-weeks" style={{marginBottom:28}}>
          <div style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10}}>
            <Quote>The 8 weeks</Quote>
          </div>
          {parsed.weeks.map(week => (
            <div key={week.num} id={`week-${week.num}`}>
              <WeekCard
                week={week}
                expanded={expandedWeeks.has(week.num)}
                onToggle={()=>toggleWeek(week.num)}
                isCurrent={week.num === currentWeekNum && expandedWeeks.has(week.num)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ═══ YOUR TWO-MINUTE MAP ═══ */}
      {parsed.twoMinuteMap && (
        <details id="sec-map" style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Quote>{parsed.twoMinuteMap.title}</Quote>
            <span className="no-print" style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO TOGGLE</span>
          </summary>
          <div>{formatBody(parsed.twoMinuteMap.body)}</div>
        </details>
      )}

      {/* ═══ YOUR SEVEN ═══ */}
      {parsed.seven && (
        <details id="sec-rules" style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Quote>{parsed.seven.title}</Quote>
            <span className="no-print" style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO TOGGLE</span>
          </summary>
          <div>{formatBody(parsed.seven.body)}</div>
        </details>
      )}

      {/* ═══ ONE THING ═══ */}
      {parsed.oneThing && (
        <details open id="sec-onething" style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:14, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <Quote>{parsed.oneThing.title}</Quote>
            <span className="no-print" style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO TOGGLE</span>
          </summary>
          <div style={{fontFamily:F.serif, fontSize:16, lineHeight:1.75, color:C.ink, fontStyle:"italic"}}>{parsed.oneThing.body}</div>
        </details>
      )}

      {/* ═══ ACTION BUTTONS ═══ */}
      <div className="no-print" style={{borderTop:`2px solid ${C.ink}`, paddingTop:20, marginTop:16, display:"flex", gap:8}}>
        <button onClick={()=>{
          setExpandedWeeks(new Set(parsed.weeks.map(w=>w.num)));
          document.querySelectorAll('details').forEach(d=>d.open=true);
          setTimeout(()=>window.print(), 350);
        }} style={{...btnStyle(), flex:1}} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Print / Save PDF</button>
        <button onClick={()=>{setMode("start");setName("");setEmail("");setAns({});setFollowupAnswers({});setScreentimeData(null);setScores(null);setPlan("");setQi(0);setShowPart2Intro(false);setExpandedWeeks(new Set([1]))}} style={{flex:1, padding:14, fontFamily:F.mono, fontSize:12, letterSpacing:2, textTransform:"uppercase", background:"transparent", color:C.muted, border:`0.5px solid ${C.border}`, cursor:"pointer"}}>Done</button>
      </div>
      <Lbl className="no-print" style={{display:"block", textAlign:"center", marginTop:20, fontSize:8, color:C.border}}>Generated by Noorah · The digital intent company · {new Date().getFullYear()}</Lbl>

      <style>{`
        @media print {
          details { page-break-inside: avoid; }
          details > summary { list-style: none !important; }
          details[open] > summary span:last-child { display: none !important; }
          .no-print { display: none !important; }
          .week-card { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 16px !important; }
          .hero-card { break-inside: avoid !important; page-break-inside: avoid !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>);
  }

  return null;
}
