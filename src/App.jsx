import { useState, useEffect, useRef } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";
import { PLAN_PROMPT } from "./planPrompt";

// ═══════════════════════════════════════
// DESIGN — Abloh × Müller
// ═══════════════════════════════════════
const F = {
  display: "'Bebas Neue', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  serif: "'Cormorant Garamond', Georgia, serif",
};
const C = {
  bg: "#F5F0E8", card: "#FDFBF7", ink: "#1A1A1A", orange: "#E85D2B",
  muted: "#999999", border: "#E0DCD4", light: "#F0ECE4",
};

// ═══════════════════════════════════════
// QUIZ DATA
// ═══════════════════════════════════════
const Q = {
  g1:{t:"What's the one thing about your relationship with technology you most wish were different?",type:"text"},
  g2:{t:"If you imagined two weeks completely unplugged — what's your gut reaction?",o:["Relief — sign me up","Curious — I'd try it","Anxious — what would I do?","Impossible — can't even picture it"],s:[0,1,2,3],d:"dop"},
  s1:{t:"How often do you pick up your phone with no reason — just to check?",o:["Rarely","A few times a day","Many times a day","Constantly — my hand just moves"],s:[0,2,4,6],d:"dop"},
  s2:{t:"How long can you focus on something important before reaching for your phone?",o:["An hour+","~30 minutes","~15 minutes","Less than 5 minutes"],s:[0,2,4,6],d:"att"},
  s3:{t:"When you feel stressed, bored, or anxious — what's the first thing you reach for?",o:["A walk or a call","Sometimes my phone, sometimes not","Usually my phone","Always my phone — automatic"],s:[0,2,4,6],d:"emo"},
  s4:{t:"Where does your phone sleep at night?",o:["Another room","My room but not reachable","Nightstand","Under my pillow or in my hand"],s:[0,1,3,5],d:"env"},
  s5:{t:"Does how you spend your screen time match what you say matters most?",o:["Yes, mostly","Some gaps","Big disconnect","I try not to think about it"],s:[0,1,3,4],d:"val"},
  s6:{t:"How many subscriptions do you pay for that you haven't used in 30 days?",o:["None","1-2 I should cancel","3-5 I forgot about","Honestly don't know"],s:[0,1,2,3],d:"drn"},
  d1:{t:"Do you need more scrolling, more content, more episodes to feel the same thing you used to?",o:["No","Sometimes","Yes, noticeably","Nothing feels like enough anymore"],s:[0,1,2,3],d:"dop",m:"tolerance"},
  d2:{t:"When you're away from your phone for hours — what happens in your body?",o:["Fine — barely notice","A little restless","Genuinely uncomfortable","Anxious, almost panicky"],s:[0,1,2,3],d:"dop",m:"withdrawal"},
  d3:{t:"After a long scrolling session, how do you feel compared to before?",o:["Refreshed","About the same","Slightly worse","Worse — but I keep doing it"],s:[0,1,2,3],d:"dop",m:"imbalance"},
  d4:{t:"Have you ever downplayed how much time you spend on your phone — to yourself or someone close?",o:["No, I'm honest","Maybe once or twice","More than I'd like","Regularly"],s:[0,1,2,3],d:"dop",m:"honesty"},
  d5:{t:"How many messaging platforms do you actively monitor throughout the day?",o:["1-2","3-4","5-6","7+"],s:[0,2,4,5],d:"att"},
  d6:{t:"When did you last read a physical book for 30+ minutes without checking your phone?",o:["This week","This month","Can't remember","I don't read anymore"],s:[0,1,3,4],d:"att"},
  d7:{t:"Can you sit in complete silence for 15 minutes without feeling uncomfortable?",o:["Yes, easily","Probably, but I don't","It'd be hard","That sounds genuinely distressing"],s:[0,1,3,5],d:"emo"},
  d8:{t:"Do you use streaming or background noise to avoid being alone with your thoughts?",o:["Never","Occasionally","Often","Almost always"],s:[0,1,3,5],d:"emo"},
  d9:{t:"How many of your device's default settings have you actively changed?",o:["Customized most things","A few important ones","Maybe one or two","Never changed a default"],s:[0,1,3,5],d:"env"},
  c1:{t:"Who do you live with?",o:["Alone","With a partner","With family/kids","With roommates"],type:"ctx"},
  c2:{t:"What's your work setup?",o:["Fully remote","Hybrid","In-office","Not currently working"],type:"ctx"},
  c3:{t:"What's something analog you used to love doing — but stopped?",type:"text"},
};
const SCREEN=["g1","g2","s1","s2","s3","s4","s5","s6"];
const DEEP={dop:["d1","d2","d3","d4"],att:["d5","d6"],emo:["d7","d8"],env:["d9"]};
const CTX=["c1","c2","c3"];
const DIM={dop:{n:"Reward patterns",x:25},att:{n:"Attention continuity",x:20},emo:{n:"Emotional coping",x:20},env:{n:"Environment & defaults",x:15},val:{n:"Values alignment",x:10},drn:{n:"Time & money drain",x:10}};

function buildPath(a){const sc={};Object.keys(DIM).forEach(k=>sc[k]=0);Object.entries(a).forEach(([id,v])=>{const q=Q[id];if(q?.d&&q?.s)sc[q.d]+=q.s[v]||0});const top=Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(d=>d[0]);let dq=[];top.forEach(d=>{if(DEEP[d])dq.push(...DEEP[d])});return[...dq.slice(0,8),...CTX]}
function calc(a){const dims={};Object.keys(DIM).forEach(k=>dims[k]={raw:0,max:DIM[k].x});const mk={tolerance:0,withdrawal:0,imbalance:0,honesty:0};Object.entries(a).forEach(([id,v])=>{const q=Q[id];if(!q||q.type==="text"||q.type==="ctx")return;const s=q.s?.[v]||0;if(q.d&&dims[q.d])dims[q.d].raw+=s;if(q.m)mk[q.m]=s});Object.keys(dims).forEach(k=>{dims[k].raw=Math.min(dims[k].raw,dims[k].max)});const total=Object.values(dims).reduce((s,d)=>s+d.raw,0);const sev=total<=25?"Minimal":total<=45?"Moderate":total<=65?"Significant":"Critical";const fast=total<=25?"Level 1 (3 days)":total<=45?"Levels 1-2 (7 days)":total<=65?"Levels 1-3 (14 days)":"Full protocol (14+ days)";const top=Object.entries(dims).sort((a,b)=>b[1].raw-a[1].raw)[0][0];return{total,dims,mk,sev,fast,top}}

// ═══════════════════════════════════════
// STYLE HELPERS
// ═══════════════════════════════════════
const Lbl = ({children,orange,style}) => <span style={{fontFamily:F.mono,fontSize:10,letterSpacing:3,textTransform:"uppercase",color:orange?C.orange:C.muted,fontWeight:500,...style}}>{children}</span>;
const Quote = ({children}) => <><span style={{color:C.orange,fontWeight:600}}>"</span>{children}<span style={{color:C.orange,fontWeight:600}}>"</span></>;

export default function App(){
  const[mode,setMode]=useState("start");
  const[name,setName]=useState("");
  const[email,setEmail]=useState("");
  const[ans,setAns]=useState({});
  const[path,setPath]=useState(SCREEN);
  const[qi,setQi]=useState(0);
  const[phase,setPhase]=useState("screen");
  const[scores,setScores]=useState(null);
  const[plan,setPlan]=useState("");
  const[loading,setLoading]=useState(false);
  const[adminPw,setAdminPw]=useState("");
  const[subs,setSubs]=useState([]);
  const topRef=useRef(null);

  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("paid")==="true"){window.history.replaceState({},"",window.location.pathname);const s=sessionStorage.getItem("n_scores"),a=sessionStorage.getItem("n_ans"),nm=sessionStorage.getItem("n_name"),em=sessionStorage.getItem("n_email");if(s&&a){setScores(JSON.parse(s));setAns(JSON.parse(a));setName(nm||"");setEmail(em||"");setMode("generating")}}},[]);
  useEffect(()=>{if(mode==="generating"&&scores&&!plan)genPlan()},[mode,scores]);
  useEffect(()=>{if(topRef.current)topRef.current.scrollIntoView({behavior:"smooth"})},[mode]);

  const pg={maxWidth:580,margin:"0 auto",padding:"2rem 20px",fontFamily:F.mono,minHeight:"100vh"};
  const btnStyle=(active=true)=>({width:"100%",padding:"14px",fontFamily:F.mono,fontSize:12,fontWeight:600,letterSpacing:2,textTransform:"uppercase",background:active?C.ink:"#ddd",color:active?C.bg:C.muted,border:"none",cursor:active?"pointer":"not-allowed",transition:"background .2s"});
  const inputStyle={width:"100%",padding:"12px 14px",fontSize:15,fontFamily:F.serif,border:`1px solid ${C.border}`,background:C.card,boxSizing:"border-box"};

  function answer(val){
    const qid=path[qi],newAns={...ans,[qid]:val};setAns(newAns);
    if(phase==="screen"&&qi===SCREEN.length-1){setPath(buildPath(newAns));setQi(0);setPhase("deep");return}
    if(phase==="deep"&&qi===path.length-1){
      const s=calc(newAns);setScores(s);
      sessionStorage.setItem("n_scores",JSON.stringify(s));sessionStorage.setItem("n_ans",JSON.stringify(newAns));sessionStorage.setItem("n_name",name);sessionStorage.setItem("n_email",email);
      saveSubmission({id:Date.now(),timestamp:new Date().toISOString(),name,email,gatewayWhy:newAns.g1||"",total:s.total,dimensions:s.dims,severity:s.sev,prescription:s.fast,lembke:s.mk,context:{living:Q.c1.o?.[newAns.c1]||"",work:Q.c2.o?.[newAns.c2]||"",lostActivity:newAns.c3||""},plan:""}).catch(()=>{});
      setMode("results");return}
    setQi(qi+1);
  }

  async function genPlan(){
    setLoading(true);
    const topDims=Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw).slice(0,3);
    const ctx=`Generate a personalized 8-week plan (56 days) for:\nName: ${name}\nScore: ${scores.total}/100 (${scores.sev})\nTop dimension: ${DIM[scores.top].n}\nDimensions: ${topDims.map(([k,v])=>`${DIM[k].n}: ${v.raw}/${v.max}`).join(", ")}\nTolerance: ${scores.mk.tolerance}/3, Withdrawal: ${scores.mk.withdrawal}/3, Seesaw: ${scores.mk.imbalance}/3, Honesty: ${scores.mk.honesty}/3\nWhat brought them here: "${ans.g1||""}"\nFasting reaction: "${Q.g2.o?.[ans.g2]||""}"\nLiving: ${Q.c1.o?.[ans.c1]||""}\nWork: ${Q.c2.o?.[ans.c2]||""}\nLost activity: "${ans.c3||""}"\nPrescribed fast: ${scores.fast}`;
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:PLAN_PROMPT,messages:[{role:"user",content:ctx}]})});
      const data=await res.json();const text=data.text||"Plan generation failed. Please refresh.";setPlan(text);
      saveSubmission({id:Date.now(),timestamp:new Date().toISOString(),name,email,gatewayWhy:ans.g1||"",total:scores.total,dimensions:scores.dims,severity:scores.sev,prescription:scores.fast,lembke:scores.mk,context:{living:Q.c1.o?.[ans.c1]||"",work:Q.c2.o?.[ans.c2]||"",lostActivity:ans.c3||""},plan:text}).catch(()=>{});
      setMode("plan");
    }catch(e){setPlan("Something went wrong. Please refresh and try again.");setMode("plan")}finally{setLoading(false)}
  }

  function renderPlan(){
    const sections=plan.split(/###\s*/g).filter(s=>s.trim());
    return sections.map((sec,i)=>{
      const lines=sec.trim().split("\n");const title=lines[0]?.trim();const body=lines.slice(1).join("\n").trim();
      const isPhase=title?.toLowerCase().includes("phase");
      const fmt=(text)=>text.split("\n").map((line,j)=>{
        const dm=line.match(/^\*\*Day\s+(\d+):\*\*\s*(.*)/);
        const pm=line.match(/^\*(.*)\*$/);
        if(dm)return(<div key={j} style={{marginTop:18,marginBottom:2,display:"flex",gap:12,alignItems:"flex-start"}}><span style={{fontFamily:F.display,fontSize:32,color:C.orange,lineHeight:1,minWidth:44}}>{dm[1].padStart(2,"0")}</span><div style={{flex:1}}><div style={{fontFamily:F.serif,fontSize:16,lineHeight:1.7,color:C.ink}}>{dm[2]}</div></div></div>);
        if(pm)return(<div key={j} style={{fontFamily:F.serif,fontStyle:"italic",fontSize:14,color:C.muted,marginBottom:14,marginLeft:56,paddingLeft:12,borderLeft:`2px solid ${C.orange}`,lineHeight:1.6}}>{pm[1]}</div>);
        if(line.trim()==="")return <div key={j} style={{height:6}}/>;
        return<div key={j} style={{fontFamily:F.serif,fontSize:15,lineHeight:1.8,color:C.ink,marginBottom:4,marginLeft:line.startsWith("-")?56:0}}>{line}</div>
      });
      if(isPhase)return(
        <details key={i} open={i<=2} style={{marginBottom:24}}>
          <summary style={{fontFamily:F.mono,fontSize:10,fontWeight:600,letterSpacing:2,textTransform:"uppercase",color:C.orange,cursor:"pointer",marginBottom:12,borderBottom:`1.5px solid ${C.ink}`,paddingBottom:10,listStyle:"none",display:"flex",justifyContent:"space-between"}}>
            <Quote>{title}</Quote><span style={{color:C.muted,fontWeight:400,fontSize:9,letterSpacing:1}}>TAP TO EXPAND</span>
          </summary>
          <div>{fmt(body)}</div>
        </details>);
      return(
        <div key={i} style={{marginBottom:28}}>
          <div style={{fontFamily:F.mono,fontSize:10,fontWeight:600,letterSpacing:2,textTransform:"uppercase",color:C.orange,marginBottom:10,borderBottom:`0.5px dashed ${C.border}`,paddingBottom:8}}><Quote>{title}</Quote></div>
          <div>{fmt(body)}</div>
        </div>);
    });
  }

  // ═══ ADMIN ═══
  if(mode==="adminLogin")return(<div style={{...pg,maxWidth:420,display:"flex",flexDirection:"column",justifyContent:"center"}} ref={topRef}><Lbl orange>Admin access</Lbl><div style={{height:16}}/><input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} placeholder="Password" style={{...inputStyle,fontFamily:F.mono,fontSize:13,marginBottom:12}}/><button onClick={async()=>{if(adminPw==="noorah2026"){setSubs(await loadSubmissions());setMode("admin")}else alert("Wrong")}} style={btnStyle()}>Enter</button><button onClick={()=>setMode("start")} style={{...btnStyle(false),background:"transparent",color:C.muted,border:"none",marginTop:8,cursor:"pointer",fontSize:10}}>← Back</button></div>);

  if(mode==="admin")return(<div style={{...pg,maxWidth:720}} ref={topRef}><Lbl orange>Admin — {subs.length} submissions</Lbl><div style={{marginTop:16}}>{subs.map((s,i)=>(<details key={s.id||i} style={{marginBottom:8,border:`0.5px solid ${C.border}`,padding:"12px 16px"}}><summary style={{cursor:"pointer",fontFamily:F.mono,fontSize:12}}><span style={{color:C.orange,fontWeight:600}}>{String(i+1).padStart(2,"0")}</span> → {s.name} — {s.total} ({s.severity}) — {new Date(s.timestamp).toLocaleDateString()}</summary><div style={{marginTop:12,fontFamily:F.mono,fontSize:11,lineHeight:1.8,whiteSpace:"pre-wrap",background:C.light,padding:14,maxHeight:300,overflow:"auto"}}>{s.plan||"No plan"}</div></details>))}</div><button onClick={()=>setMode("start")} style={{...btnStyle(false),background:"transparent",color:C.muted,border:`0.5px solid ${C.border}`,marginTop:16,cursor:"pointer",width:"auto",padding:"8px 20px",fontSize:10}}>Exit</button></div>);

  // ═══ START ═══
  if(mode==="start")return(<div style={{...pg,maxWidth:520,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center"}} ref={topRef}>
    <Lbl orange style={{display:"block",marginBottom:16}}>Est. 2026</Lbl>
    <h1 style={{fontFamily:F.display,fontSize:80,letterSpacing:4,lineHeight:.9,color:C.ink,marginBottom:8}}>NOORAH</h1>
    <p style={{fontFamily:F.serif,fontSize:17,fontStyle:"italic",color:C.muted,marginBottom:4}}><Quote>The light before your screen</Quote></p>
    <Lbl style={{display:"block",marginTop:8}}>The digital intent company</Lbl>

    <div style={{borderTop:`1.5px solid ${C.ink}`,borderBottom:`0.5px dashed ${C.border}`,padding:"20px 0",margin:"28px 0 24px",textAlign:"left"}}>
      <p style={{fontFamily:F.serif,fontSize:18,lineHeight:1.8,color:C.ink}}>You already know something's off. This gives it a number. Four minutes. Six dimensions. One score that tells you exactly what your screens are costing you. Then — if you're ready — 56 days that only belong to you.</p>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",marginBottom:28,borderBottom:`0.5px dashed ${C.border}`,paddingBottom:20}}>
      {[{v:"4 min",l:"assessment"},{v:"6",l:"dimensions"},{v:"56",l:"days in plan"},{v:"$0",l:"to start"}].map((s,i)=>(
        <div key={i} style={{textAlign:"center",flex:1,borderRight:i<3?`0.5px solid ${C.border}`:"none"}}>
          <div style={{fontFamily:F.display,fontSize:28,color:C.ink}}>{s.v}</div>
          <Lbl style={{fontSize:8}}>{s.l}</Lbl>
        </div>
      ))}
    </div>

    <button onClick={()=>setMode("intake")} style={btnStyle()} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Take the free assessment →</button>
    <button onClick={()=>setMode("adminLogin")} style={{background:"transparent",border:"none",color:C.border,fontFamily:F.mono,fontSize:9,letterSpacing:2,marginTop:20,cursor:"pointer"}}>ADMIN</button>
  </div>);

  // ═══ INTAKE ═══
  if(mode==="intake")return(<div style={{...pg,maxWidth:440,display:"flex",flexDirection:"column",justifyContent:"center"}} ref={topRef}>
    <Lbl orange style={{display:"block",marginBottom:12}}>Before we start</Lbl>
    <h2 style={{fontFamily:F.display,fontSize:36,letterSpacing:2,marginBottom:4}}>YOUR DETAILS</h2>
    <p style={{fontFamily:F.serif,fontSize:14,color:C.muted,fontStyle:"italic",marginBottom:24}}>So your results have somewhere to live.</p>
    <Lbl style={{display:"block",marginBottom:4}}>01 → First name</Lbl>
    <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{...inputStyle,marginBottom:16}}/>
    <Lbl style={{display:"block",marginBottom:4}}>02 → Email</Lbl>
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={{...inputStyle,marginBottom:24}}/>
    <button onClick={()=>{setMode("quiz");setQi(0);setPhase("screen");setPath(SCREEN)}} disabled={!name||!email} style={btnStyle(name&&email)} onMouseEnter={e=>{if(name&&email)e.target.style.background=C.orange}} onMouseLeave={e=>{if(name&&email)e.target.style.background=C.ink}}>Begin →</button>
  </div>);

  // ═══ QUIZ ═══
  if(mode==="quiz"){
    const qid=path[qi],q=Q[qid];if(!q){setMode("results");return null}
    const total=phase==="screen"?SCREEN.length:path.length;const pct=((qi+1)/total)*100;
    return(<div style={{...pg,maxWidth:520,display:"flex",flexDirection:"column",justifyContent:"center"}} ref={topRef}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <Lbl orange>{phase==="screen"?"Screening":"Deep dive"}</Lbl>
        <Lbl>{String(qi+1).padStart(2,"0")} / {String(total).padStart(2,"0")}</Lbl>
      </div>
      <div style={{height:2,background:C.border,marginBottom:28}}><div style={{height:2,background:C.orange,width:`${pct}%`,transition:"width 0.3s"}}/></div>

      <h2 style={{fontFamily:F.serif,fontSize:22,fontWeight:400,fontStyle:"italic",lineHeight:1.6,marginBottom:24,minHeight:60}}>{q.t}</h2>

      {q.type==="text"?(
        <div>
          <textarea value={ans[qid]||""} onChange={e=>setAns({...ans,[qid]:e.target.value})} placeholder="Type here..." rows={3} style={{...inputStyle,fontFamily:F.serif,fontSize:16,resize:"none",lineHeight:1.7,marginBottom:14}}/>
          <button onClick={()=>answer(ans[qid])} disabled={!ans[qid]?.trim()} style={btnStyle(!!ans[qid]?.trim())} onMouseEnter={e=>{if(ans[qid]?.trim())e.target.style.background=C.orange}} onMouseLeave={e=>{if(ans[qid]?.trim())e.target.style.background=C.ink}}>Continue →</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {q.o.map((opt,i)=>(
            <button key={i} onClick={()=>answer(i)} style={{padding:"14px 16px",fontSize:14,fontFamily:F.serif,textAlign:"left",background:"transparent",border:`0.5px solid ${C.border}`,cursor:"pointer",lineHeight:1.6,transition:"all .15s"}}
              onMouseEnter={e=>{e.target.style.borderColor=C.orange;e.target.style.background="rgba(232,93,43,.04)"}}
              onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.background="transparent"}}>
              <span style={{fontFamily:F.mono,fontSize:11,color:C.orange,fontWeight:600,marginRight:10}}>{String.fromCharCode(65+i)}.</span>{opt}
            </button>
          ))}
        </div>
      )}
    </div>);
  }

  // ═══ RESULTS ═══
  if(mode==="results"&&scores){
    const sorted=Object.entries(scores.dims).sort((a,b)=>b[1].raw-a[1].raw);const dimKeys=Object.keys(DIM);
    return(<div style={{...pg,maxWidth:540}} ref={topRef}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <Lbl orange><Quote>Your Noorah score</Quote></Lbl>
        <span style={{display:"inline-block",padding:"4px 14px",border:`1.5px solid ${scores.sev==="Critical"?C.orange:C.border}`,fontFamily:F.mono,fontSize:10,letterSpacing:2,textTransform:"uppercase",color:scores.sev==="Minimal"?"#7B8F6B":scores.sev==="Moderate"?C.muted:C.orange}}>{scores.sev}</span>
      </div>
      <div style={{fontFamily:F.display,fontSize:140,lineHeight:.85,letterSpacing:-4,color:C.ink}}>{scores.total}</div>
      <div style={{fontFamily:F.mono,fontSize:13,color:C.muted,marginTop:4}}>/100</div>

      <div style={{borderTop:`1.5px solid ${C.ink}`,marginTop:20,paddingTop:16,marginBottom:20}}>
        <Lbl style={{display:"block",marginBottom:12}}>Dimensions</Lbl>
        {sorted.map(([k,v],i)=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`0.5px solid ${C.border}`}}>
            <span style={{fontFamily:F.mono,fontSize:10,color:C.orange,fontWeight:600,minWidth:20}}>{String(i+1).padStart(2,"0")}</span>
            <span style={{fontFamily:F.mono,fontSize:10,color:C.muted}}>→</span>
            <span style={{fontFamily:F.mono,fontSize:11,letterSpacing:1,textTransform:"uppercase",flex:1}}>{DIM[k].n}</span>
            <div style={{width:100,height:4,background:C.border,flexShrink:0}}><div style={{height:4,background:k===scores.top?C.orange:C.ink,width:`${(v.raw/v.max)*100}%`,transition:"width .8s"}}/></div>
            <span style={{fontFamily:F.mono,fontSize:11,color:C.muted,minWidth:36,textAlign:"right"}}>{v.raw}/{v.max}</span>
          </div>
        ))}
      </div>

      <div style={{border:`2px solid ${C.ink}`,padding:20,position:"relative",marginTop:24}}>
        <span style={{position:"absolute",top:-8,left:16,background:C.bg,padding:"0 8px",fontFamily:F.mono,fontSize:9,letterSpacing:3,color:C.orange,fontWeight:600}}>UNLOCK</span>
        <p style={{fontFamily:F.serif,fontSize:18,fontStyle:"italic",lineHeight:1.7,marginBottom:12,color:C.ink}}>
          {name}, you've got your number. A number without a plan is just a number.
        </p>
        <p style={{fontFamily:F.mono,fontSize:12,color:C.muted,lineHeight:1.7,marginBottom:16}}>
          8 weeks. 56 days. Every single one mapped out. Four phases — the fast, the rebuild, the return, the anchor. Your patterns. Your schedule. Your rules. Built from your answers. Ready in under a minute.
        </p>
        <button onClick={()=>setMode("generating")} style={{...btnStyle(),background:C.orange}} onMouseEnter={e=>e.target.style.background=C.ink} onMouseLeave={e=>e.target.style.background=C.orange}>
          Get your 8-week plan → $9.99
        </button>
        <Lbl style={{display:"block",textAlign:"center",marginTop:8,fontSize:8}}>8 weeks · 56 days · every day mapped · printable</Lbl>
      </div>
    </div>);
  }

  // ═══ GENERATING ═══
  if(mode==="generating")return(<div style={{...pg,maxWidth:440,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center"}} ref={topRef}>
    <Lbl orange style={{display:"block",marginBottom:16}}><Quote>Building your 8-week plan</Quote></Lbl>
    <p style={{fontFamily:F.serif,fontSize:18,fontStyle:"italic",lineHeight:1.7,color:C.ink,marginBottom:8}}>Noorah is reading your results and writing 56 days of personalized guidance.</p>
    <p style={{fontFamily:F.mono,fontSize:12,color:C.muted}}>This takes 30–45 seconds. Worth the wait.</p>
    <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:24}}>
      {[0,1,2,3,4].map(i=>(<div key={i} style={{width:8,height:8,background:C.orange,opacity:.3,animation:`f 1.5s ease-in-out ${i*.2}s infinite`}}/>))}
    </div>
    <style>{`@keyframes f{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
  </div>);

  // ═══ PLAN ═══
  if(mode==="plan")return(<div style={{...pg,maxWidth:620}} ref={topRef}>
    <div style={{textAlign:"center",paddingBottom:20,borderBottom:`2px solid ${C.ink}`,marginBottom:24}}>
      <Lbl orange style={{display:"block",marginBottom:8}}>Noorah</Lbl>
      <h1 style={{fontFamily:F.display,fontSize:36,letterSpacing:2}}>{name.toUpperCase()}'S 8-WEEK PLAN</h1>
      <Lbl style={{display:"block",marginTop:8}}>Score: {scores?.total}/100 · {scores?.sev?.toUpperCase()} · 56 days · {new Date().toLocaleDateString()}</Lbl>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,border:`0.5px solid ${C.border}`,marginBottom:28}}>
      {[{w:"Week 1-2",p:"The fast"},{w:"Week 3-4",p:"The rebuild"},{w:"Week 5-6",p:"The return"},{w:"Week 7-8",p:"The anchor"}].map((ph,i)=>(
        <div key={i} style={{padding:"12px 16px",borderRight:i%2===0?`0.5px solid ${C.border}`:"none",borderBottom:i<2?`0.5px solid ${C.border}`:"none"}}>
          <Lbl orange style={{fontSize:9}}>{ph.w}</Lbl>
          <div style={{fontFamily:F.serif,fontSize:14,marginTop:2}}>{ph.p}</div>
        </div>
      ))}
    </div>

    {renderPlan()}

    <div className="no-print" style={{borderTop:`2px solid ${C.ink}`,paddingTop:20,marginTop:16,display:"flex",gap:8}}>
      <button onClick={()=>window.print()} style={{...btnStyle(),flex:1}} onMouseEnter={e=>e.target.style.background=C.orange} onMouseLeave={e=>e.target.style.background=C.ink}>Print / Save PDF</button>
      <button onClick={()=>{setMode("start");setName("");setEmail("");setAns({});setScores(null);setPlan("");setQi(0);setPhase("screen")}} style={{flex:1,padding:14,fontFamily:F.mono,fontSize:12,letterSpacing:2,textTransform:"uppercase",background:"transparent",color:C.muted,border:`0.5px solid ${C.border}`,cursor:"pointer"}}>Done</button>
    </div>
    <Lbl className="no-print" style={{display:"block",textAlign:"center",marginTop:20,fontSize:8,color:C.border}}>Generated by Noorah · The digital intent company · {new Date().getFullYear()}</Lbl>
  </div>);

  // ═══ DONE ═══
  if(mode==="done")return(<div style={{...pg,maxWidth:480,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center"}} ref={topRef}>
    <h2 style={{fontFamily:F.display,fontSize:36,letterSpacing:2}}>SAVED.</h2>
    <p style={{fontFamily:F.serif,fontSize:16,fontStyle:"italic",color:C.muted,lineHeight:1.7,margin:"12px 0 24px"}}>In 14 days, you'll hear from us.</p>
    <Lbl orange style={{display:"block"}}><Quote>This is the light before your screen</Quote></Lbl>
  </div>);

  return null;
}
