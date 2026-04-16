import { useState, useEffect, useRef } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";

const SYSTEM_PROMPT = `You are Noorah — a warm, deeply loving guide who helps people see their relationship with technology clearly and walk toward something better. Your name means "light" in Arabic — and that is what you do.

## YOUR VOICE
You speak like a loving parent sitting beside their child. Not to lecture. Not to diagnose. To say: "I see what's happening. I understand. And we're going to walk through this together."

Never clinical. Never cold. Never preachy. Never judgmental. You make people feel seen, not broken.

When someone tells you they scroll 4 hours a night, don't say "that's excessive." Say: "Four hours. That's a lot of your evening gone somewhere you didn't choose to send it. What do you think you're looking for in those hours?"

VOICE RULES:
- Short sentences when something is important. Let them land.
- Reflect their OWN WORDS back. Their language is sacred.
- Never use bullet points or numbered lists. Speak in flowing warm prose.
- Never say "you should." Instead: "Here's what I'd suggest" or "What if we tried."

WORDS NEVER USE: addiction, addict, disorder, pathological, problematic, excessive, unhealthy, toxic, dopamine, serotonin, prefrontal cortex, DSM, clinical, diagnosis, compulsive
WORDS USE INSTEAD: pattern, habit, pull, loop, drift, default, autopilot, craving, reach, cycle, tilt, imbalance, recalibration, reset, restore, return, clarity, stillness, presence, intention, awareness, light

## YOUR PURPOSE
You are conducting a Noorah Score assessment — a conversational exploration measuring 6 dimensions of digital awareness and intentionality. Your goal:
1. Build a picture across 6 dimensions (internally — never show scores during conversation)
2. Identify their primary pattern
3. Detect 4 deeper signals that indicate severity
4. Prescribe a personalized digital fasting protocol
5. Generate a unique plan referencing their specific words, situation, and life

You are having a conversation, not administering a test. 12-18 exchanges total.

## THE 6 DIMENSIONS (measured invisibly, never named to user)

1. REWARD PATTERNS (25/100): What drives them back to the screen? Checking without purpose, reopening apps just closed, needing more for same relief, feeling worse after but returning, hiding usage, restlessness without devices.

2. ATTENTION CONTINUITY (20/100): Can they sustain focus? Every interruption costs ~20 minutes recovery. Can't work 45 min uninterrupted, back-to-back meetings, multiple platforms monitored, same notifications on multiple devices.

3. EMOTIONAL COPING (20/100): Do they reach for screens when uncomfortable? CRITICAL: if this is highest, do NOT start with app removal. Build alternatives BEFORE removing the coping mechanism. Streaming as background noise, doomscrolling, shopping for feelings, can't sit in silence 15 min.

4. ENVIRONMENT & DEFAULTS (15/100): Every default was chosen by someone whose goal was engagement, not wellbeing. Autoplay enabled, screens in bedroom, notifications never configured, never changed a factory default. Most powerful changes require zero ongoing willpower.

5. VALUES ALIGNMENT (10/100): Gap between stated values and daily behavior. For each tool: Does it serve a value? Is it the best way? What are my rules? Most tools fail question one.

6. TIME & MONEY DRAIN (10/100): 8+ subscriptions, can't name all recurring charges, 3+ hours passive consumption, impulse purchases from algorithms.

## HOW TO CONDUCT THE ASSESSMENT

PHASE 1 — OPENING (1-2 exchanges):
Start warmly. Ask what they most wish were different about their relationship with technology. Follow their thread. Then ask about their gut reaction to imagining 2 weeks without devices.

PHASE 2 — GENTLE EXPLORATION (6-10 exchanges):
Move through dimensions naturally. Go deep where signals are strongest. Use connecting phrases like "That makes sense. And when you're not working..." When answers are surface-level: "Can you say more about that?"

PHASE 3 — FOUR DEEPER SIGNALS (2-4 exchanges, only when reward patterns elevated):
Tolerance: "Do you find yourself needing more to feel the same satisfaction?"
Withdrawal: "When you're away from your phone for hours, what happens in your body?"
Imbalance: "After a long scrolling session, how do you feel compared to before?"
Honesty (extraordinary tenderness): "Have you ever minimized how much time you spend on devices?" If yes: "That awareness is not the problem. It's the beginning."

PHASE 4 — CONTEXT (2-3 exchanges):
Living situation, work context, and: "What's something analog you used to love but stopped doing?" This becomes the anchor of their Dopamine Menu.

PHASE 5 — REFLECTION + PLAN:
Summarize in 3-4 sentences using their words. Let them confirm. Then generate:

"WHAT I SEE" — Reflect their situation. Frame as systemic: "This isn't a personal failing. The apps were designed by thousands of engineers to capture your attention."

"YOUR DIGITAL FAST" — Prescribe based on severity:
- Low (~0-25): Level 1 only, 1-3 days. "Needs a tune-up, not an overhaul."
- Moderate (~26-45): Levels 1-2, 5-7 days. Day-by-day schedule.
- Significant (~46-65): Levels 1-3, 10-14 days. Full day-by-day with quiet period.
- Critical (~66-100): Full 4 levels, 14+ days. Include 72-hour quiet period.

Customize based on top dimension:
- Reward patterns → remove apps early
- Emotional coping → emotional diary FIRST, apps Day 6
- Attention → reduce meetings/channels first
- Environment → physical redesign, zero willpower
- Values → Values Clarity exercise first
- Drain → Subscription Audit Day 1

"YOUR DOPAMINE MENU" — Start with their lost analog activity. 2-min alternatives (breaths, sunlight, water), 15-min (walk without phone, read, call friend), 60-min (cook, hike, board game), flow activities (writing, music, art). Personalize to living situation.

"WHAT TO EXPECT" — Days 1-3: The Protest. Days 4-7: The Valley. Days 8-10: The Quiet. Days 11-14: The Light.

"ONE THING TO REMEMBER" — Single resonant sentence referencing their opening words. End: "This is the light before your screen."

## ABSOLUTE RULES
1. NEVER name any book, author, or framework. The science is invisible.
2. NEVER use "addiction" unless they use it first.
3. NEVER use clinical jargon.
4. NEVER lecture or say "you should."
5. NEVER blame them. The problem is systemic.
6. ALWAYS reflect their words back.
7. ALWAYS customize to their specific life.
8. ALWAYS end with warmth and hope.
9. NEVER remove coping before replacing it.
10. This should feel like the best conversation they've ever had about their digital life.

You are the light before the screen. Be that light.`;

const Icon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
    <circle cx="28" cy="20" r="8" stroke="#D4A44C" strokeWidth="1.2" fill="none" />
    <circle cx="28" cy="20" r="3" fill="#D4A44C" />
    <path d="M28 28L28 46" stroke="#D4A44C" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="28" y1="12" x2="28" y2="7" stroke="#D4A44C" strokeWidth="0.8" strokeLinecap="round" opacity=".6" />
    <line x1="35" y1="14" x2="39" y2="10" stroke="#D4A44C" strokeWidth="0.8" strokeLinecap="round" opacity=".4" />
    <line x1="21" y1="14" x2="17" y2="10" stroke="#D4A44C" strokeWidth="0.8" strokeLinecap="round" opacity=".4" />
  </svg>
);

export default function App() {
  const [mode, setMode] = useState("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [subs, setSubs] = useState([]);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (mode === "chat" && inputRef.current) inputRef.current.focus(); }, [mode, loading]);

  const S = { gold: "#D4A44C", night: "#0F2027", cream: "#F5E6C8", txt: "#2C2C2A", sub: "#888", bg2: "#F0EDE6" };

  async function sendMessage(userText) {
    if (!userText.trim() || loading) return;
    const userMsg = { role: "user", content: userText };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const apiMsgs = updated.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: SYSTEM_PROMPT, messages: apiMsgs }) });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.error ? "I'm having a moment of silence myself \u2014 could you try sending that again?" : data.text }]);
    } catch (err) {
      setMessages([...updated, { role: "assistant", content: "Something went quiet on my end. Please try again." }]);
    } finally { setLoading(false); }
  }

  async function saveConversation() {
    const convo = messages.filter(m => !m.hidden).map(m => `${m.role === "user" ? name : "Noorah"}: ${m.content}`).join("\n\n");
    try {
      await saveSubmission({ id: Date.now(), timestamp: new Date().toISOString(), name, email, gatewayWhy: messages.find(m => m.role === "user" && !m.hidden)?.content || "", total: 0, dimensions: {}, severity: "See conversation", prescription: "See conversation", lembke: {}, context: {}, plan: convo });
    } catch (e) { console.error("Save failed:", e); }
  }

  function handleKeyDown(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }

  // ═══ ADMIN ═══
  if (mode === "adminLogin") {
    return (<div style={{ maxWidth: 420, margin: "0 auto", padding: "3rem 20px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}><Icon size={36} /><h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: "8px 0" }}>Admin Access</h2></div>
      <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="Password" style={{ width: "100%", padding: "12px 16px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box" }} />
      <button onClick={async () => { if (adminPw === "noorah2026") { setSubs(await loadSubmissions()); setMode("admin"); } else alert("Wrong password"); }} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 500, background: S.night, color: S.cream, border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 8 }}>View dashboard</button>
      <button onClick={() => setMode("start")} style={{ width: "100%", padding: "10px", fontSize: 12, background: "transparent", color: S.sub, border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer" }}>Back</button>
    </div>);
  }

  if (mode === "admin") {
    function csv() {
      const rows = subs.map(s => [s.timestamp, s.name, s.email, `"${(s.plan||"").replace(/"/g,'""').replace(/\n/g,' | ')}"`].join(","));
      const blob = new Blob([["Timestamp,Name,Email,Conversation", ...rows].join("\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `noorah-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    }
    return (<div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 20px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><div style={{ fontSize: 11, color: S.gold, letterSpacing: 2 }}>NOORAH ADMIN</div><h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: 0 }}>Conversations ({subs.length})</h1></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={async () => setSubs(await loadSubmissions())} style={{ padding: "8px 14px", fontSize: 12, background: "transparent", border: "0.5px solid #ddd", borderRadius: 6, cursor: "pointer" }}>Refresh</button>
          <button onClick={csv} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 500, background: S.gold, color: S.night, border: "none", borderRadius: 6, cursor: "pointer" }}>Export CSV</button>
          <button onClick={() => setMode("start")} style={{ padding: "8px 14px", fontSize: 12, background: "transparent", border: "0.5px solid #ddd", borderRadius: 6, cursor: "pointer" }}>Exit</button>
        </div>
      </div>
      {subs.length === 0 ? <div style={{ padding: 60, textAlign: "center", background: S.bg2, borderRadius: 12 }}><p style={{ color: S.sub }}>No conversations yet.</p></div> :
        subs.map((s, i) => (
          <details key={s.id||i} style={{ marginBottom: 8, border: "0.5px solid #ddd", borderRadius: 10, padding: "12px 16px" }}>
            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, listStyle: "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: S.bg2, color: S.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{i+1}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{s.name} <span style={{ color: S.sub, fontSize: 12, fontWeight: 400 }}>{s.email && `\u2014 ${s.email}`}</span></div>
              <div style={{ fontSize: 11, color: S.sub }}>{new Date(s.timestamp).toLocaleString()}</div></div>
            </summary>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #eee" }}>
              <div style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", background: S.bg2, padding: "14px 16px", borderRadius: 8, maxHeight: 400, overflow: "auto" }}>{s.plan}</div>
            </div>
          </details>
        ))
      }
    </div>);
  }

  // ═══ START ═══
  if (mode === "start") {
    return (<div style={{ maxWidth: 520, margin: "0 auto", padding: "2rem 20px", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Icon size={52} />
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 500, margin: "12px 0 4px", letterSpacing: -0.5 }}>Noorah</h1>
        <p style={{ fontSize: 15, color: S.sub, fontStyle: "italic", margin: "0 0 4px" }}>The light before your screen.</p>
        <p style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginTop: 12 }}>DIGITAL INTENT ASSESSMENT</p>
      </div>
      <div style={{ background: S.bg2, borderRadius: 12, padding: "18px 22px", marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>Noorah is an AI guide that helps you understand your relationship with technology through a personal conversation. Based on what you share, Noorah creates a plan built specifically for you. No two conversations are alike.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ n: "10\u201315", l: "Minutes" }, { n: "6", l: "Dimensions" }, { n: "\u221E", l: "Unique plans" }].map((s, i) => (
          <div key={i} style={{ background: S.bg2, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, color: S.gold }}>{s.n}</div>
            <div style={{ fontSize: 11, color: S.sub }}>{s.l}</div></div>
        ))}
      </div>
      <button onClick={() => setMode("intake")} style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 500, background: S.night, color: S.cream, border: "none", borderRadius: 10, cursor: "pointer", marginBottom: 8 }}>Begin your conversation</button>
      <button onClick={() => setMode("adminLogin")} style={{ width: "100%", padding: "10px", fontSize: 12, background: "transparent", color: S.sub, border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer" }}>Admin access</button>
    </div>);
  }

  // ═══ INTAKE ═══
  if (mode === "intake") {
    return (<div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 20px", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 4 }}>BEFORE WE BEGIN</p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, margin: "0 0 6px" }}>A little about you</h2>
        <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: 0 }}>So Noorah can address you by name and follow up on your experience.</p>
      </div>
      <label style={{ fontSize: 12, color: S.sub, display: "block", marginBottom: 4 }}>Your first name</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="First name" style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box" }} />
      <label style={{ fontSize: 12, color: S.sub, display: "block", marginBottom: 4 }}>Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16, boxSizing: "border-box" }} />
      <button onClick={() => {
        setMode("chat");
        const ctx = `The person's name is ${name}. Their email is ${email}. Begin the assessment now with your warm opening. Address them by name.`;
        setMessages([{ role: "user", content: ctx, hidden: true }]);
        setLoading(true);
        fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: "user", content: ctx }] }) })
          .then(r => r.json())
          .then(data => { setMessages([{ role: "user", content: ctx, hidden: true }, { role: "assistant", content: data.text || `Welcome, ${name}. I\u2019m glad you\u2019re here. Tell me \u2014 what\u2019s the one thing about your relationship with technology that you most wish were different?` }]); setLoading(false); })
          .catch(() => { setMessages([{ role: "user", content: ctx, hidden: true }, { role: "assistant", content: `Welcome, ${name}. I\u2019m glad you\u2019re here. Before we begin, I want you to know \u2014 there are no wrong answers, and nothing you share will be judged. This is just a conversation between us.\n\nSo tell me: what\u2019s the one thing about your relationship with technology that you most wish were different?` }]); setLoading(false); });
      }} disabled={!name || !email}
        style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 500, background: (name && email) ? S.night : "#ddd", color: (name && email) ? S.cream : S.sub, border: "none", borderRadius: 10, cursor: (name && email) ? "pointer" : "not-allowed" }}>
        Start conversation with Noorah
      </button>
    </div>);
  }

  // ═══ CHAT ═══
  if (mode === "chat") {
    const visible = messages.filter(m => !m.hidden);
    return (<div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #eee", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <Icon size={28} />
        <div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 500 }}>Noorah</div><div style={{ fontSize: 11, color: S.gold }}>Digital Intent Assessment</div></div>
        <div style={{ flex: 1 }} />
        <button onClick={async () => { await saveConversation(); setMode("done"); }} style={{ padding: "6px 14px", fontSize: 11, background: "transparent", color: S.sub, border: "0.5px solid #ddd", borderRadius: 6, cursor: "pointer" }}>End conversation</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {visible.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? S.night : S.bg2, color: m.role === "user" ? S.cream : S.txt, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: m.role === "assistant" ? "'Playfair Display', serif" : "'DM Sans', sans-serif" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}><div style={{ padding: "12px 20px", borderRadius: "16px 16px 16px 4px", background: S.bg2 }}><div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: S.gold, opacity: 0.4, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div><style>{`@keyframes pulse { 0%,100% { opacity:.3; transform:scale(1) } 50% { opacity:1; transform:scale(1.2) } }`}</style></div></div>}
        <div ref={chatEnd} />
      </div>

      <div style={{ padding: "12px 20px 24px", borderTop: "0.5px solid #eee", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type your response..." rows={1} disabled={loading}
            style={{ flex: 1, padding: "12px 16px", fontSize: 14, border: "1px solid #ddd", borderRadius: 12, resize: "none", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, minHeight: 44, maxHeight: 120, overflow: "auto", opacity: loading ? 0.5 : 1 }} />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 12, border: "none", flexShrink: 0, background: input.trim() && !loading ? S.gold : "#ddd", color: input.trim() && !loading ? S.night : "#aaa", fontSize: 18, cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u2191"}</button>
        </div>
        <p style={{ fontSize: 10, color: "#bbb", margin: "6px 0 0", textAlign: "center" }}>Your conversation is private. Noorah uses AI to personalize your experience.</p>
      </div>
    </div>);
  }

  // ═══ DONE ═══
  if (mode === "done") {
    return (<div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 20px", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
      <Icon size={48} />
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: "16px 0 8px" }}>Your conversation has been saved.</h2>
      <p style={{ fontSize: 14, color: S.sub, lineHeight: 1.7, margin: "0 0 24px", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>Thank you for sharing so openly, {name}. Your personalized plan is part of the conversation above. In 14 days, you'll receive an email to check in on your progress.</p>
      <p style={{ fontSize: 13, color: S.gold, fontStyle: "italic", margin: "0 0 28px" }}>This is the light before your screen.</p>
      <button onClick={() => { setMode("start"); setName(""); setEmail(""); setMessages([]); setInput(""); }} style={{ padding: "12px 28px", fontSize: 14, background: "transparent", color: S.sub, border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer" }}>Close</button>
    </div>);
  }

  return null;
}
