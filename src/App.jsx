import { useState, useEffect } from "react";
import { saveSubmission, loadSubmissions } from "./supabase";

// ============ GATEWAY QUESTIONS ============
const GATEWAY = [
  { id: "g1", q: "What brought you here today? What\u2019s the one thing about your digital life that bothers you most?",
    opts: [
      { t: "I scroll for hours and don\u2019t remember what I saw", s: { dopamine: 2, emotional: 1 }, tag: "scroller" },
      { t: "I\u2019m drowning in work notifications and can\u2019t disconnect", s: { attention: 2, environment: 1 }, tag: "worker" },
      { t: "I use screens to escape uncomfortable feelings", s: { emotional: 3, dopamine: 1 }, tag: "escapist" },
      { t: "I\u2019m wasting money on subscriptions I don\u2019t use", s: { drain: 2, values: 1 }, tag: "collector" },
      { t: "My kids see the top of my head, not my face", s: { values: 3, emotional: 1 }, tag: "parent" },
      { t: "I can\u2019t focus or get deep work done anymore", s: { attention: 3, dopamine: 1 }, tag: "fragmented" },
      { t: "Something else \u2014 all of it, honestly", s: { dopamine: 1, attention: 1, emotional: 1 }, tag: "general" },
    ]},
  { id: "g2", q: "When you imagine breaking free from your devices for 2 weeks, what\u2019s your gut reaction?",
    opts: [
      { t: "Relief \u2014 I\u2019ve been wanting this", s: {}, tag: "ready" },
      { t: "Nervous but curious \u2014 I\u2019d try it", s: {}, tag: "curious" },
      { t: "Anxious \u2014 what would I do instead?", s: { emotional: 1 }, tag: "anxious" },
      { t: "Impossible \u2014 I can\u2019t imagine it", s: { dopamine: 2, emotional: 1 }, tag: "dependent" },
    ]}
];

const SCREENING = [
  { dim: "dopamine", q: "How often do you check any screen without a specific reason?",
    opts: [{ t: "Rarely \u2014 only with purpose", s: 0 }, { t: "A few times a day out of habit", s: 1 }, { t: "Many times a day \u2014 I catch myself", s: 2 }, { t: "Constantly \u2014 hands move before I think", s: 3 }] },
  { dim: "attention", q: "Can you work on one task for 45+ minutes without checking any screen?",
    opts: [{ t: "Yes, regularly", s: 0 }, { t: "Sometimes, if engaged", s: 1 }, { t: "Rarely \u2014 I break within 20 min", s: 2 }, { t: "Almost never \u2014 feels impossible", s: 3 }] },
  { dim: "emotional", q: "When you feel bored, anxious, or stressed, what do you reach for first?",
    opts: [{ t: "A non-digital activity", s: 0 }, { t: "Sometimes digital, sometimes not", s: 1 }, { t: "Usually a screen", s: 2 }, { t: "Always a screen \u2014 my only coping mechanism", s: 3 }] },
  { dim: "environment", q: "How many screens are in your bedroom?",
    opts: [{ t: "Zero \u2014 screen-free", s: 0 }, { t: "One, across the room", s: 1 }, { t: "Two", s: 2 }, { t: "Three or more", s: 3 }] },
  { dim: "values", q: "Would the person you want to be in 5 years approve of your digital time today?",
    opts: [{ t: "Yes \u2014 my habits support my goals", s: 0 }, { t: "Mostly, with a few changes", s: 1 }, { t: "Probably not \u2014 significant gap", s: 2 }, { t: "Definitely not \u2014 contradicting my goals", s: 3 }] },
  { dim: "drain", q: "Hours per day on passive digital consumption (scrolling, streaming, browsing)?",
    opts: [{ t: "Under 30 minutes", s: 0 }, { t: "30 min to 1 hour", s: 1 }, { t: "1-3 hours", s: 2 }, { t: "3+ hours", s: 3 }] },
];

const DEEP_DIVE = {
  dopamine: [
    { q: "What\u2019s the first digital action you take upon waking?", opts: [{ t: "None \u2014 non-digital morning", s: 0 }, { t: "Check the time, put it down", s: 1 }, { t: "Check notifications or email", s: 2 }, { t: "Scroll for 15+ min before getting up", s: 3 }] },
    { q: "Do you reopen an app you just closed without realizing it?", opts: [{ t: "Almost never", s: 0 }, { t: "Occasionally", s: 1 }, { t: "Regularly \u2014 autopilot", s: 2 }, { t: "Constantly \u2014 close-reopen loop", s: 3 }] },
    { q: "Compared to a year ago, do you need MORE screen time for the same enjoyment?", lembke: "tolerance", opts: [{ t: "No \u2014 same or less", s: 0 }, { t: "A little more", s: 1 }, { t: "Definitely more", s: 2 }, { t: "Dramatically more", s: 3 }] },
    { q: "When forced without your phone for hours, what do you feel?", lembke: "withdrawal", opts: [{ t: "Nothing \u2014 barely notice", s: 0 }, { t: "Mild restlessness", s: 1 }, { t: "Noticeable anxiety", s: 2 }, { t: "Genuine distress", s: 3 }] },
    { q: "After a long scrolling session, your mood is usually:", lembke: "balance", opts: [{ t: "Same or slightly better", s: 0 }, { t: "Neutral but drained", s: 1 }, { t: "Worse \u2014 empty or guilty", s: 2 }, { t: "Much worse \u2014 but I keep going", s: 3 }] },
    { q: "Have you lied to yourself or others about device time?", lembke: "honesty", opts: [{ t: "No", s: 0 }, { t: "Minimized once or twice", s: 1 }, { t: "Regularly downplay it", s: 2 }, { t: "Actively hide it", s: 3 }] },
  ],
  attention: [
    { q: "Total daily interruptions across ALL devices?", opts: [{ t: "Under 20", s: 0 }, { t: "20-50", s: 1 }, { t: "50-100", s: 2 }, { t: "100+", s: 3 }] },
    { q: "Video calls or virtual meetings per week?", opts: [{ t: "0-3", s: 0 }, { t: "4-8", s: 1 }, { t: "9-15", s: 2 }, { t: "15+", s: 3 }] },
    { q: "Slack channels, group chats, or threads you monitor?", opts: [{ t: "Under 5", s: 0 }, { t: "5-10", s: 1 }, { t: "10-20", s: 2 }, { t: "20+", s: 3 }] },
    { q: "Same notifications on multiple devices?", opts: [{ t: "No \u2014 each device has a role", s: 0 }, { t: "Some overlap", s: 1 }, { t: "Significant overlap", s: 2 }, { t: "Everything goes everywhere", s: 3 }] },
  ],
  emotional: [
    { q: "Do you use streaming as background noise to avoid silence?", opts: [{ t: "No \u2014 comfortable with silence", s: 0 }, { t: "Occasionally", s: 1 }, { t: "Often \u2014 silence is uncomfortable", s: 2 }, { t: "Almost always", s: 3 }] },
    { q: "Do you consume news in a way that increases anxiety but can\u2019t stop?", opts: [{ t: "No \u2014 intentional news", s: 0 }, { t: "Sometimes pulled in", s: 1 }, { t: "Often \u2014 doomscrolling", s: 2 }, { t: "Frequently \u2014 hurts but keep reading", s: 3 }] },
    { q: "Can you sit in complete silence for 15 minutes without distress?", opts: [{ t: "Yes, comfortably", s: 0 }, { t: "Yes, but I have to try", s: 1 }, { t: "Difficult", s: 2 }, { t: "Haven\u2019t tried in months", s: 3 }] },
    { q: "Have you shopped online just for the feeling, not to buy?", opts: [{ t: "No \u2014 intentional shopping", s: 0 }, { t: "Occasionally", s: 1 }, { t: "Regularly \u2014 it\u2019s soothing", s: 2 }, { t: "Often \u2014 main emotional outlet", s: 3 }] },
  ],
  environment: [
    { q: "Have you disabled autoplay on streaming and social media?", opts: [{ t: "Yes, on all", s: 0 }, { t: "On some", s: 1 }, { t: "Didn\u2019t know you could", s: 2 }, { t: "No \u2014 pulled into autoplay loops", s: 3 }] },
    { q: "Smartwatch/tracker with notifications enabled?", opts: [{ t: "No wearable, or notifications off", s: 0 }, { t: "Only calls and critical", s: 1 }, { t: "Selective", s: 2 }, { t: "Mirrors all phone notifications", s: 3 }] },
    { q: "Have you configured devices away from defaults for wellbeing?", opts: [{ t: "Yes \u2014 customized everything", s: 0 }, { t: "A few things", s: 1 }, { t: "Barely", s: 2 }, { t: "Nothing \u2014 all factory settings", s: 3 }] },
  ],
  values: [
    { q: "What % of digital time supports your top life priorities?", opts: [{ t: "Most (70%+)", s: 0 }, { t: "About half", s: 1 }, { t: "Less than 25%", s: 2 }, { t: "Almost none", s: 3 }] },
    { q: "Is your information diet intentionally curated?", opts: [{ t: "Curated \u2014 I audit regularly", s: 0 }, { t: "Mostly intentional", s: 1 }, { t: "Accumulated over years", s: 2 }, { t: "Completely unmanaged", s: 3 }] },
    { q: "Do work tools help meaningful work, or create busywork?", opts: [{ t: "Genuinely help", s: 0 }, { t: "Mostly helpful", s: 1 }, { t: "Significant busywork", s: 2 }, { t: "Tools have become the work", s: 3 }] },
  ],
  drain: [
    { q: "How many recurring digital subscriptions?", opts: [{ t: "0-3", s: 0 }, { t: "4-7", s: 1 }, { t: "8-12", s: 2 }, { t: "13+ or don\u2019t know", s: 3 }] },
    { q: "How many do you actively use twice per week?", opts: [{ t: "All or nearly all", s: 0 }, { t: "Most", s: 1 }, { t: "About half", s: 2 }, { t: "Fewer than half", s: 3 }] },
    { q: "Impulse purchase from an ad or algorithm in the last 30 days?", opts: [{ t: "No", s: 0 }, { t: "One small one", s: 1 }, { t: "A few", s: 2 }, { t: "Multiple \u2014 regularly", s: 3 }] },
  ]
};

const CONTEXT = [
  { id: "c1", q: "Do you live alone, with a partner, or with a family?", opts: [{ t: "Alone" }, { t: "With a partner" }, { t: "With a family/kids" }, { t: "Roommates" }] },
  { id: "c2", q: "Is your work mostly remote, hybrid, or in-office?", opts: [{ t: "Fully remote" }, { t: "Hybrid" }, { t: "In-office" }, { t: "Not working currently" }] },
  { id: "c3", q: "What\u2019s one analog activity you used to love but stopped?", opts: [{ t: "Reading physical books" }, { t: "Playing an instrument" }, { t: "Creative hobby (art, crafts, writing)" }, { t: "Outdoor activity (hiking, sports)" }, { t: "Cooking from scratch" }, { t: "Hands-on making (woodwork, gardening)" }, { t: "Nothing specific" }] },
];

const DIM = {
  dopamine: { name: "Dopamine dependency", color: "#7B6DB5", light: "#EEEDFE", weight: 25 },
  attention: { name: "Attention fragmentation", color: "#BA7517", light: "#FAEEDA", weight: 20 },
  emotional: { name: "Emotional displacement", color: "#D85A30", light: "#FAECE7", weight: 20 },
  environment: { name: "Environmental design", color: "#0F6E56", light: "#E1F5EE", weight: 15 },
  values: { name: "Value-action alignment", color: "#185FA5", light: "#E6F1FB", weight: 10 },
  drain: { name: "Financial + temporal drain", color: "#A32D2D", light: "#FCEBEB", weight: 10 },
};

function getSeverity(s) {
  if (s <= 25) return { label: "Minimal", color: "#0F6E56", bg: "#E1F5EE", level: "Level 1 only", days: "1\u20133 days", desc: "Your digital life is well-managed. Small optimizations can take you from good to exceptional." };
  if (s <= 45) return { label: "Moderate", color: "#BA7517", bg: "#FAEEDA", level: "Levels 1\u20132", days: "5\u20137 days", desc: "Emerging patterns worth addressing. The Noorah Digital Fast can create meaningful change." };
  if (s <= 65) return { label: "Significant", color: "#D85A30", bg: "#FAECE7", level: "Levels 1\u20133", days: "10\u201314 days", desc: "Active harm to focus, relationships, and wellbeing. Intervention is strongly recommended." };
  return { label: "Critical", color: "#A32D2D", bg: "#FCEBEB", level: "Full 4 levels", days: "14+ days", desc: "Your digital ecosystem has taken control. Clients at this level see the most dramatic transformations." };
}

function generatePlan(d) {
  const { name: uName, total, dimensions, lembke, gatewayWhy, gatewayReactionTag, context } = d;
  const sev = getSeverity(total);
  const sorted = Object.keys(dimensions).sort((a, b) => dimensions[b] - dimensions[a]);
  const top = sorted[0];
  const first = uName.split(" ")[0];
  const lembkeHigh = Object.keys(lembke).filter(k => lembke[k] >= 2).length;

  let p1 = `${first}, you told us: \u201C${gatewayWhy}\u201D \u2014 and your assessment reveals what\u2019s happening underneath.\n\n`;
  if (lembkeHigh >= 3) p1 += `Your answers show all four clinical markers from Dr. Anna Lembke\u2019s Dopamine Nation (Stanford Addiction Medicine): tolerance, withdrawal, pleasure-pain imbalance, and self-deception. This isn\u2019t weakness. This is a brain in a dopamine deficit state \u2014 the same neurological pattern seen in substance addiction. The good news: this is exactly what the Noorah Digital Fast reverses.`;
  else if (lembke.tolerance >= 2 && lembke.withdrawal >= 2) p1 += `Your answers show two key clinical markers: tolerance (you need more screen time for the same relief) and withdrawal (real distress without devices). Dr. Lembke calls this a pleasure-pain seesaw tilted toward pain as your new baseline. Your brain isn\u2019t broken \u2014 it\u2019s adapted. Now we help it re-adapt.`;
  else if (lembke.balance >= 2) p1 += `One answer stood out: scrolling leaves you feeling worse, but you keep going back. Dr. Lembke of Stanford calls this the pleasure-pain seesaw. Your brain chases relief it can no longer deliver. The fast restores the balance.`;
  else if (lembke.tolerance >= 2) p1 += `You need more screen time than you used to for the same feeling. That\u2019s tolerance \u2014 the first sign your dopamine baseline has shifted. It recalibrates quickly once you create space.`;
  else if (total >= 60) p1 += `Your score shows significant digital overwhelm across multiple dimensions. The systems were designed to produce exactly this result. But the path out is clear and well-mapped.`;
  else if (total >= 40) p1 += `Your score is moderate \u2014 a strong starting position. You\u2019re aware enough to know something needs to change, but not so deep that the reset feels impossible.`;
  else p1 += `Your score is relatively low, meaning your digital life is better managed than most. The suggestions below are refinements, not overhauls.`;

  let p2 = `\n\nYour prescribed fast is ${sev.level} over ${sev.days}. What\u2019s unique to you: `;
  const dimDescs = {
    dopamine: `your highest dimension is dopamine dependency (${dimensions.dopamine}/${DIM.dopamine.weight}). We start with the Notification Fast on Day 1, then move to the App Fast by Day 2 \u2014 removing the trigger from your phone before the compulsion loop will quiet.`,
    attention: `your highest dimension is attention fragmentation (${dimensions.attention}/${DIM.attention.weight}). Before touching phone apps, reduce your meeting load by 50% and consolidate messaging channels to the top 3 only. You can\u2019t rebuild focus while being pinged every 4 minutes.`,
    emotional: `your highest dimension is emotional displacement (${dimensions.emotional}/${DIM.emotional.weight}). We do NOT start with app removal \u2014 that strips away your coping mechanism without replacing it. Your first 5 days are the Emotional Trigger Diary: log every digital reach and the feeling underneath. Then on Day 6, we remove apps.`,
    environment: `your highest dimension is environmental design (${dimensions.environment}/${DIM.environment.weight}). Your fast focuses on redesigning spaces, not willpower. Day 1: move the phone charger out of the bedroom. Day 2: disable autoplay everywhere. Day 3: reorganize your home screen \u2014 tools only on page 1.`,
    values: `your highest dimension is value-action alignment (${dimensions.values}/${DIM.values.weight}). Begin with the Values Clarity exercise: articulate your top 3 life priorities on paper. Then every digital tool gets screened: does it serve a value I hold? Is it the best way? When and how will I use it?`,
    drain: `your highest dimension is financial and temporal drain (${dimensions.drain}/${DIM.drain.weight}). Day 1 is your Subscription Audit: cancel everything unused in 30 days. Calculate passive consumption hours \u00d7 hourly rate. The dollar cost of wasted attention is the fastest motivator.`,
  };
  p2 += dimDescs[top] || dimDescs.dopamine;

  let p3 = `\n\nWhat to expect: `;
  if (lembke.tolerance >= 2 || lembke.withdrawal >= 2) p3 += `Because your tolerance and withdrawal markers are elevated, days 3\u20137 will feel genuinely difficult. Phantom vibrations. Restlessness. An aching sense something is missing. This IS the recalibration \u2014 it means the fast is working. By day 8, the fog lifts. By day 11, you\u2019ll notice things you haven\u2019t in years.`;
  else if (gatewayReactionTag === "dependent" || gatewayReactionTag === "anxious") p3 += `You said this feels impossible or anxiety-inducing \u2014 completely normal. The first 48 hours are hardest. Hydrate, sleep more, walk daily. By day 4, the anxiety fades. By day 8, a strange, unfamiliar stillness. That\u2019s your nervous system resting.`;
  else if (gatewayReactionTag === "ready") p3 += `You said you\u2019ve been wanting this \u2014 your readiness does half the work. Some restlessness in days 1\u20133 is normal, but by day 5 you\u2019ll be ahead of schedule.`;
  else p3 += `Expect some discomfort in days 1\u20134 \u2014 reaching for a phone that isn\u2019t there, phantom notifications. This is your dopamine system protesting. It passes. By day 8, a quiet you may not have felt in years.`;

  let p4 = `\n\nYour Dopamine Menu begins with `;
  const lost = context.lostActivity || "";
  if (lost && lost !== "Nothing specific") p4 += `the thing you already miss: ${lost.toLowerCase()}. Start there \u2014 your body already knows it\u2019s nourishing. `;
  else p4 += `three activities chosen for your life: `;

  if (context.work === "Fully remote") p4 += `Since you work remotely, you need a physical boundary between work-screen and comfort-screen. Close your laptop at a set hour and don\u2019t reopen it. `;
  else if (context.work === "Hybrid" || context.work === "In-office") p4 += `Use your commute or lunch as reset windows \u2014 leave the phone in your bag. `;

  if (context.living === "With a family/kids") p4 += `With kids in the house, every minute your phone is away from the table teaches them what attention looks like.`;
  else if (context.living === "With a partner") p4 += `Consider inviting your partner into the fast. Shared restraint is easier, and the conversations in the quiet are the ones your relationship has been missing.`;
  else if (context.living === "Alone") p4 += `Living alone, the silence will feel louder at first. Call a friend instead of texting. The voice of another human is the oldest antidote to digital overwhelm.`;
  else p4 += `In a shared space, claim one room as screen-free. The physical boundary becomes a mental one.`;

  p4 += `\n\nThis is the light before your screen.`;
  return p1 + p2 + p3 + p4;
}

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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [quizPath, setQuizPath] = useState([]);
  const [adminPw, setAdminPw] = useState("");
  const [subs, setSubs] = useState([]);
  const [plan, setPlan] = useState(null);
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function buildPath(gAns, sAns) {
    const path = [];
    const ds = {};
    Object.keys(DIM).forEach(d => { ds[d] = sAns[d] || 0; });
    if (gAns.g1?.s) Object.keys(gAns.g1.s).forEach(d => { ds[d] += gAns.g1.s[d] || 0; });
    const sorted = Object.keys(ds).sort((a, b) => ds[b] - ds[a]);
    sorted.slice(0, 3).forEach(d => { DEEP_DIVE[d].forEach((_, i) => path.push({ type: "deep", dim: d, qIndex: i })); });
    sorted.slice(3).forEach(d => { DEEP_DIVE[d].slice(0, 2).forEach((_, i) => path.push({ type: "deep", dim: d, qIndex: i })); });
    CONTEXT.forEach((_, i) => path.push({ type: "context", cIndex: i }));
    return path;
  }

  // Build adaptive path after screening
  useEffect(() => {
    if (mode === "quiz" && step >= GATEWAY.length + SCREENING.length && quizPath.length === 0) {
      const gAns = { g1: answers.gateway_g1, g2: answers.gateway_g2 };
      const sAns = {};
      SCREENING.forEach(s => { sAns[s.dim] = answers[`screen_${s.dim}`] || 0; });
      setQuizPath(buildPath(gAns, sAns));
    }
  }, [mode, step, quizPath.length]);

  // Submit when quiz complete
  useEffect(() => {
    if (mode === "quiz" && quizPath.length > 0 &&
        step >= GATEWAY.length + SCREENING.length + quizPath.length &&
        !isSubmitting && !plan) {
      setIsSubmitting(true);
      doSubmit();
    }
  }, [mode, step, quizPath.length, isSubmitting, plan]);

  function calcResults() {
    const dimRaw = {}, dimMax = {};
    Object.keys(DIM).forEach(d => { dimRaw[d] = 0; dimMax[d] = 0; });
    SCREENING.forEach(s => { const a = answers[`screen_${s.dim}`]; if (a !== undefined) { dimRaw[s.dim] += a; dimMax[s.dim] += 3; } });
    Object.keys(DEEP_DIVE).forEach(d => { DEEP_DIVE[d].forEach((_, i) => { const a = answers[`deep_${d}_${i}`]; if (a !== undefined) { dimRaw[d] += a; dimMax[d] += 3; } }); });
    const dimensions = {};
    Object.keys(DIM).forEach(d => { dimensions[d] = dimMax[d] > 0 ? Math.round((dimRaw[d] / dimMax[d]) * DIM[d].weight) : 0; });
    const total = Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0));
    return { total, dimensions, lembke: { tolerance: answers.deep_dopamine_2 || 0, withdrawal: answers.deep_dopamine_3 || 0, balance: answers.deep_dopamine_4 || 0, honesty: answers.deep_dopamine_5 || 0 } };
  }

  async function doSubmit() {
    const r = calcResults();
    const sev = getSeverity(r.total);
    const pd = { name, total: r.total, dimensions: r.dimensions, lembke: r.lembke,
      gatewayWhy: answers.gateway_g1?.t || "", gatewayTag: answers.gateway_g1?.tag || "",
      gatewayReactionTag: answers.gateway_g2?.tag || "",
      context: { living: answers.context_c1?.t || "", work: answers.context_c2?.t || "", lostActivity: answers.context_c3?.t || "" } };
    const p = generatePlan(pd);
    setPlan(p);
    setResults(r);
    // Show results IMMEDIATELY — don't wait for database
    setMode("results");
    // Save in background — if it fails, user still sees their results
    try {
      const sub = { id: Date.now(), timestamp: new Date().toISOString(), name, email,
        gatewayWhy: pd.gatewayWhy, gatewayTag: pd.gatewayTag, total: r.total,
        dimensions: r.dimensions, severity: sev.label,
        prescription: `${sev.level}, ${sev.days}`, lembke: r.lembke, context: pd.context, plan: p };
      await saveSubmission(sub);
    } catch (e) {
      console.error("Save failed (results still shown):", e);
    }
  }

  function reset() {
    setMode("start"); setStep(0); setAnswers({}); setName(""); setEmail("");
    setQuizPath([]); setPlan(null); setResults(null); setIsSubmitting(false);
  }

  const S = { page: { maxWidth: 560, margin: "0 auto", padding: "2rem 20px", fontFamily: "'DM Sans', sans-serif" },
    h1: { fontFamily: "'Playfair Display', serif", fontWeight: 500 },
    btn: { width: "100%", padding: "14px", fontSize: 15, fontWeight: 500, background: "#0F2027", color: "#F5E6C8", border: "none", borderRadius: 10, cursor: "pointer" },
    btnGold: { width: "100%", padding: "14px", fontSize: 15, fontWeight: 500, background: "#D4A44C", color: "#0F2027", border: "none", borderRadius: 10, cursor: "pointer" },
    ghost: { width: "100%", padding: "10px", fontSize: 12, background: "transparent", color: "#888", border: "0.5px solid #ddd", borderRadius: 8, cursor: "pointer" },
    input: { width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box" },
    label: { fontSize: 12, color: "#888", display: "block", marginBottom: 4 },
    gold: "#D4A44C", night: "#0F2027", txt: "#2C2C2A", sub: "#888", bg2: "#F0EDE6",
  };

  // ===== ADMIN =====
  if (mode === "adminLogin") {
    return (<div style={S.page}>
      <div style={{ textAlign: "center", marginBottom: 24 }}><Icon size={36} /><h2 style={{ ...S.h1, fontSize: 24, margin: "8px 0 4px" }}>Admin Access</h2></div>
      <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="Password" style={S.input} />
      <button onClick={async () => { if (adminPw === "noorah2026") { setSubs(await loadSubmissions()); setMode("admin"); } else alert("Wrong password"); }} style={{ ...S.btn, marginBottom: 8 }}>View dashboard</button>
      <button onClick={() => setMode("start")} style={S.ghost}>Back</button>
      <p style={{ fontSize: 11, color: "#aaa", marginTop: 16, textAlign: "center" }}>Password: noorah2026</p>
    </div>);
  }

  if (mode === "admin") {
    const avg = subs.length > 0 ? Math.round(subs.reduce((a, s) => a + s.total, 0) / subs.length) : 0;
    const sevC = subs.reduce((acc, s) => { acc[s.severity] = (acc[s.severity] || 0) + 1; return acc; }, {});
    function csv() {
      const h = ["Timestamp","Name","Email","Score","Severity","Prescription","Gateway","Dopamine","Attention","Emotional","Environment","Values","Drain","Tolerance","Withdrawal","Balance","Honesty","Living","Work","LostActivity"];
      const rows = subs.map(s => [s.timestamp, s.name, s.email, s.total, s.severity, `"${s.prescription}"`, `"${(s.gatewayWhy||"").replace(/"/g,'""')}"`, s.dimensions.dopamine, s.dimensions.attention, s.dimensions.emotional, s.dimensions.environment, s.dimensions.values, s.dimensions.drain, s.lembke.tolerance, s.lembke.withdrawal, s.lembke.balance, s.lembke.honesty, `"${s.context?.living||""}"`, `"${s.context?.work||""}"`, `"${s.context?.lostActivity||""}"`].join(","));
      const blob = new Blob([[h.join(","), ...rows].join("\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `noorah-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    }
    return (<div style={{ ...S.page, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><div style={{ fontSize: 11, color: S.gold, letterSpacing: 2 }}>NOORAH ADMIN</div><h1 style={{ ...S.h1, fontSize: 24, margin: 0 }}>Submissions</h1></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={async () => setSubs(await loadSubmissions())} style={{ padding: "8px 14px", fontSize: 12, background: "transparent", border: "0.5px solid #ddd", borderRadius: 6, cursor: "pointer" }}>Refresh</button>
          <button onClick={csv} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 500, background: S.gold, color: S.night, border: "none", borderRadius: 6, cursor: "pointer" }}>Export CSV</button>
          <button onClick={() => setMode("start")} style={{ padding: "8px 14px", fontSize: 12, background: "transparent", border: "0.5px solid #ddd", borderRadius: 6, cursor: "pointer" }}>Exit</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 20 }}>
        <div style={{ padding: "14px 16px", background: S.bg2, borderRadius: 10 }}><div style={{ fontSize: 11, color: S.sub }}>Total</div><div style={{ ...S.h1, fontSize: 28, color: S.gold }}>{subs.length}</div></div>
        <div style={{ padding: "14px 16px", background: S.bg2, borderRadius: 10 }}><div style={{ fontSize: 11, color: S.sub }}>Avg Score</div><div style={{ ...S.h1, fontSize: 28 }}>{avg}</div></div>
        {Object.entries(sevC).map(([k, v]) => <div key={k} style={{ padding: "14px 16px", background: S.bg2, borderRadius: 10 }}><div style={{ fontSize: 11, color: S.sub }}>{k}</div><div style={{ ...S.h1, fontSize: 28 }}>{v}</div></div>)}
      </div>
      {subs.length === 0 ? <div style={{ padding: 60, textAlign: "center", background: S.bg2, borderRadius: 12 }}><p style={{ color: S.sub }}>No submissions yet.</p></div> :
        subs.map(s => { const sv = getSeverity(s.total); return (
          <details key={s.id || s.timestamp} style={{ marginBottom: 8, border: "0.5px solid #ddd", borderRadius: 10, padding: "12px 16px" }}>
            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, listStyle: "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: sv.bg, color: sv.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{s.total}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{s.name} <span style={{ color: S.sub, fontSize: 12, fontWeight: 400 }}>{s.email && `\u2014 ${s.email}`}</span></div>
              <div style={{ fontSize: 11, color: S.sub }}>{new Date(s.timestamp).toLocaleString()} \u00b7 {s.severity} \u00b7 {s.prescription}</div></div>
            </summary>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #eee" }}>
              <div style={{ fontSize: 12, color: S.sub, marginBottom: 4 }}>Why they came:</div>
              <div style={{ fontSize: 13, fontStyle: "italic", marginBottom: 12 }}>\u201C{s.gatewayWhy}\u201D</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6, marginBottom: 12 }}>
                {Object.entries(s.dimensions || {}).map(([d, v]) => <div key={d} style={{ fontSize: 11 }}><div style={{ color: S.sub }}>{DIM[d]?.name?.split(" ")[0]}</div><div style={{ fontWeight: 500, color: DIM[d]?.color }}>{v}/{DIM[d]?.weight}</div></div>)}
              </div>
              <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: S.sub }}>Lembke: </span>Tol {s.lembke?.tolerance} \u00b7 Wd {s.lembke?.withdrawal} \u00b7 Bal {s.lembke?.balance} \u00b7 Hon {s.lembke?.honesty}</div>
              <div style={{ fontSize: 12, color: S.sub, marginTop: 12, marginBottom: 6 }}>Plan:</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", background: S.bg2, padding: "12px 14px", borderRadius: 6 }}>{s.plan}</div>
            </div>
          </details>
        ); })
      }
    </div>);
  }

  // ===== START =====
  if (mode === "start") {
    return (<div style={S.page}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Icon size={52} />
        <h1 style={{ ...S.h1, fontSize: 32, margin: "12px 0 4px", letterSpacing: -0.5 }}>The Noorah Score</h1>
        <p style={{ fontSize: 14, color: S.sub, fontStyle: "italic" }}>The light before your screen.</p>
        <p style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginTop: 12 }}>BETA \u00b7 TESTER PROTOTYPE</p>
      </div>
      <div style={{ background: S.bg2, borderRadius: 12, padding: "18px 22px", marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>This assessment measures your digital health across 6 scientific dimensions. Based on YOUR specific answers, it prescribes a personalized digital fasting protocol. No two plans are alike.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ n: "16\u201322", l: "Questions" }, { n: "6", l: "Dimensions" }, { n: "4 min", l: "To complete" }].map((s, i) => (
          <div key={i} style={{ background: S.bg2, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ ...S.h1, fontSize: 20, color: S.gold }}>{s.n}</div><div style={{ fontSize: 11, color: S.sub }}>{s.l}</div></div>
        ))}
      </div>
      <button onClick={() => setMode("intake")} style={{ ...S.btn, marginBottom: 8 }}>Begin assessment</button>
      <button onClick={() => setMode("adminLogin")} style={S.ghost}>Admin access</button>
    </div>);
  }

  // ===== INTAKE =====
  if (mode === "intake") {
    return (<div style={{ ...S.page, maxWidth: 480 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 4 }}>BEFORE WE BEGIN</p>
        <h2 style={{ ...S.h1, fontSize: 22, margin: "0 0 6px" }}>Let\u2019s keep in touch</h2>
        <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: 0 }}>So we can follow up on your experience.</p>
      </div>
      <label style={S.label}>Your name</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="First name" style={S.input} />
      <label style={S.label}>Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={S.input} />
      <button onClick={() => { setMode("quiz"); setStep(0); }} disabled={!name || !email}
        style={{ ...S.btn, opacity: (name && email) ? 1 : 0.4, cursor: (name && email) ? "pointer" : "not-allowed" }}>Continue to assessment</button>
    </div>);
  }

  // ===== QUIZ =====
  if (mode === "quiz") {
    const gC = GATEWAY.length, sC = SCREENING.length;
    let cq = null, phase = "", plabel = "", akey = "";

    if (step < gC) { cq = GATEWAY[step]; phase = "gateway"; plabel = "About you"; akey = `gateway_${cq.id}`; }
    else if (step < gC + sC) { const si = step - gC; cq = SCREENING[si]; phase = "screening"; plabel = DIM[cq.dim].name; akey = `screen_${cq.dim}`; }
    else {
      const pi = step - gC - sC;
      if (quizPath.length === 0) return <div style={{ textAlign: "center", padding: 40, fontFamily: "'DM Sans', sans-serif" }}>Personalizing your assessment\u2026</div>;
      if (pi >= quizPath.length) return (
        <div style={{ ...S.page, textAlign: "center", paddingTop: "4rem" }}>
          <Icon size={36} /><h2 style={{ ...S.h1, fontSize: 22, margin: "12px 0 6px" }}>Generating your plan\u2026</h2>
          <div style={{ width: 24, height: 24, border: "2px solid rgba(212,164,76,0.2)", borderTop: "2px solid #D4A44C", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "20px auto" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
      const item = quizPath[pi];
      if (item.type === "deep") { cq = DEEP_DIVE[item.dim][item.qIndex]; phase = "deep"; plabel = DIM[item.dim].name; akey = `deep_${item.dim}_${item.qIndex}`; }
      else { cq = CONTEXT[item.cIndex]; phase = "context"; plabel = "Your life"; akey = `context_${cq.id}`; }
    }

    const tot = gC + sC + (quizPath.length || 15);
    const pct = Math.round((step / tot) * 100);

    function ans(o) {
      const na = { ...answers };
      if (phase === "gateway") na[akey] = o;
      else if (phase === "screening" || phase === "deep") na[akey] = o.s;
      else na[akey] = o;
      setAnswers(na); setStep(step + 1);
    }

    return (<div style={S.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          style={{ width: 32, height: 32, borderRadius: 8, border: "0.5px solid #ddd", background: "transparent", cursor: step > 0 ? "pointer" : "default", opacity: step > 0 ? 1 : 0.3, fontSize: 16, color: "#888" }}>\u2190</button>
        <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: S.gold, transition: "width 0.4s" }} /></div>
        <span style={{ fontSize: 11, color: S.sub, minWidth: 40, textAlign: "right" }}>{step + 1}/{tot}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: S.gold, letterSpacing: 2, textTransform: "uppercase" }}>{phase}</div>
        <div style={{ fontSize: 11, color: "#ccc" }}>\u00b7</div>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{plabel}</div>
        {cq.lembke && <div style={{ fontSize: 10, color: "#7B6DB5", padding: "2px 8px", background: "#EEEDFE", borderRadius: 4 }}>Lembke: {cq.lembke}</div>}
      </div>
      <p style={{ ...S.h1, fontSize: 20, lineHeight: 1.4, margin: "0 0 18px" }}>{cq.q}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cq.opts.map((o, i) => (
          <button key={i} onClick={() => ans(o)}
            style={{ padding: "14px 16px", fontSize: 14, lineHeight: 1.5, textAlign: "left", color: S.txt, background: "#fff", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = S.gold; e.currentTarget.style.background = "rgba(212,164,76,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.background = "#fff"; }}>
            {o.t}
          </button>
        ))}
      </div>
    </div>);
  }

  // ===== RESULTS =====
  if (mode === "results" && results) {
    const sev = getSeverity(results.total);
    const sorted = Object.keys(results.dimensions).sort((a, b) => results.dimensions[b] - results.dimensions[a]);

    return (<div style={S.page}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Icon size={36} />
        <div style={{ fontSize: 11, fontWeight: 500, color: S.gold, letterSpacing: 2, margin: "10px 0 4px" }}>YOUR NOORAH SCORE</div>
        <div style={{ position: "relative", width: 140, height: 140, margin: "12px auto" }}>
          <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, transform: "rotate(-90deg)" }}>
            <circle cx="70" cy="70" r="60" fill="none" stroke="#eee" strokeWidth="6" />
            <circle cx="70" cy="70" r="60" fill="none" stroke={sev.color} strokeWidth="6" strokeDasharray={`${(results.total / 100) * 377} 377`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
            <div style={{ ...S.h1, fontSize: 38, color: sev.color }}>{results.total}</div>
            <div style={{ fontSize: 11, color: S.sub }}>of 100</div>
          </div>
        </div>
        <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, background: sev.bg, color: sev.color }}>{sev.label}</div>
      </div>

      <div style={{ background: S.night, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 6 }}>YOUR PRESCRIBED DIGITAL FAST</div>
        <div style={{ ...S.h1, fontSize: 22, color: "#F5E6C8", marginBottom: 4 }}>{sev.level}</div>
        <div style={{ fontSize: 13, color: S.gold, marginBottom: 10 }}>{sev.days}</div>
        <div style={{ fontSize: 13, color: "rgba(245,230,200,0.7)", lineHeight: 1.6 }}>{sev.desc}</div>
      </div>

      {plan && <div style={{ background: S.bg2, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 12 }}>\u25cf YOUR PERSONALIZED PLAN</div>
        <div style={{ ...S.h1, fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{plan}</div>
      </div>}

      {/* 14-DAY FASTING SCHEDULE */}
      {results && (() => {
        const fastDays = results.total <= 25
          ? [{ d: "Day 1\u20133", title: "Notification Fast", desc: "Turn off all non-essential notifications. Keep calls and family messages only. Observe your reach-for-phone reflex.", level: 1 }]
          : results.total <= 45
          ? [
              { d: "Day 1\u20132", title: "Notification Fast", desc: "Turn off all non-essential notifications across every device. Notice how often your hand reaches for the phone.", level: 1 },
              { d: "Day 3\u20135", title: "App Fast", desc: "Remove social media and news apps from your phone. Access only via laptop browser at one scheduled time per day.", level: 2 },
              { d: "Day 6\u20137", title: "Integration", desc: "Review what you learned. Which apps did you miss? Which didn\u2019t you? Begin drafting your Digital Constitution.", level: 0 },
            ]
          : results.total <= 65
          ? [
              { d: "Day 1", title: "Notification Fast", desc: "Turn off ALL notifications except phone calls and family DMs. Removes 70\u201380% of daily interruptions.", level: 1 },
              { d: "Day 2\u20134", title: "App Fast", desc: "Remove social media, news, and shopping apps from your phone. Access only via browser on laptop at set times.", level: 2 },
              { d: "Day 5\u20137", title: "Time-Box Fast", desc: "All digital consumption in 3 pre-set windows per day. Outside windows, phone goes in a drawer.", level: 3 },
              { d: "Day 8\u201310", title: "Deep Time-Box", desc: "Reduce to 2 digital windows. Add 45-minute focus blocks with zero interruptions. Journal each evening.", level: 3 },
              { d: "Day 11\u201312", title: "Quiet Period", desc: "48 hours of near-total digital abstinence. Only essential calls. No email, no news, no streaming.", level: 4 },
              { d: "Day 13\u201314", title: "Reintroduction", desc: "Add back ONE tool at a time with written rules. Does this serve my values? Is this the best way?", level: 0 },
            ]
          : [
              { d: "Day 1", title: "Notification Fast", desc: "Kill ALL notifications. Only family calls get through. Remove phone from bedroom tonight.", level: 1 },
              { d: "Day 2\u20133", title: "App Fast", desc: "Delete social media, news, shopping, and entertainment apps. Not log out \u2014 delete. Access only via laptop at one window per day.", level: 2 },
              { d: "Day 4\u20136", title: "Time-Box Fast", desc: "All digital use in 3 daily windows (max 30 min each). Between windows, phone in another room. Start your Dopamine Menu.", level: 3 },
              { d: "Day 7\u20138", title: "Meeting + Channel Fast", desc: "Cancel 50% of meetings. Mute all but top 3 Slack channels. Single-tab browser policy. Rebuild sustained attention.", level: 3 },
              { d: "Day 9\u201310", title: "Deep Time-Box", desc: "Reduce to 2 digital windows. 60-minute phone-free focus blocks. Journal each evening: what felt different?", level: 3 },
              { d: "Day 11\u201313", title: "The Quiet Period", desc: "72 hours of near-total digital abstinence. Only essential communication. This is the dopamine reset. Day 13: the calm arrives.", level: 4 },
              { d: "Day 14", title: "Reintroduction Day", desc: "Re-take your Noorah Score. Compare before and after. Write your Digital Constitution \u2014 handwritten rules for every tool.", level: 0 },
            ];

        const lc = { 0: "#185FA5", 1: "#0F6E56", 2: "#BA7517", 3: "#D85A30", 4: "#A32D2D" };
        const ln = { 0: "Reset", 1: "Level 1", 2: "Level 2", 3: "Level 3", 4: "Level 4" };

        return (
          <div style={{ borderRadius: 12, border: "1px solid #ddd", padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 4 }}>YOUR 14-DAY DIGITAL FAST</div>
            <div style={{ ...S.h1, fontSize: 18, marginBottom: 4 }}>Day-by-day schedule</div>
            <div style={{ fontSize: 13, color: S.sub, marginBottom: 16, lineHeight: 1.5 }}>
              Prescribed for your Noorah Score of {results.total}. {results.total >= 46 ? "Follow each phase in order." : "A lighter protocol \u2014 focus on awareness and small wins."}
            </div>
            {fastDays.map((day, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                <div style={{ width: 44, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: lc[day.level] + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: lc[day.level] }}>{ln[day.level]}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: S.gold }}>{day.d}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{day.title}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: 0 }}>{day.desc}</p>
                </div>
              </div>
            ))}
            {results.total >= 46 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#FDF6E9", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#BA7517", lineHeight: 1.6 }}>
                  <strong>The withdrawal arc:</strong> Days 1\u20133 restlessness. Days 4\u20137 boredom and irritability peak. Days 8\u201310 the calm arrives. Days 11\u201314 is the transformation \u2014 clarity, better sleep, deeper focus.
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Dimension breakdown</div>
        {sorted.map(d => {
          const pct = Math.round((results.dimensions[d] / DIM[d].weight) * 100);
          return (<div key={d} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{DIM[d].name}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: DIM[d].color }}>{results.dimensions[d]}/{DIM[d].weight}</span>
            </div>
            <div style={{ height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: DIM[d].color, transition: "width 0.8s" }} />
            </div>
          </div>);
        })}
      </div>

      <div style={{ background: "#EEEDFE", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#7B6DB5", letterSpacing: 1.5, marginBottom: 6 }}>LEMBKE ADDICTION MARKERS</div>
        <div style={{ fontSize: 12, color: "#3C3489", lineHeight: 1.8 }}>Tolerance: {results.lembke.tolerance}/3 \u00b7 Withdrawal: {results.lembke.withdrawal}/3 \u00b7 Pleasure-pain: {results.lembke.balance}/3 \u00b7 Honesty: {results.lembke.honesty}/3</div>
      </div>

      <div style={{ textAlign: "center", padding: "14px", background: "#E1F5EE", borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#085041" }}>\u2713 Your results have been saved</div>
      </div>

      <button onClick={reset} style={S.ghost}>Done</button>
    </div>);
  }

  return null;
}
