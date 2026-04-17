import { useState, useEffect, useRef } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";
import { PLAN_PROMPT } from "./planPrompt";

// ═══════════════════════════════════════
// DESIGN SYSTEM — 90s/2000s Analog
// ═══════════════════════════════════════
const C = {
  paper: "#F2EDE4", card: "#FAF7F2", ink: "#2A2520", amber: "#C4956A",
  sage: "#7B8F6B", muted: "#9C8E7C", border: "#D4C9B8", light: "#E8DFD0",
  mono: "'Space Mono', monospace", serif: "'Lora', Georgia, serif",
};

// ═══════════════════════════════════════
// QUIZ DATA
// ═══════════════════════════════════════
const Q = {
  g1: { t: "What's the one thing about your relationship with technology you most wish were different?", type: "text" },
  g2: { t: "If you imagined two weeks completely unplugged — what's your gut reaction?", o: ["Relief — sign me up", "Curious — I'd try it", "Anxious — what would I do?", "Impossible — can't even picture it"], s: [0,1,2,3], d: "dop" },
  s1: { t: "How often do you pick up your phone with no reason — just to check?", o: ["Rarely", "A few times a day", "Many times a day", "Constantly — my hand just moves"], s: [0,2,4,6], d: "dop" },
  s2: { t: "How long can you focus on something important before reaching for your phone?", o: ["An hour+", "~30 minutes", "~15 minutes", "Less than 5 minutes"], s: [0,2,4,6], d: "att" },
  s3: { t: "When you feel stressed, bored, or anxious — what's the first thing you reach for?", o: ["A walk or a call", "Sometimes my phone, sometimes not", "Usually my phone", "Always my phone — automatic"], s: [0,2,4,6], d: "emo" },
  s4: { t: "Where does your phone sleep at night?", o: ["Another room", "My room but not reachable", "Nightstand", "Under my pillow or in my hand"], s: [0,1,3,5], d: "env" },
  s5: { t: "Does how you spend your screen time match what you say matters most?", o: ["Yes, mostly", "Some gaps", "Big disconnect", "I try not to think about it"], s: [0,1,3,4], d: "val" },
  s6: { t: "How many subscriptions do you pay for that you haven't used in 30 days?", o: ["None", "1-2 I should cancel", "3-5 I forgot about", "Honestly don't know"], s: [0,1,2,3], d: "drn" },
  d1: { t: "Do you need more scrolling, more content, more episodes to feel the same thing you used to?", o: ["No", "Sometimes", "Yes, noticeably", "Nothing feels like enough anymore"], s: [0,1,2,3], d: "dop", m: "tolerance" },
  d2: { t: "When you're away from your phone for hours — what happens in your body?", o: ["Fine — barely notice", "A little restless", "Genuinely uncomfortable", "Anxious, almost panicky"], s: [0,1,2,3], d: "dop", m: "withdrawal" },
  d3: { t: "After a long scrolling session, how do you feel compared to before?", o: ["Refreshed", "About the same", "Slightly worse", "Worse — but I keep doing it"], s: [0,1,2,3], d: "dop", m: "imbalance" },
  d4: { t: "Have you ever downplayed how much time you spend on your phone — to yourself or someone close?", o: ["No, I'm honest", "Maybe once or twice", "More than I'd like", "Regularly"], s: [0,1,2,3], d: "dop", m: "honesty" },
  d5: { t: "How many messaging platforms do you actively monitor throughout the day?", o: ["1-2", "3-4", "5-6", "7+"], s: [0,2,4,5], d: "att" },
  d6: { t: "When did you last read a physical book for 30+ minutes without checking your phone?", o: ["This week", "This month", "Can't remember", "I don't read anymore"], s: [0,1,3,4], d: "att" },
  d7: { t: "Can you sit in complete silence for 15 minutes without feeling uncomfortable?", o: ["Yes, easily", "Probably, but I don't", "It'd be hard", "That sounds genuinely distressing"], s: [0,1,3,5], d: "emo" },
  d8: { t: "Do you use streaming or background noise to avoid being alone with your thoughts?", o: ["Never", "Occasionally", "Often", "Almost always"], s: [0,1,3,5], d: "emo" },
  d9: { t: "How many of your device's default settings have you actively changed?", o: ["Customized most things", "A few important ones", "Maybe one or two", "Never changed a default"], s: [0,1,3,5], d: "env" },
  c1: { t: "Who do you live with?", o: ["Alone", "With a partner", "With family/kids", "With roommates"], type: "ctx" },
  c2: { t: "What's your work setup?", o: ["Fully remote", "Hybrid", "In-office", "Not currently working"], type: "ctx" },
  c3: { t: "What's something analog you used to love doing — but stopped?", type: "text" },
};

const SCREEN = ["g1","g2","s1","s2","s3","s4","s5","s6"];
const DEEP = { dop:["d1","d2","d3","d4"], att:["d5","d6"], emo:["d7","d8"], env:["d9"] };
const CTX = ["c1","c2","c3"];
const DIM = { dop:{n:"Reward Patterns",x:25}, att:{n:"Attention Continuity",x:20}, emo:{n:"Emotional Coping",x:20}, env:{n:"Environment & Defaults",x:15}, val:{n:"Values Alignment",x:10}, drn:{n:"Time & Money Drain",x:10} };

function buildPath(ans) {
  const sc = {}; Object.keys(DIM).forEach(k => sc[k]=0);
  Object.entries(ans).forEach(([id,v]) => { const q=Q[id]; if(q?.d&&q?.s) sc[q.d]+=q.s[v]||0; });
  const top = Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(d=>d[0]);
  let dq=[]; top.forEach(d => { if(DEEP[d]) dq.push(...DEEP[d]); });
  return [...dq.slice(0,8), ...CTX];
}

function calcScores(ans) {
  const dims = {}; Object.keys(DIM).forEach(k => dims[k]={raw:0,max:DIM[k].x});
  const mk = {tolerance:0,withdrawal:0,imbalance:0,honesty:0};
  Object.entries(ans).forEach(([id,v]) => {
    const q=Q[id]; if(!q||q.type==="text"||q.type==="ctx") return;
    const s=q.s?.[v]||0; if(q.d&&dims[q.d]) dims[q.d].raw+=s; if(q.m) mk[q.m]=s;
  });
  Object.keys(dims).forEach(k => { dims[k].raw=Math.min(dims[k].raw,dims[k].max); });
  const total = Object.values(dims).reduce((s,d)=>s+d.raw,0);
  const sev = total<=25?"Minimal":total<=45?"Moderate":total<=65?"Significant":"Critical";
  const fast = total<=25?"Level 1 (3 days)":total<=45?"Levels 1-2 (5-7 days)":total<=65?"Levels 1-3 (10-14 days)":"Full Protocol (14+ days)";
  const top = Object.entries(dims).sort((a,b)=>b[1].raw-a[1].raw)[0][0];
  return {total,dims,mk,sev,fast,top};
}

// ═══════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════
const Mono = ({children,style}) => <span style={{fontFamily:C.mono,...style}}>{children}</span>;

export default function App() {
  const [mode, setMode] = useState("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ans, setAns] = useState({});
  const [path, setPath] = useState(SCREEN);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState("screen");
  const [scores, setScores] = useState(null);
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [subs, setSubs] = useState([]);

  // Stripe payment link — replace with your actual Stripe link
  const STRIPE_LINK = "https://buy.stripe.com/YOUR_LINK_HERE";

  // Check if returning from Stripe payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      // If we have scores saved, generate the plan
      const saved = sessionStorage.getItem("noorah_scores");
      const savedAns = sessionStorage.getItem("noorah_answers");
      const savedName = sessionStorage.getItem("noorah_name");
      const savedEmail = sessionStorage.getItem("noorah_email");
      if (saved && savedAns) {
        setScores(JSON.parse(saved));
        setAns(JSON.parse(savedAns));
        setName(savedName || "");
        setEmail(savedEmail || "");
        setMode("generating");
      }
    }
  }, []);

  // Generate plan when entering generating mode
  useEffect(() => {
    if (mode === "generating" && scores && !plan) generatePlan();
  }, [mode, scores]);

  const pg = { maxWidth: 560, margin: "0 auto", padding: "2rem 20px", fontFamily: C.serif, minHeight: "100vh" };
  const card = { background: C.card, border: `1px dashed ${C.border}`, borderRadius: 4, padding: "20px 24px" };
  const btn = (active=true) => ({ width: "100%", padding: "14px", fontSize: 14, fontFamily: C.mono, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", background: active ? C.ink : C.border, color: active ? C.paper : C.muted, border: "none", borderRadius: 2, cursor: active ? "pointer" : "not-allowed" });

  function answer(val) {
    const qid = path[qi];
    const newAns = {...ans, [qid]: val};
    setAns(newAns);
    if (phase==="screen" && qi===SCREEN.length-1) {
      setPath(buildPath(newAns)); setQi(0); setPhase("deep"); return;
    }
    if (phase==="deep" && qi===path.length-1) {
      const s = calcScores(newAns);
      setScores(s);
      // Save to session storage for post-payment retrieval
      sessionStorage.setItem("noorah_scores", JSON.stringify(s));
      sessionStorage.setItem("noorah_answers", JSON.stringify(newAns));
      sessionStorage.setItem("noorah_name", name);
      sessionStorage.setItem("noorah_email", email);
      // Save to Supabase
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:newAns.g1||"", total:s.total, dimensions:s.dims, severity:s.sev, prescription:s.fast, lembke:s.mk, context:{ living:Q.c1.o?.[newAns.c1]||"", work:Q.c2.o?.[newAns.c2]||"", lostActivity:newAns.c3||"" }, plan:"" }).catch(()=>{});
      setMode("results"); return;
    }
    setQi(qi+1);
  }

  async function generatePlan() {
    setLoading(true);
    const topDims = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw).slice(0,3);
    const ctx = `Generate a personalized plan for this person:
Name: ${name}
Score: ${scores.total}/100 (${scores.sev})
Top dimension: ${DIM[scores.top].n}
Dimensions: ${topDims.map(([k,v])=>`${DIM[k].n}: ${v.raw}/${v.max}`).join(", ")}
Tolerance: ${scores.mk.tolerance}/3, Withdrawal: ${scores.mk.withdrawal}/3, Seesaw: ${scores.mk.imbalance}/3, Honesty: ${scores.mk.honesty}/3
What brought them here: "${ans.g1||""}"
Fasting reaction: "${Q.g2.o?.[ans.g2]||""}"
Living: ${Q.c1.o?.[ans.c1]||""}
Work: ${Q.c2.o?.[ans.c2]||""}
Lost activity: "${ans.c3||""}"
Prescribed fast: ${scores.fast}`;

    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ system:PLAN_PROMPT, messages:[{role:"user",content:ctx}] }) });
      const data = await res.json();
      const text = data.text || "Plan generation failed. Please try refreshing the page.";
      setPlan(text);
      // Save plan to Supabase
      saveSubmission({ id:Date.now(), timestamp:new Date().toISOString(), name, email, gatewayWhy:ans.g1||"", total:scores.total, dimensions:scores.dims, severity:scores.sev, prescription:scores.fast, lembke:scores.mk, context:{ living:Q.c1.o?.[ans.c1]||"", work:Q.c2.o?.[ans.c2]||"", lostActivity:ans.c3||"" }, plan:text }).catch(()=>{});
      setMode("plan");
    } catch(e) {
      setPlan("Something went wrong generating your plan. Please refresh and try again.");
      setMode("plan");
    } finally { setLoading(false); }
  }

  function renderPlan() {
    const sections = plan.split(/###\s*/g).filter(s=>s.trim());
    return sections.map((sec, i) => {
      const lines = sec.trim().split("\n");
      const title = lines[0]?.trim();
      const body = lines.slice(1).join("\n").trim();
      const isPhase = title?.toLowerCase().includes("phase");

      // Format day entries with special styling
      const formatBody = (text) => {
        return text.split("\n").map((line, j) => {
          const dayMatch = line.match(/^\*\*Day\s+(\d+):\*\*\s*(.*)/);
          const promptMatch = line.match(/^\*(.*)\*$/);

          if (dayMatch) {
            return (
              <div key={j} style={{marginTop:16,marginBottom:2}}>
                <span style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:C.amber,letterSpacing:1}}>DAY {dayMatch[1]}</span>
                <span style={{fontSize:14,marginLeft:8,color:C.ink}}>{dayMatch[2]}</span>
              </div>
            );
          }
          if (promptMatch) {
            return (
              <div key={j} style={{fontSize:13,fontStyle:"italic",color:C.muted,marginBottom:12,paddingLeft:12,borderLeft:`2px dashed ${C.border}`}}>
                {promptMatch[1]}
              </div>
            );
          }
          if (line.trim() === "") return <div key={j} style={{height:8}} />;
          return <div key={j} style={{fontSize:15,lineHeight:1.8,color:C.ink,marginBottom:4}}>{line}</div>;
        });
      };

      if (isPhase) {
        return (
          <details key={i} open={i <= 1} style={{marginBottom:24}}>
            <summary style={{fontFamily:C.mono,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:C.amber,cursor:"pointer",marginBottom:12,borderBottom:`1px dashed ${C.border}`,paddingBottom:10,listStyle:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {title}
              <span style={{fontSize:10,color:C.muted,fontWeight:400}}>tap to expand</span>
            </summary>
            <div>{formatBody(body)}</div>
          </details>
        );
      }

      return (
        <div key={i} style={{marginBottom:28}}>
          <div style={{fontFamily:C.mono,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:C.amber,marginBottom:10,borderBottom:`1px dashed ${C.border}`,paddingBottom:8}}>{title}</div>
          <div>{formatBody(body)}</div>
        </div>
      );
    });
  }

  // ═══ ADMIN ═══
  if (mode === "adminLogin") {
    return (<div style={{...pg,maxWidth:420,display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <Mono style={{fontSize:11,letterSpacing:2,color:C.amber,marginBottom:16}}>ADMIN ACCESS</Mono>
      <input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} placeholder="Password" style={{width:"100%",padding:12,fontSize:14,fontFamily:C.mono,border:`1px dashed ${C.border}`,borderRadius:2,background:C.card,marginBottom:12,boxSizing:"border-box"}} />
      <button onClick={async()=>{if(adminPw==="noorah2026"){setSubs(await loadSubmissions());setMode("admin")}else alert("Wrong")}} style={btn()}>Enter</button>
      <button onClick={()=>setMode("start")} style={{...btn(false),background:"transparent",color:C.muted,border:"none",marginTop:8,cursor:"pointer"}}>Back</button>
    </div>);
  }
  if (mode === "admin") {
    return (<div style={{...pg,maxWidth:720}}>
      <Mono style={{fontSize:11,letterSpacing:2,color:C.amber}}>ADMIN — {subs.length} SUBMISSIONS</Mono>
      <div style={{marginTop:16}}>{subs.map((s,i)=>(
        <details key={s.id||i} style={{...card,marginBottom:8}}>
          <summary style={{cursor:"pointer",fontFamily:C.mono,fontSize:13}}>{s.name} — {s.total} ({s.severity}) — {new Date(s.timestamp).toLocaleDateString()}</summary>
          <div style={{marginTop:12,fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap",background:C.paper,padding:12,borderRadius:2,maxHeight:300,overflow:"auto"}}>{s.plan||"No plan yet"}</div>
        </details>
      ))}</div>
      <button onClick={()=>setMode("start")} style={{...btn(false),background:"transparent",color:C.muted,border:`1px dashed ${C.border}`,marginTop:16,cursor:"pointer",width:"auto",padding:"8px 20px"}}>Exit</button>
    </div>);
  }

  // ═══ START ═══
  if (mode === "start") {
    return (<div style={{...pg,maxWidth:520,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center"}}>
      <div style={{marginBottom:32}}>
        <Mono style={{fontSize:11,letterSpacing:3,color:C.amber,display:"block",marginBottom:16}}>EST. 2026</Mono>
        <h1 style={{fontFamily:C.serif,fontSize:42,fontWeight:400,fontStyle:"italic",letterSpacing:-1,marginBottom:4}}>Noorah</h1>
        <Mono style={{fontSize:10,letterSpacing:3,color:C.muted,display:"block",marginTop:8}}>THE DIGITAL INTENT COMPANY</Mono>
      </div>

      <div style={{borderTop:`1px dashed ${C.border}`,borderBottom:`1px dashed ${C.border}`,padding:"20px 0",margin:"0 0 24px",textAlign:"left"}}>
        <p style={{fontSize:16,lineHeight:1.8,color:C.ink}}>Take the free assessment. See your Noorah Score — a number that tells you exactly where you stand with your screens. Takes 4 minutes. No sign-up required to start.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:28}}>
        {[{n:"4 min",l:"assessment"},{n:"6",l:"dimensions"},{n:"free",l:"always"}].map((s,i)=>(
          <div key={i} style={{borderRight:i<2?`1px dashed ${C.border}`:"none",paddingRight:i<2?12:0}}>
            <Mono style={{fontSize:20,fontWeight:700,color:C.ink,display:"block"}}>{s.n}</Mono>
            <span style={{fontSize:11,color:C.muted}}>{s.l}</span>
          </div>
        ))}
      </div>

      <button onClick={()=>setMode("intake")} style={btn()}>Take the free assessment →</button>
      <button onClick={()=>setMode("adminLogin")} style={{background:"transparent",border:"none",color:C.border,fontSize:10,fontFamily:C.mono,marginTop:20,cursor:"pointer",letterSpacing:1}}>ADMIN</button>
    </div>);
  }

  // ═══ INTAKE ═══
  if (mode === "intake") {
    return (<div style={{...pg,maxWidth:440,display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <Mono style={{fontSize:10,letterSpacing:2,color:C.amber,display:"block",marginBottom:12}}>BEFORE WE START</Mono>
      <h2 style={{fontFamily:C.serif,fontSize:24,fontWeight:400,fontStyle:"italic",marginBottom:4}}>Your name and email</h2>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>So your results have somewhere to live.</p>
      <Mono style={{fontSize:10,letterSpacing:1,color:C.muted,display:"block",marginBottom:4}}>FIRST NAME</Mono>
      <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",padding:"12px 14px",fontSize:15,fontFamily:C.serif,border:`1px dashed ${C.border}`,borderRadius:2,background:C.card,marginBottom:14,boxSizing:"border-box"}} />
      <Mono style={{fontSize:10,letterSpacing:1,color:C.muted,display:"block",marginBottom:4}}>EMAIL</Mono>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={{width:"100%",padding:"12px 14px",fontSize:15,fontFamily:C.serif,border:`1px dashed ${C.border}`,borderRadius:2,background:C.card,marginBottom:20,boxSizing:"border-box"}} />
      <button onClick={()=>{setMode("quiz");setQi(0);setPhase("screen");setPath(SCREEN)}} disabled={!name||!email} style={btn(name&&email)}>Begin →</button>
    </div>);
  }

  // ═══ QUIZ ═══
  if (mode === "quiz") {
    const qid = path[qi]; const q = Q[qid];
    if (!q) { setMode("results"); return null; }
    const total = phase==="screen"?SCREEN.length:path.length;
    const pct = ((qi+1)/total)*100;
    return (<div style={{...pg,maxWidth:520,display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <Mono style={{fontSize:10,letterSpacing:2,color:C.amber}}>{phase==="screen"?"SCREENING":"DEEP DIVE"}</Mono>
        <Mono style={{fontSize:10,color:C.muted}}>{qi+1}/{total}</Mono>
      </div>
      <div style={{height:2,background:C.border,marginBottom:28}}>
        <div style={{height:2,background:C.amber,width:`${pct}%`,transition:"width 0.3s"}} />
      </div>

      <h2 style={{fontFamily:C.serif,fontSize:20,fontWeight:400,lineHeight:1.7,marginBottom:24,fontStyle:"italic"}}>{q.t}</h2>

      {q.type==="text" ? (
        <div>
          <textarea value={ans[qid]||""} onChange={e=>setAns({...ans,[qid]:e.target.value})} placeholder="Type here..." rows={3}
            style={{width:"100%",padding:"14px",fontSize:15,fontFamily:C.serif,border:`1px dashed ${C.border}`,borderRadius:2,background:C.card,resize:"none",boxSizing:"border-box",marginBottom:14,lineHeight:1.7}} />
          <button onClick={()=>answer(ans[qid])} disabled={!ans[qid]?.trim()} style={btn(!!ans[qid]?.trim())}>Continue →</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {q.o.map((opt,i) => (
            <button key={i} onClick={()=>answer(i)}
              style={{padding:"14px 18px",fontSize:14,fontFamily:C.serif,textAlign:"left",background:C.card,border:`1px dashed ${C.border}`,borderRadius:2,cursor:"pointer",lineHeight:1.6,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.target.style.borderColor=C.amber;e.target.style.background=C.light}}
              onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.background=C.card}}>
              <Mono style={{fontSize:11,color:C.amber,marginRight:8}}>{String.fromCharCode(65+i)}.</Mono>{opt}
            </button>
          ))}
        </div>
      )}
    </div>);
  }

  // ═══ RESULTS (FREE) ═══
  if (mode === "results" && scores) {
    const sorted = Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw);
    return (<div style={{...pg,maxWidth:520}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <Mono style={{fontSize:10,letterSpacing:3,color:C.amber,display:"block",marginBottom:16}}>YOUR NOORAH SCORE</Mono>
        <div style={{fontFamily:C.mono,fontSize:72,fontWeight:700,color:C.ink,lineHeight:1,letterSpacing:-2}}>{scores.total}</div>
        <div style={{fontFamily:C.mono,fontSize:12,color:C.muted,marginTop:4}}>out of 100</div>
        <div style={{display:"inline-block",padding:"4px 14px",fontFamily:C.mono,fontSize:11,letterSpacing:1,marginTop:12,border:`1px dashed ${scores.sev==="Critical"?C.amber:C.border}`,borderRadius:2,
          color:scores.sev==="Minimal"?C.sage:scores.sev==="Moderate"?C.muted:scores.sev==="Significant"?C.amber:"#A32D2D"
        }}>{scores.sev.toUpperCase()}</div>
      </div>

      <div style={{borderTop:`1px dashed ${C.border}`,paddingTop:20,marginBottom:24}}>
        <Mono style={{fontSize:10,letterSpacing:2,color:C.amber,display:"block",marginBottom:16}}>YOUR DIMENSIONS</Mono>
        {sorted.map(([k,v]) => (
          <div key={k} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,color:C.ink}}>{DIM[k].n}</span>
              <Mono style={{fontSize:11,color:C.muted}}>{v.raw}/{v.max}</Mono>
            </div>
            <div style={{height:4,background:C.border,borderRadius:1}}>
              <div style={{height:4,background:k===scores.top?C.amber:C.muted,borderRadius:1,width:`${(v.raw/v.max)*100}%`,transition:"width 0.5s"}} />
            </div>
          </div>
        ))}
      </div>

      <div style={{...card,marginBottom:16}}>
        <Mono style={{fontSize:10,letterSpacing:1,color:C.muted,display:"block",marginBottom:4}}>PRESCRIBED FAST</Mono>
        <Mono style={{fontSize:14,fontWeight:700,color:C.ink}}>{scores.fast}</Mono>
      </div>

      <div style={{background:C.ink,borderRadius:2,padding:"24px",marginBottom:16}}>
        <p style={{fontFamily:C.serif,fontSize:17,fontStyle:"italic",color:C.paper,lineHeight:1.7,marginBottom:16}}>
          {name}, you've got your number. But a number without a plan is just a number.
        </p>
        <p style={{fontFamily:C.serif,fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:8}}>
          For $9.99, Noorah will build a complete 8-week plan that could only belong to you. 56 days. Every single one mapped out. Four phases — the fast, the rebuild, the return, the anchor.
        </p>
        <p style={{fontFamily:C.serif,fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:20}}>
          Your patterns. Your schedule. Your replacements. Your rules. Built from your answers. Ready in under a minute.
        </p>
        <button onClick={()=>{
          // For beta testing: skip payment, go straight to plan generation
          // For production: uncomment next line and comment the one after
          // window.location.href = STRIPE_LINK;
          setMode("generating");
        }} style={{width:"100%",padding:"14px",fontSize:13,fontFamily:C.mono,fontWeight:700,letterSpacing:1,textTransform:"uppercase",background:C.amber,color:C.ink,border:"none",borderRadius:2,cursor:"pointer"}}>
          Get your 8-week plan — $9.99 →
        </button>
        <Mono style={{display:"block",textAlign:"center",fontSize:9,color:C.muted,marginTop:8}}>8 WEEKS · 56 DAYS · EVERY DAY MAPPED · PRINTABLE</Mono>
      </div>
    </div>);
  }

  // ═══ GENERATING ═══
  if (mode === "generating") {
    return (<div style={{...pg,maxWidth:440,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center"}}>
      <div style={{marginBottom:24}}>
        <Mono style={{fontSize:11,letterSpacing:2,color:C.amber,display:"block",marginBottom:16}}>BUILDING YOUR 8-WEEK PLAN</Mono>
        <p style={{fontFamily:C.serif,fontSize:18,fontStyle:"italic",lineHeight:1.7,color:C.ink,marginBottom:8}}>Noorah is reading your results and writing 56 days of personalized guidance.</p>
        <p style={{fontFamily:C.serif,fontSize:14,color:C.muted,lineHeight:1.7}}>This takes about 30-45 seconds. Worth the wait.</p>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:20}}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.amber,opacity:0.3,animation:`fade 1.5s ease-in-out ${i*0.2}s infinite`}} />
        ))}
      </div>
      <style>{`@keyframes fade{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>);
  }

  // ═══ PLAN ═══
  if (mode === "plan") {
    return (<div style={{...pg,maxWidth:600}}>
      <div style={{textAlign:"center",marginBottom:32,borderBottom:`1px dashed ${C.border}`,paddingBottom:24}}>
        <Mono style={{fontSize:10,letterSpacing:3,color:C.amber,display:"block",marginBottom:8}}>NOORAH</Mono>
        <h1 style={{fontFamily:C.serif,fontSize:28,fontWeight:400,fontStyle:"italic",marginBottom:4}}>{name}'s 8-Week Plan</h1>
        <Mono style={{fontSize:10,color:C.muted,display:"block",marginTop:8}}>SCORE: {scores?.total}/100 · {scores?.sev?.toUpperCase()} · 56 DAYS · {new Date().toLocaleDateString()}</Mono>
      </div>

      <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:2,padding:"16px 20px",marginBottom:28,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><Mono style={{fontSize:9,letterSpacing:1,color:C.muted,display:"block"}}>WEEK 1-2</Mono><span style={{fontSize:13,color:C.ink}}>The Fast</span></div>
        <div><Mono style={{fontSize:9,letterSpacing:1,color:C.muted,display:"block"}}>WEEK 3-4</Mono><span style={{fontSize:13,color:C.ink}}>The Rebuild</span></div>
        <div><Mono style={{fontSize:9,letterSpacing:1,color:C.muted,display:"block"}}>WEEK 5-6</Mono><span style={{fontSize:13,color:C.ink}}>The Return</span></div>
        <div><Mono style={{fontSize:9,letterSpacing:1,color:C.muted,display:"block"}}>WEEK 7-8</Mono><span style={{fontSize:13,color:C.ink}}>The Anchor</span></div>
      </div>

      {renderPlan()}

      <div className="no-print" style={{borderTop:`1px dashed ${C.border}`,paddingTop:24,marginTop:16,display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>window.print()} style={{flex:1,padding:"12px",fontSize:12,fontFamily:C.mono,fontWeight:700,letterSpacing:1,textTransform:"uppercase",background:C.ink,color:C.paper,border:"none",borderRadius:2,cursor:"pointer"}}>Print / Save PDF</button>
        <button onClick={()=>{setMode("start");setName("");setEmail("");setAns({});setScores(null);setPlan("");setQi(0);setPhase("screen")}} style={{flex:1,padding:"12px",fontSize:12,fontFamily:C.mono,letterSpacing:1,textTransform:"uppercase",background:"transparent",color:C.muted,border:`1px dashed ${C.border}`,borderRadius:2,cursor:"pointer"}}>Done</button>
      </div>

      <Mono className="no-print" style={{display:"block",textAlign:"center",fontSize:9,color:C.border,marginTop:24,letterSpacing:1}}>THIS PLAN WAS GENERATED BY NOORAH · THE DIGITAL INTENT COMPANY · {new Date().getFullYear()}</Mono>
    </div>);
  }

  return null;
}
