import { useState, useEffect, useRef } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";
import { PLAN_PROMPT } from "./planPrompt";
import { FOLLOWUP_PROMPT } from "./followupPrompt";

// ═══════════════════════════════════════
// DESIGN — Abloh × Müller
// ═══════════════════════════════════════
const F = { display: "'Bebas Neue', sans-serif", mono: "'IBM Plex Mono', monospace", serif: "'Cormorant Garamond', Georgia, serif" };
const C = { bg: "#F5F0E8", card: "#FDFBF7", ink: "#1A1A1A", orange: "#E85D2B", muted: "#999999", border: "#E0DCD4", light: "#F0ECE4" };

// ═══════════════════════════════════════
// DIMENSION INFO (for hover panels)
// ═══════════════════════════════════════
const DIM_INFO = {
  dop: { n: "Reward patterns", desc: "How much your phone pulls you back — the compulsive checking, the craving, the need for more to feel the same. This is the dependency pattern." },
  att: { n: "Attention continuity", desc: "How fragmented your focus has become. How long you can sit with one thing before reaching for a screen. The cost of constant interruption." },
  emo: { n: "Emotional coping", desc: "Using screens to avoid feeling something — stress, boredom, silence, loneliness. The phone as a comfort blanket you never put down." },
  env: { n: "Environment & defaults", desc: "How your physical space and device settings work against you. The charger by the bed. Autoplay on. Notifications never configured. The walls can be moved." },
  val: { n: "Values alignment", desc: "The gap between what you say matters most and how you actually spend your hours. When the gap is big, something's off — and you already know." },
  drn: { n: "Time & money drain", desc: "What's bleeding out through subscriptions you forgot, hours you can't account for, purchases you didn't mean to make." },
};

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
// QUIZ — 10 QUESTIONS, 2 PARTS
// Part 1 (5 Qs): Your Pattern — opening text + 4 dimension screens
// Part 2 (5 Qs): Your Life — 3 remaining screens + lost activity text + living/work combo
// ═══════════════════════════════════════
const Q = {
  // PART 1 — YOUR PATTERN
  p1_gateway: { t: "What's the one thing about your relationship with technology you most wish were different?", type: "text", part: 1 },
  p1_fast: { t: "If you imagined two weeks completely unplugged — what's your gut reaction?", o: ["Relief — sign me up", "Curious — I'd try it", "Anxious — what would I do?", "Impossible — can't even picture it"], s: [0,1,2,3], d: "dop", part: 1 },
  p1_check: { t: "How often do you pick up your phone with no reason — just to check?", o: ["Rarely", "A few times a day", "Many times a day", "Constantly — my hand just moves"], s: [0,2,4,6], d: "dop", part: 1 },
  p1_focus: { t: "How long can you focus on something important before reaching for your phone?", o: ["An hour+", "~30 minutes", "~15 minutes", "Less than 5 minutes"], s: [0,2,4,6], d: "att", part: 1 },
  p1_reach: { t: "When you feel stressed, bored, or anxious — what's the first thing you reach for?", o: ["A walk or a call", "Sometimes my phone, sometimes not", "Usually my phone", "Always my phone — automatic"], s: [0,2,4,6], d: "emo", part: 1 },

  // PART 2 — YOUR LIFE
  p2_sleep: { t: "Where does your phone sleep at night?", o: ["Another room", "My room but not reachable", "Nightstand", "Under my pillow or in my hand"], s: [0,1,3,5], d: "env", part: 2 },
  p2_values: { t: "Does how you spend your screen time match what you say matters most?", o: ["Yes, mostly", "Some gaps", "Big disconnect", "I try not to think about it"], s: [0,1,3,4], d: "val", part: 2 },
  p2_subs: { t: "How many subscriptions do you pay for that you haven't used in 30 days?", o: ["None", "1-2 I should cancel", "3-5 I forgot about", "Honestly don't know"], s: [0,1,2,3], d: "drn", part: 2 },
  p2_analog: { t: "What's something analog you used to love doing — but stopped?", type: "text", part: 2 },
  p2_context: { t: "Who are you doing this for? And what's your work setup?", type: "double", o1: ["Alone", "With partner", "With family/kids", "With roommates"], o2: ["Fully remote", "Hybrid", "In-office", "Not currently working"], part: 2 },
};

const QUIZ_ORDER = ["p1_gateway", "p1_fast", "p1_check", "p1_focus", "p1_reach", "p2_sleep", "p2_values", "p2_subs", "p2_analog", "p2_context"];
const DIM = { dop: {n:"Reward patterns",x:25}, att: {n:"Attention continuity",x:20}, emo: {n:"Emotional coping",x:20}, env: {n:"Environment & defaults",x:15}, val: {n:"Values alignment",x:10}, drn: {n:"Time & money drain",x:10} };

function calc(a) {
  const dims = {}; Object.keys(DIM).forEach(k => dims[k] = {raw:0, max:DIM[k].x});
  Object.entries(a).forEach(([id, v]) => {
    const q = Q[id];
    if (!q || q.type === "text" || q.type === "double") return;
    const s = q.s?.[v] || 0;
    if (q.d && dims[q.d]) dims[q.d].raw += s;
  });
  // Because we cut the deep-dive, amplify the single screening question to approximate the full max
  // p1_check gives max 6 but dop max is 25 — so we scale proportionally
  dims.dop.raw = Math.min(Math.round(dims.dop.raw * (25/9)), 25); // dop has 2 questions: fast (max 3) + check (max 6) = 9
  dims.att.raw = Math.min(Math.round(dims.att.raw * (20/6)), 20);
  dims.emo.raw = Math.min(Math.round(dims.emo.raw * (20/6)), 20);
  dims.env.raw = Math.min(Math.round(dims.env.raw * (15/5)), 15);
  // val and drn are already out of their max
  const total = Object.values(dims).reduce((s, d) => s + d.raw, 0);
  const sev = total <= 25 ? "Minimal" : total <= 45 ? "Moderate" : total <= 65 ? "Significant" : "Critical";
  const fast = total <= 25 ? "Level 1 (3 days)" : total <= 45 ? "Levels 1-2 (7 days)" : total <= 65 ? "Levels 1-3 (14 days)" : "Full protocol (14+ days)";
  const top = Object.entries(dims).sort((a, b) => b[1].raw - a[1].raw)[0][0];
  return {total, dims, mk:{tolerance:0,withdrawal:0,imbalance:0,honesty:0}, sev, fast, top};
}

function cleanText(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/^#+\s*/gm, "").replace(/^—+$/gm, "").trim();
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
  const [scores, setScores] = useState(null);
  const [plan, setPlan] = useState("");
  const [loadingQuoteIdx, setLoadingQuoteIdx] = useState(0);
  const [adminPw, setAdminPw] = useState("");
  const [subs, setSubs] = useState([]);
  const topRef = useRef(null);

  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("paid") === "true") { window.history.replaceState({}, "", window.location.pathname); const s = sessionStorage.getItem("n_scores"), a = sessionStorage.getItem("n_ans"), nm = sessionStorage.getItem("n_name"), em = sessionStorage.getItem("n_email"), fu = sessionStorage.getItem("n_followups"); if (s && a) { setScores(JSON.parse(s)); setAns(JSON.parse(a)); setName(nm || ""); setEmail(em || ""); if (fu) setFollowupAnswers(JSON.parse(fu)); setMode("generating"); } } }, []);
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
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ system:FOLLOWUP_PROMPT, messages:[{role:"user",content:ctx}], maxTokens:200 }) });
      const data = await res.json();
      return (data.text || "").trim().replace(/^["']|["']$/g, "");
    } catch(e) { return null; } finally { setLoadingFollowup(false); }
  }

  async function answer(val) {
    const qid = QUIZ_ORDER[qi];
    const q = Q[qid];
    const newAns = { ...ans, [qid]: val };
    setAns(newAns);

    // AI follow-up on the two open text questions
    if ((qid === "p1_gateway" || qid === "p2_analog") && q.type === "text" && typeof val === "string" && val.trim().length > 10) {
      const followupQ = await fetchFollowup(q.t, val);
      if (followupQ) {
        setCurrentFollowup({ qid, question: followupQ, originalAnswer: val });
        setFollowupInput("");
        return;
      }
    }
    advanceQuestion(newAns);
  }

  function advanceQuestion(newAns) {
    // After Q5 (p1_reach), show part 2 intro celebration screen
    if (qi === 4) { setShowPart2Intro(true); return; }

    // After last question, finish
    if (qi === QUIZ_ORDER.length - 1) {
      const s = calc(newAns); setScores(s);
      sessionStorage.setItem("n_scores", JSON.stringify(s));
      sessionStorage.setItem("n_ans", JSON.stringify(newAns));
      sessionStorage.setItem("n_name", name);
      sessionStorage.setItem("n_email", email);
      sessionStorage.setItem("n_followups", JSON.stringify(followupAnswers));
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:newAns.p1_gateway||"", total:s.total, dimensions:s.dims, severity:s.sev, prescription:s.fast, lembke:s.mk, context:{ living:Q.p2_context.o1?.[newAns.p2_context?.a]||"", work:Q.p2_context.o2?.[newAns.p2_context?.b]||"", lostActivity:newAns.p2_analog||"" }, plan:"" }).catch(()=>{});
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
    const ctx = `Generate a personalized 8-week plan (56 days) for:
Name: ${name}
Score: ${scores.total}/100 (${scores.sev})
Top dimension: ${DIM[scores.top].n}
Dimensions: ${topDims.map(([k,v])=>`${DIM[k].n}: ${v.raw}/${v.max}`).join(", ")}
What brought them here: "${ans.p1_gateway||""}"
Fasting reaction: "${Q.p1_fast.o?.[ans.p1_fast]||""}"
Living: ${Q.p2_context.o1?.[ans.p2_context?.a]||""}
Work: ${Q.p2_context.o2?.[ans.p2_context?.b]||""}
Lost activity: "${ans.p2_analog||""}"
Prescribed fast: ${scores.fast}
${followupContext ? "\nFOLLOW-UP CONTEXT:\n"+followupContext : ""}

Write their plan now. Reference their specific words. NO markdown bold, NO markdown italic, NO hashtags except ### for sections.`;
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ system:PLAN_PROMPT, messages:[{role:"user",content:ctx}] }) });
      const data = await res.json();
      const text = cleanText(data.text || "Plan generation failed. Please refresh.");
      setPlan(text);
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:ans.p1_gateway||"", total:scores.total, dimensions:scores.dims, severity:scores.sev, prescription:scores.fast, lembke:scores.mk, context:{ living:Q.p2_context.o1?.[ans.p2_context?.a]||"", work:Q.p2_context.o2?.[ans.p2_context?.b]||"", lostActivity:ans.p2_analog||"" }, plan:text }).catch(()=>{});
      setMode("plan");
    } catch(e) { setPlan("Something went wrong. Please refresh and try again."); setMode("plan"); }
  }

  function renderPlan() {
    const sections = plan.split(/###\s*/g).filter(s=>s.trim());
    return sections.map((sec, i) => {
      const lines = sec.trim().split("\n");
      const title = lines[0]?.trim();
      const body = lines.slice(1).join("\n").trim();
      const isPhase = title?.toLowerCase().includes("phase");
      const isNumbers = title?.toLowerCase().includes("number");

      const fmt = (text) => text.split("\n").map((line, j) => {
        const dm = line.match(/^Day\s+(\d+):\s*(.*)/);
        const pm = line.match(/^>\s*(.*)/);
        const rule = line.match(/^(\d+)\.\s+(.*)/);
        if (dm) return (<div key={j} style={{marginTop:18, marginBottom:2, display:"flex", gap:12, alignItems:"flex-start"}}><span style={{fontFamily:F.display, fontSize:32, color:C.orange, lineHeight:1, minWidth:44}}>{dm[1].padStart(2,"0")}</span><div style={{flex:1}}><div style={{fontFamily:F.serif, fontSize:16, lineHeight:1.7, color:C.ink}}>{dm[2]}</div></div></div>);
        if (pm) return (<div key={j} style={{fontFamily:F.serif, fontStyle:"italic", fontSize:14, color:C.muted, marginBottom:14, marginLeft:56, paddingLeft:12, borderLeft:`2px solid ${C.orange}`, lineHeight:1.6}}>{pm[1]}</div>);
        if (rule) return (<div key={j} style={{display:"flex", gap:12, padding:"10px 0", borderBottom:`0.5px solid ${C.border}`}}><span style={{fontFamily:F.display, fontSize:24, color:C.orange, minWidth:28, lineHeight:1}}>{rule[1].padStart(2,"0")}</span><div style={{fontFamily:F.serif, fontSize:15, lineHeight:1.6, color:C.ink, flex:1}}>{rule[2]}</div></div>);
        if (line.trim() === "") return <div key={j} style={{height:6}}/>;
        if (line.startsWith("-")) return (<div key={j} style={{fontFamily:F.serif, fontSize:15, lineHeight:1.8, color:C.ink, marginBottom:4, paddingLeft:16, position:"relative"}}><span style={{position:"absolute", left:0, color:C.orange, fontFamily:F.mono, fontSize:12}}>→</span>{line.replace(/^-\s*/, "")}</div>);
        if (line.match(/^When you.*:$/i)) return <div key={j} style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C.orange, fontWeight:600, margin:"16px 0 8px", paddingTop:12, borderTop:`0.5px solid ${C.border}`}}>{line}</div>;
        return <div key={j} style={{fontFamily:F.serif, fontSize:15, lineHeight:1.8, color:C.ink, marginBottom:4}}>{line}</div>;
      });

      if (isNumbers && scores) {
        const topDims = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw).slice(0,3);
        return (
          <div key={i} style={{marginBottom:28}}>
            <div style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, marginBottom:10, borderBottom:`0.5px dashed ${C.border}`, paddingBottom:8}}><Quote>{title}</Quote></div>
            <div style={{fontFamily:F.serif, fontSize:15, lineHeight:1.8, color:C.ink}}>{fmt(body)}</div>
            <div style={{marginTop:16, padding:"12px 16px", background:C.light, borderLeft:`2px solid ${C.orange}`}}>
              <Lbl orange style={{display:"block", marginBottom:8, fontSize:9}}>Hover the dimension name to learn more</Lbl>
              {topDims.map(([k,v],idx)=>(<div key={k} style={{fontFamily:F.serif, fontSize:14, marginBottom:6, lineHeight:1.6}}><span style={{fontFamily:F.mono, fontSize:10, color:C.orange, marginRight:8}}>{String(idx+1).padStart(2,"0")}</span><PlanDim dimKey={k} score={v.raw} max={v.max} /></div>))}
            </div>
          </div>
        );
      }

      if (isPhase) return (
        <details key={i} open={i<=2} style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, cursor:"pointer", marginBottom:12, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:10, listStyle:"none", display:"flex", justifyContent:"space-between"}}>
            <Quote>{title}</Quote><span style={{color:C.muted, fontWeight:400, fontSize:9, letterSpacing:1}}>TAP TO EXPAND</span>
          </summary>
          <div>{fmt(body)}</div>
        </details>
      );

      return (
        <div key={i} style={{marginBottom:28}}>
          <div style={{fontFamily:F.mono, fontSize:10, fontWeight:600, letterSpacing:2, textTransform:"uppercase", color:C.orange, marginBottom:10, borderBottom:`0.5px dashed ${C.border}`, paddingBottom:8}}><Quote>{title}</Quote></div>
          <div>{fmt(body)}</div>
        </div>
      );
    });
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

  // ═══ PART 2 INTRO (reward screen after Q5) ═══
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
    // Follow-up question screen
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
    const partTotal = 5;
    const partIndex = qi < 5 ? qi + 1 : qi - 4;
    const pct = ((qi+1)/10)*100;

    return (<div style={{...pg, maxWidth:520, display:"flex", flexDirection:"column", justifyContent:"center"}} ref={topRef}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <Lbl orange>Part {part} of 2 → {part===1?"Your pattern":"Your life"}</Lbl>
        <Lbl>{String(partIndex).padStart(2,"0")} / 0{partTotal}</Lbl>
      </div>
      <div style={{height:2, background:C.border, marginBottom:28}}><div style={{height:2, background:C.orange, width:`${pct}%`, transition:"width 0.3s"}}/></div>
      <h2 style={{fontFamily:F.serif, fontSize:22, fontWeight:400, fontStyle:"italic", lineHeight:1.6, marginBottom:24, minHeight:60}}>{q.t}</h2>
      {loadingFollowup && (<div style={{textAlign:"center", padding:40}}><Lbl orange>Noorah is thinking...</Lbl></div>)}
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
            {q.o1.map((opt,i)=>(
              <button key={i} onClick={()=>setAns({...ans,[qid]:{...(ans[qid]||{}),a:i}})} style={{padding:"12px 14px", fontSize:13, fontFamily:F.serif, textAlign:"left", background:(ans[qid]?.a===i)?"rgba(232,93,43,.1)":"transparent", border:`0.5px solid ${(ans[qid]?.a===i)?C.orange:C.border}`, cursor:"pointer", transition:"all .15s"}}><span style={{fontFamily:F.mono, fontSize:10, color:C.orange, fontWeight:600, marginRight:8}}>{String.fromCharCode(65+i)}.</span>{opt}</button>
            ))}
          </div>
          <Lbl style={{display:"block", marginBottom:8}}>Work setup</Lbl>
          <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:20}}>
            {q.o2.map((opt,i)=>(
              <button key={i} onClick={()=>setAns({...ans,[qid]:{...(ans[qid]||{}),b:i}})} style={{padding:"12px 14px", fontSize:13, fontFamily:F.serif, textAlign:"left", background:(ans[qid]?.b===i)?"rgba(232,93,43,.1)":"transparent", border:`0.5px solid ${(ans[qid]?.b===i)?C.orange:C.border}`, cursor:"pointer", transition:"all .15s"}}><span style={{fontFamily:F.mono, fontSize:10, color:C.orange, fontWeight:600, marginRight:8}}>{String.fromCharCode(65+i)}.</span>{opt}</button>
            ))}
          </div>
          <button onClick={()=>answer(ans[qid])} disabled={ans[qid]?.a===undefined||ans[qid]?.b===undefined} style={btnStyle(ans[qid]?.a!==undefined&&ans[qid]?.b!==undefined)}>See your Noorah Score →</button>
        </div>
      )}
      {!loadingFollowup && !q.type && (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {q.o.map((opt,i)=>(
            <button key={i} onClick={()=>answer(i)} style={{padding:"14px 16px", fontSize:14, fontFamily:F.serif, textAlign:"left", background:"transparent", border:`0.5px solid ${C.border}`, cursor:"pointer", lineHeight:1.6, transition:"all .15s"}}
              onMouseEnter={e=>{e.target.style.borderColor=C.orange;e.target.style.background="rgba(232,93,43,.04)"}}
              onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.background="transparent"}}>
              <span style={{fontFamily:F.mono, fontSize:11, color:C.orange, fontWeight:600, marginRight:10}}>{String.fromCharCode(65+i)}.</span>{opt}
            </button>
          ))}
        </div>
      )}
    </div>);
  }

  // ═══ RESULTS ═══
  if (mode === "results" && scores) {
    const sorted = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw);
    return (<div style={{...pg, maxWidth:540}} ref={topRef}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
        <Lbl orange><Quote>Your Noorah score</Quote></Lbl>
        <span style={{display:"inline-block", padding:"4px 14px", border:`1.5px solid ${scores.sev === "Critical" ? C.orange : C.border}`, fontFamily:F.mono, fontSize:10, letterSpacing:2, textTransform:"uppercase", color:scores.sev === "Minimal" ? "#7B8F6B" : scores.sev === "Moderate" ? C.muted : C.orange}}>{scores.sev}</span>
      </div>
      <div style={{fontFamily:F.display, fontSize:140, lineHeight:.85, letterSpacing:-4, color:C.ink}}>{scores.total}</div>
      <div style={{fontFamily:F.mono, fontSize:13, color:C.muted, marginTop:4}}>/100</div>
      <div style={{borderTop:`1.5px solid ${C.ink}`, marginTop:20, paddingTop:16, marginBottom:20}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
          <Lbl>Dimensions</Lbl>
          <Lbl orange style={{fontSize:9}}>Hover for details</Lbl>
        </div>
        {sorted.map(([k,v],i)=>(<DimRow key={k} dimKey={k} rank={i+1} val={v} isTop={k === scores.top}/>))}
      </div>
      <div style={{border:`2px solid ${C.ink}`, padding:20, position:"relative", marginTop:24}}>
        <span style={{position:"absolute", top:-8, left:16, background:C.bg, padding:"0 8px", fontFamily:F.mono, fontSize:9, letterSpacing:3, color:C.orange, fontWeight:600}}>UNLOCK</span>
        <p style={{fontFamily:F.serif, fontSize:18, fontStyle:"italic", lineHeight:1.7, marginBottom:12, color:C.ink}}>{name}, you've got your number. A number without a plan is just a number.</p>
        <p style={{fontFamily:F.mono, fontSize:12, color:C.muted, lineHeight:1.7, marginBottom:16}}>8 weeks. 56 days. Every single one mapped out. Four phases — the fast, the rebuild, the return, the anchor. Your patterns. Your schedule. Your rules. Built from your answers. Ready in under a minute.</p>
        <button onClick={()=>setMode("generating")} style={{...btnStyle(), background:C.orange}} onMouseEnter={e=>e.target.style.background=C.ink} onMouseLeave={e=>e.target.style.background=C.orange}>Get your 8-week plan → $9.99</button>
        <Lbl style={{display:"block", textAlign:"center", marginTop:8, fontSize:8}}>8 weeks · 56 days · every day mapped · printable</Lbl>
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
        <p key={loadingQuoteIdx} style={{fontFamily:F.serif, fontSize:21, fontStyle:"italic", lineHeight:1.6, color:C.ink, textAlign:"center", animation:"fi 0.6s ease-in"}}>
          <span style={{color:C.orange, fontWeight:600, fontSize:24}}>"</span>{quote.q}<span style={{color:C.orange, fontWeight:600, fontSize:24}}>"</span>
        </p>
        <p style={{fontFamily:F.mono, fontSize:10, letterSpacing:2, color:C.muted, textAlign:"center", marginTop:16}}>— {quote.a.toUpperCase()}</p>
      </div>
      <div style={{display:"flex", justifyContent:"center", gap:8, marginTop:8}}>{[0,1,2,3,4].map(i=>(<div key={i} style={{width:8, height:8, background:C.orange, opacity:.3, animation:`f 1.5s ease-in-out ${i*.2}s infinite`}}/>))}</div>
      <style>{`@keyframes f{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>);
  }

  // ═══ PLAN ═══
  if (mode === "plan") return (<div style={{...pg, maxWidth:620}} ref={topRef}>
    <div style={{textAlign:"center", paddingBottom:20, borderBottom:`2px solid ${C.ink}`, marginBottom:24}}>
      <Lbl orange style={{display:"block", marginBottom:8}}>Noorah</Lbl>
      <h1 style={{fontFamily:F.display, fontSize:36, letterSpacing:2}}>{name.toUpperCase()}'S 8-WEEK PLAN</h1>
      <Lbl style={{display:"block", marginTop:8}}>Score: {scores?.total}/100 · {scores?.sev?.toUpperCase()} · 56 days · {new Date().toLocaleDateString()}</Lbl>
    </div>
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, border:`0.5px solid ${C.border}`, marginBottom:28}}>
      {[{w:"Week 1-2",p:"The fast"},{w:"Week 3-4",p:"The rebuild"},{w:"Week 5-6",p:"The return"},{w:"Week 7-8",p:"The anchor"}].map((ph,i)=>(<div key={i} style={{padding:"12px 16px", borderRight:i%2===0?`0.5px solid ${C.border}`:"none", borderBottom:i<2?`0.5px solid ${C.border}`:"none"}}><Lbl orange style={{fontSize:9}}>{ph.w}</Lbl><div style={{fontFamily:F.serif, fontSize:14, marginTop:2}}>{ph.p}</div></div>))}
    </div>
    {renderPlan()}
    <div className="no-print" style={{borderTop:`2px solid ${C.ink}`, paddingTop:20, marginTop:16, display:"flex", gap:8}}>
      <button onClick={()=>window.print()} style={{...btnStyle(), flex:1}} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Print / Save PDF</button>
      <button onClick={()=>{setMode("start");setName("");setEmail("");setAns({});setFollowupAnswers({});setScores(null);setPlan("");setQi(0);setShowPart2Intro(false)}} style={{flex:1, padding:14, fontFamily:F.mono, fontSize:12, letterSpacing:2, textTransform:"uppercase", background:"transparent", color:C.muted, border:`0.5px solid ${C.border}`, cursor:"pointer"}}>Done</button>
    </div>
    <Lbl className="no-print" style={{display:"block", textAlign:"center", marginTop:20, fontSize:8, color:C.border}}>Generated by Noorah · The digital intent company · {new Date().getFullYear()}</Lbl>
  </div>);

  return null;
}
