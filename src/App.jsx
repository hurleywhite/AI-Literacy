import { useState, useEffect, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { supabase } from "./supabaseClient";

const B = {
  navy: "#0B1D3A", deep: "#0F2440", accent: "#3AAFDB", dim: "#2A8FB8",
  frost: "#C5E4EF", white: "#FFFFFF", gray: "#7B8FA3", green: "#34C38F",
  amber: "#F4B740", red: "#E55C5C",
};
const ROLES = [
  { id: "knowledge", label: "Knowledge Worker", desc: "Analyst, specialist, IC" },
  { id: "manager", label: "People Manager", desc: "Team lead, director" },
  { id: "hr", label: "HR / People Ops", desc: "Talent, L&D, workforce" },
  { id: "finance", label: "Finance", desc: "FP&A, accounting, audit" },
  { id: "it_product", label: "IT / Product", desc: "Eng, PM, IT ops" },
];
const DIMS = [
  { id: "foundations", label: "AI Foundations", short: "Foundations", color: "#3AAFDB" },
  { id: "proficiency", label: "Tool Proficiency", short: "Proficiency", color: "#34C38F" },
  { id: "judgment", label: "Critical Judgment", short: "Judgment", color: "#F4B740" },
  { id: "workflow", label: "Workflow Integration", short: "Workflow", color: "#9B59B6" },
  { id: "mindset", label: "Mindset & Experimentation", short: "Mindset", color: "#E67E22" },
];
const LEVELS = [
  { min: 0, max: 35, label: "Unaware", grade: "Level 1", color: B.red },
  { min: 36, max: 52, label: "Aware", grade: "Level 2", color: B.amber },
  { min: 53, max: 72, label: "Capable", grade: "Level 3", color: B.accent },
  { min: 73, max: 88, label: "Proficient", grade: "Level 4", color: B.green },
  { min: 89, max: 100, label: "Advanced", grade: "Level 5", color: B.green },
];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const SKEY = "arcticmind-v3";
async function storageSave(d) { try { if (window.storage) await window.storage.set(SKEY, JSON.stringify(d)); } catch(e) {} }
async function storageLoad() { try { if (window.storage) { const r = await window.storage.get(SKEY); if (r && r.value) return JSON.parse(r.value); } } catch(e) {} return null; }
async function storageClear() { try { if (window.storage) await window.storage.delete(SKEY); } catch(e) {} }
const QUESTIONS = [
  { type:"scenario", dim:"foundations", text:"Your CEO emails everyone: \"Every team should be using AI by end of quarter.\" No further guidance. What do you do?", options:[{text:"Start experimenting — the mandate gives you cover",score:3},{text:"Wait for your manager to clarify",score:1},{text:"Ask the CEO what \"using AI\" means specifically",score:4},{text:"Forward to IT and ask them to recommend tools",score:2}]},
  { type:"spotlight", dim:"foundations", text:"A vendor sent this pitch. Tap every claim that should give you pause:", passage:[{text:"Our platform uses state-of-the-art deep learning",flag:false},{text:"trained on the largest proprietary dataset in the industry.",flag:true,reason:"\"Largest\" by what metric? Unverifiable."},{text:"It achieves 99.7% accuracy across all business applications",flag:true,reason:"No model hits 99.7% on ALL tasks."},{text:"and is trusted by 200+ enterprises.",flag:false},{text:"Your data is processed in real-time and never stored.",flag:true,reason:"How is it processed if never stored?"},{text:"Our models continuously learn from your usage,",flag:true,reason:"Who owns the improvements? IP/privacy question."},{text:"delivering personalized results.",flag:false}]},
  { type:"rapid", dim:"foundations", text:"Quick takes — agree or disagree:", statements:[{text:"Most companies would benefit from slowing their AI adoption",correct:"agree",explanation:"Thoughtful > fast. Speed without governance creates risk."},{text:"A small team using AI well matters more than an AI strategy doc",correct:"agree",explanation:"Proof points > plans."},{text:"AI governance is mostly about preventing employee mistakes",correct:"disagree",explanation:"It's about enabling smart use, not just blocking misuse."},{text:"If you're not using AI today, you're falling behind",correct:"disagree",explanation:"Depends on the job. Not every role benefits from AI yet."}]},
  { type:"slider", dim:"foundations", text:"Where do you honestly fall?", left:"Most AI hype is overblown — real impact on most jobs will be modest", right:"AI is genuinely transformative — most roles will fundamentally change within 3-5 years"},
  { type:"scenario", dim:"foundations", text:"A colleague is worried AI will replace their job. They ask your honest take.", options:[{text:"Parts of your job will change but you'll still be needed",score:3},{text:"I'd start learning AI tools now just in case",score:3},{text:"AI isn't as capable as media makes it sound — you'll be fine",score:1},{text:"Nobody knows for sure, but understanding what AI can and can't do in your domain is the key",score:4}]},
  { type:"scenario", dim:"proficiency", text:"Need a 40-page report summarized by EOD. AI: 30 min. Manual: 3 hours. Important client.", options:[{text:"Use AI and review carefully — 30 minutes is 30 minutes",score:4},{text:"Write it yourself — stakes are too high",score:3},{text:"AI first draft, then an hour rewriting key sections",score:3},{text:"Use AI and send quick — client wants speed",score:1}]},
  { type:"spotlight", dim:"proficiency", text:"You asked AI to draft a project status update. Tap what needs editing:", passage:[{text:"Migration is on track for March 15.",flag:false},{text:"Team morale is high and engineering is fully aligned.",flag:true,reason:"AI guessing about morale — you'd need to know this."},{text:"We resolved the database latency issue.",flag:false},{text:"Based on velocity, we have capacity for Phase 2 in April.",flag:true,reason:"AI making capacity commitments on your behalf."},{text:"QA completes Friday.",flag:false},{text:"No blockers at this time.",flag:true,reason:"AI can't know your blockers."}]},
  { type:"rank", dim:"proficiency", text:"Your prompt isn't working. Rank fixes from \"try first\" to \"try last\":", items:[{id:"a",text:"Add a specific example of good output",ideal:1},{id:"b",text:"Break the task into smaller steps",ideal:2},{id:"c",text:"Give more background context",ideal:3},{id:"d",text:"Try a different AI tool",ideal:4},{id:"e",text:"Ask the AI to explain its reasoning first",ideal:5}]},
  { type:"scenario", dim:"proficiency", text:"Used ChatGPT for 6 months. Colleague says Claude is better for your work. How much time to evaluate?", options:[{text:"An afternoon — run 3 common tasks through both",score:4},{text:"None — I'm productive with what I have",score:3},{text:"A full week of parallel usage",score:2},{text:"Switch if someone I trust vouches for it",score:1}]},
  { type:"rapid", dim:"proficiency", text:"Quick takes on AI tools:", statements:[{text:"Better to master one tool deeply than use many superficially",correct:"agree",explanation:"Depth beats breadth for productivity."},{text:"If 3 prompts don't work, the tool probably can't do it",correct:"disagree",explanation:"Complex tasks often need 5-10 iterations."},{text:"AI brainstorming is a waste — just gives generic ideas",correct:"disagree",explanation:"AI brainstorming + your curation = faster ideation."},{text:"Prompt quality matters more than which model you use",correct:"agree",explanation:"For most business tasks, prompt > model."}]},
  { type:"scenario", dim:"judgment", text:"Intern used AI for competitor research in a client deck. Looks solid but unverified. Presentation in 2 hours.", options:[{text:"Spot-check the 3-4 most important claims",score:4},{text:"Cut the section — unverifiable analysis isn't worth the risk",score:3},{text:"Keep it — looks reasonable and we're short on time",score:1},{text:"Ask intern to add sources for every claim",score:2}]},
  { type:"slider", dim:"judgment", text:"Colleague pasted sensitive customer data into ChatGPT. The analysis was useful. How do you handle it?", left:"Focus on the policy violation — can't happen again regardless of results", right:"Focus on the insight — find a compliant way to replicate this"},
  { type:"spotlight", dim:"judgment", text:"AI drafted a client email. Tap what to change before sending:", passage:[{text:"Hi Sarah, great speaking last week.",flag:false},{text:"I reviewed your supply chain challenges",flag:false},{text:"and I believe we can reduce costs by 30-40%.",flag:true,reason:"ROI promise you can't guarantee."},{text:"Our platform integrates seamlessly with SAP,",flag:true,reason:"\"Seamlessly\" is almost never true."},{text:"and deploys in under 6 weeks.",flag:false},{text:"I'd love to connect with your VP of Ops, Mark Chen.",flag:true,reason:"Did Sarah mention Mark? Possible hallucination."}]},
  { type:"scenario", dim:"judgment", text:"AI policy says \"no AI for customer content.\" But your internal AI analysis keeps getting forwarded to customers by sales.", options:[{text:"Flag it — policy has a gap",score:4},{text:"Stop using AI for anything that could reach customers",score:3},{text:"Not your problem — you followed the policy",score:1},{text:"Add disclaimers noting AI assistance",score:3}]},
  { type:"rapid", dim:"judgment", text:"Quick judgment calls:", statements:[{text:"AI report with one error should be fully discarded",correct:"disagree",explanation:"Fix the error, verify the rest."},{text:"OK to use AI for tasks your boss thinks you did manually",correct:"disagree",explanation:"Hidden AI use erodes trust when discovered."},{text:"Compliance team banning all AI is prudent",correct:"disagree",explanation:"Blanket bans drive Shadow AI."},{text:"Sometimes the right call is to skip AI even when faster",correct:"agree",explanation:"Speed isn't the only variable."}]},
  { type:"rank", dim:"workflow", text:"Starting AI in your team's workflow. Rank these steps:", items:[{id:"a",text:"Pick one low-stakes task to test",ideal:1},{id:"b",text:"Define what good output looks like first",ideal:2},{id:"c",text:"Run through AI and compare to manual",ideal:3},{id:"d",text:"Document what worked and share",ideal:4},{id:"e",text:"Build into recurring workflow with review",ideal:5}]},
  { type:"scenario", dim:"workflow", text:"AI saves 10 hrs/week on reports. But only you know how the workflow works.", options:[{text:"Document it so anyone can run it",score:4},{text:"Train one person as backup",score:3},{text:"Keep running it — not broken",score:1},{text:"Automate further so nobody needs to understand it",score:2}]},
  { type:"scenario", dim:"workflow", text:"Automated a weekly report with AI. Manager says it \"feels different\" but data is accurate.", options:[{text:"Ask what feels off, adjust the prompt",score:4},{text:"Go back to manual — perception matters",score:3},{text:"Explain it's AI and the data checks out",score:2},{text:"Ignore it — accuracy is what matters",score:1}]},
  { type:"slider", dim:"workflow", text:"How much of your recurring work could benefit from AI right now?", left:"Almost none — too much judgment or context needed", right:"Most of it — I see AI applications everywhere"},
  { type:"rapid", dim:"workflow", text:"Quick takes on AI workflows:", statements:[{text:"80% as good but 10x faster is usually worth adopting",correct:"agree",explanation:"With human review, the math works."},{text:"Automate your most time-consuming task first",correct:"disagree",explanation:"Start easiest to verify."},{text:"AI works best replacing entire tasks",correct:"disagree",explanation:"Best as collaborator on subtasks."},{text:"If a workflow needs constant oversight, it's not saving time",correct:"disagree",explanation:"Oversight + AI is still faster."}]},
  { type:"scenario", dim:"mindset", text:"Optional AI training day. You're busy. What do you actually do?", options:[{text:"Skip — learn better on my own",score:2},{text:"Go if it's hands-on, not lecture-based",score:4},{text:"Go to everything — any AI learning helps",score:3},{text:"Send a junior — they'll benefit more",score:2}]},
  { type:"scenario", dim:"mindset", text:"AI experiment failed — terrible output, 45 min wasted. Next move?", options:[{text:"Note what went wrong, try differently tomorrow",score:4},{text:"Cross this off the AI list",score:2},{text:"Keep trying now with different prompts",score:3},{text:"Ask a colleague better with AI to try",score:3}]},
  { type:"slider", dim:"mindset", text:"When you hear about a new AI capability:", left:"I want to understand its limits before trying it", right:"I want to try it immediately and discover the limits myself"},
  { type:"rank", dim:"mindset", text:"What changes someone's mind about AI? Rank most to least effective:", items:[{id:"a",text:"Seeing a colleague solve a real problem with it",ideal:1},{id:"b",text:"Trying it yourself on your own work",ideal:2},{id:"c",text:"A manager encouraging experimentation",ideal:3},{id:"d",text:"Reading case studies",ideal:4},{id:"e",text:"Attending a workshop",ideal:5}]},
  { type:"scenario", dim:"mindset", text:"Half your team excited, half resistant. You make the call.", options:[{text:"Pilot with both camps. Skeptics evaluate. Decide on data",score:4},{text:"Mandate it — resistance holds us back",score:1},{text:"Make it optional per person",score:2},{text:"One low-stakes process everyone tries. Build evidence",score:4}]},
];
export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [role, setRole] = useState(null);
  const [orgName, setOrgName] = useState("");
  const [cQ, setCQ] = useState(0);
  const [ans, setAns] = useState({});
  const [locked, setLocked] = useState(false);
  const [pQs, setPQs] = useState([]);
  const [fade, setFade] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const pendingRef = useRef(null);
  const [spotSel, setSpotSel] = useState({});
  const [sliderV, setSliderV] = useState(50);
  const [rankOrd, setRankOrd] = useState([]);
  const [rapAns, setRapAns] = useState({});
  const [selIdx, setSelIdx] = useState(null);
  const [showFB, setShowFB] = useState(false);
  const hasSaved = useRef(false);

  // Load saved progress on mount
  useEffect(() => {
    storageLoad().then(s => {
      if (s && s.screen === "assessment" && s.cQ < QUESTIONS.length) {
        setRole(s.role); setOrgName(s.orgName || ""); setCQ(s.cQ);
        setAns(s.ans || {}); setPQs(s.pQs || []); setScreen("resume");
      }
    });
  }, []);

  // Save assessment results to Supabase when reaching results screen
  useEffect(() => {
    if (screen !== "results" || hasSaved.current) return;
    hasSaved.current = true;

    async function saveResults() {
      try {
        if (!supabase) return;
        const scores = getScores();
        const ov = getOv();
        const lv = getLv(ov);

        await supabase
          .from("assessment_results")
          .insert({
            organization_name: orgName || null,
            role: role,
            overall_score: ov,
            overall_level: lv.label,
            foundations_score: scores.foundations,
            proficiency_score: scores.proficiency,
            judgment_score: scores.judgment,
            workflow_score: scores.workflow,
            mindset_score: scores.mindset,
            answers: ans,
            user_agent: navigator.userAgent,
          });
      } catch (err) {
        console.error("Failed to save assessment:", err);
      }
    }

    saveResults();
  }, [screen]);

  function prep() { return QUESTIONS.map(q => q.type === "scenario" ? {...q, options: shuffle(q.options)} : q.type === "rank" ? {...q, items: shuffle(q.items)} : {...q}); }
  function startFresh() { const qs = prep(); setPQs(qs); setCQ(0); setAns({}); setScreen("assessment"); storageSave({screen:"assessment",role,orgName,cQ:0,ans:{},pQs:qs}); }
  function resetI() { setSpotSel({}); setSliderV(50); setRankOrd([]); setRapAns({}); setSelIdx(null); setShowFB(false); setWaiting(false); pendingRef.current = null; }
  function advance(dim, score) {
    const na = {...ans, [cQ]: {dim, score}}; setAns(na);
    if (cQ < QUESTIONS.length - 1) {
      setFade(false); const nq = cQ + 1;
      setTimeout(() => { setCQ(nq); resetI(); setLocked(false); setFade(true); storageSave({screen:"assessment",role,orgName,cQ:nq,ans:na,pQs}); }, 200);
    } else { storageClear(); setScreen("results"); }
  }
  function waitContinue(dim, score) { setWaiting(true); pendingRef.current = {dim, score}; }
  function doContinue() { if (pendingRef.current) advance(pendingRef.current.dim, pendingRef.current.score); }
  function handleScen(i, score) { if (locked) return; setLocked(true); setSelIdx(i); setTimeout(() => advance(pQs[cQ].dim, score), 400); }
  function togSpot(i) { if (!showFB) setSpotSel(p => ({...p, [i]: !p[i]})); }
  function subSpot() {
    setShowFB(true); const q = pQs[cQ]; const fl = q.passage.filter(s => s.flag);
    const h = fl.filter(f => spotSel[q.passage.indexOf(f)]).length;
    const ff = Object.keys(spotSel).filter(k => spotSel[k] && !q.passage[k].flag).length;
    const a = fl.length > 0 ? (h - ff * 0.5) / fl.length : 0;
    waitContinue(q.dim, a >= 0.9 ? 4 : a >= 0.6 ? 3 : a >= 0.3 ? 2 : 1);
  }
  function subSlider() { if (locked) return; setLocked(true); const v = sliderV; const sc = v >= 50 && v <= 75 ? 4 : v >= 35 && v <= 85 ? 3 : v >= 20 ? 2 : 1; setTimeout(() => advance(pQs[cQ].dim, sc), 300); }
  function moveR(f, t) { if (locked) return; const o = [...rankOrd]; const [it] = o.splice(f, 1); o.splice(t, 0, it); setRankOrd(o); }
  function subRank() {
    if (locked) return; setLocked(true); let d = 0;
    rankOrd.forEach((it, i) => { d += Math.abs((i+1) - it.ideal); });
    const mx = rankOrd.length * (rankOrd.length - 1) / 2; const n = 1 - (d / (mx * 2));
    setTimeout(() => advance(pQs[cQ].dim, n >= 0.85 ? 4 : n >= 0.6 ? 3 : n >= 0.35 ? 2 : 1), 300);
  }
  function handleRap(i, a) {
    if (showFB) return;
    const current = rapAns[i];
    let na;
    if (current === a) {
      // Clicking same answer deselects it
      na = {...rapAns};
      delete na[i];
    } else {
      na = {...rapAns, [i]: a};
    }
    setRapAns(na);
    const q = pQs[cQ];
    if (Object.keys(na).length === q.statements.length) {
      setShowFB(true);
      let c = 0;
      q.statements.forEach((s, j) => { if (na[j] === s.correct) c++; });
      waitContinue(q.dim, c === q.statements.length ? 4 : c >= 3 ? 3 : c >= 2 ? 2 : 1);
    }
  }
  useEffect(() => { if (pQs.length > 0 && pQs[cQ]?.type === "rank") setRankOrd([...pQs[cQ].items]); }, [cQ, pQs]);
  function getScores() {
    const sc = {}; DIMS.forEach(d => { sc[d.id] = {t:0, c:0}; });
    Object.values(ans).forEach(a => { if (sc[a.dim]) { sc[a.dim].t += a.score; sc[a.dim].c += 1; } });
    const r = {}; DIMS.forEach(d => { const s = sc[d.id]; r[d.id] = s.c > 0 ? Math.round((s.t / (s.c * 4)) * 100) : 0; }); return r;
  }
  function getOv() { const s = getScores(); const v = Object.values(s); return Math.round(v.reduce((a,b) => a+b, 0) / v.length); }
  function getLv(n) { return LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0]; }
  function fullReset() { storageClear(); setScreen("welcome"); setCQ(0); setAns({}); setRole(null); setOrgName(""); setLocked(false); setPQs([]); resetI(); hasSaved.current = false; }
  const total = QUESTIONS.length;
  const progress = total > 0 ? ((cQ + 1) / total) * 100 : 0;
  const btnP = { padding:"10px 28px", borderRadius:8, border:"none", fontSize:13, fontWeight:600, background:`linear-gradient(135deg,${B.accent},${B.dim})`, color:B.white, cursor:"pointer" };
  const btnO = { padding:"10px 28px", borderRadius:8, border:`1px solid ${B.accent}`, background:"transparent", color:B.accent, fontSize:13, fontWeight:600, cursor:"pointer" };
  // ===== RESUME =====
  if (screen === "resume") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${B.navy},${B.deep})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",padding:20}}>
      <div style={{maxWidth:400,textAlign:"center"}}>
        <h2 style={{fontSize:20,fontWeight:700,color:B.white,marginBottom:6}}>Welcome back</h2>
        <p style={{fontSize:13,color:B.frost,opacity:0.65,marginBottom:20}}>Question {cQ+1} of {total}</p>
        <button onClick={() => setScreen("assessment")} style={{...btnP,marginRight:8}}>Continue</button>
        <button onClick={fullReset} style={btnO}>Start Over</button>
      </div>
    </div>
  );
  // ===== WELCOME =====
  if (screen === "welcome") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${B.navy},${B.deep},#1a3a6a)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",padding:20}}>
      <div style={{maxWidth:520,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${B.accent},${B.frost})`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:14,fontWeight:800,color:B.navy}}>A</span></div>
            <span style={{fontSize:14,fontWeight:700,color:B.frost,letterSpacing:2,textTransform:"uppercase"}}>ArcticMind</span>
          </div>
          <h1 style={{fontSize:26,fontWeight:800,color:B.white,margin:"0 0 6px"}}>AI Readiness Assessment</h1>
          <p style={{fontSize:12,color:B.frost,opacity:0.6,lineHeight:1.6}}>25 interactive challenges. Scenarios, spotlights, rankings, and rapid-fire.<br/>Progress saves automatically. ~12 minutes.</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:11,padding:"18px 16px",marginBottom:14,border:"1px solid rgba(255,255,255,0.07)"}}>
          <label style={{display:"block",fontSize:10,fontWeight:600,color:B.frost,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Organization (optional)</label>
          <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Acme Corp" autoComplete="organization" style={{width:"100%",padding:"9px 12px",borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:B.white,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:12}}/>
          <label style={{display:"block",fontSize:10,fontWeight:600,color:B.frost,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Select your role</label>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {ROLES.map(r => <button key={r.id} onClick={() => setRole(r.id)} style={{padding:"9px 12px",borderRadius:6,cursor:"pointer",textAlign:"left",border:role===r.id?`2px solid ${B.accent}`:"1px solid rgba(255,255,255,0.06)",background:role===r.id?"rgba(58,175,219,0.07)":"transparent"}}><span style={{fontSize:12,fontWeight:600,color:role===r.id?B.accent:B.white}}>{r.label}</span><span style={{fontSize:10,color:B.gray,marginLeft:6}}>{r.desc}</span></button>)}
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",marginBottom:14}}>
          {["\ud83d\udcac Scenarios","\ud83d\udd0d Spotlights","\u26a1 Rapid Fire","\ud83d\udcca Rankings","\u2194\ufe0f Spectrum"].map((t,i) => <span key={i} style={{padding:"2px 8px",borderRadius:10,background:"rgba(255,255,255,0.03)",color:B.frost,fontSize:9}}>{t}</span>)}
        </div>
        <div style={{textAlign:"center"}}><button onClick={() => {if(role) startFresh();}} disabled={!role} style={{padding:"11px 36px",borderRadius:8,border:"none",fontSize:13,fontWeight:700,background:role?`linear-gradient(135deg,${B.accent},${B.dim})`:"rgba(255,255,255,0.05)",color:role?B.white:B.gray,cursor:role?"pointer":"not-allowed"}}>Begin Assessment \u2192</button></div>
      </div>
    </div>
  );
  // ===== ASSESSMENT =====
  if (screen === "assessment" && pQs.length > 0 && cQ < pQs.length) {
    const q = pQs[cQ]; const dim = DIMS.find(d => d.id === q.dim);
    const tl = {scenario:"\ud83d\udcac Scenario",spotlight:"\ud83d\udd0d Spotlight",slider:"\u2194\ufe0f Spectrum",rank:"\ud83d\udcca Rank",rapid:"\u26a1 Rapid Fire"};
    return (
      <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${B.navy},${B.deep})`,fontFamily:"system-ui",padding:20}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:9,fontWeight:600,color:B.frost,textTransform:"uppercase",letterSpacing:1.5}}>ArcticMind</span>
            <span style={{fontSize:10,color:B.gray}}>{cQ+1}/{total}</span>
          </div>
          <div style={{height:2,background:"rgba(255,255,255,0.04)",borderRadius:2,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${B.accent},${B.green})`,transition:"width 0.4s"}}/></div>
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {dim && <span style={{padding:"2px 7px",borderRadius:10,background:`${dim.color}18`,color:dim.color,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{dim.label}</span>}
            <span style={{padding:"2px 7px",borderRadius:10,background:"rgba(255,255,255,0.04)",color:B.frost,fontSize:9}}>{tl[q.type]}</span>
          </div>
          <div style={{opacity:fade?1:0,transition:"opacity 0.18s"}}>
            <h2 style={{fontSize:16,fontWeight:700,color:B.white,lineHeight:1.5,margin:"0 0 16px"}}>{q.text}</h2>
            {q.type==="scenario" && <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {q.options.map((o,i) => <button key={i} onClick={() => handleScen(i,o.score)} disabled={locked} style={{padding:"11px 14px",borderRadius:7,textAlign:"left",cursor:locked?"default":"pointer",opacity:locked&&selIdx!==i?0.3:1,border:selIdx===i?`2px solid ${B.accent}`:"1px solid rgba(255,255,255,0.06)",background:selIdx===i?"rgba(58,175,219,0.08)":"rgba(255,255,255,0.02)",pointerEvents:locked?"none":"auto"}}><span style={{fontSize:12,color:selIdx===i?B.accent:B.frost,lineHeight:1.5}}>{o.text}</span></button>)}
            </div>}
            {q.type==="spotlight" && <div>
              <div style={{background:"rgba(255,255,255,0.025)",borderRadius:7,padding:"12px 14px",marginBottom:10,border:"1px solid rgba(255,255,255,0.04)"}}>
                {q.passage.map((s,i) => {
                  const sel = spotSel[i];
                  let bg = sel?"rgba(229,92,92,0.1)":"transparent", bd = sel?B.red:"transparent";
                  if (showFB) { if (s.flag&&sel){bg=`rgba(52,195,143,0.12)`;bd=B.green;} else if(s.flag&&!sel){bg=`rgba(244,183,64,0.08)`;bd=B.amber;} else if(!s.flag&&sel){bg=`rgba(229,92,92,0.1)`;bd=B.red;} else{bg="transparent";bd="transparent";} }
                  return <span key={i} onClick={() => togSpot(i)} style={{cursor:showFB?"default":"pointer",padding:"1px 2px",borderRadius:2,background:bg,borderBottom:`2px solid ${bd}`,fontSize:12,color:B.frost,lineHeight:1.8,display:"inline"}}>{s.text}{" "}{showFB&&s.flag&&<span style={{fontSize:8,color:sel?B.green:B.amber,fontWeight:700}}>{sel?"\u2713 ":"missed "}</span>}{showFB&&!s.flag&&sel&&<span style={{fontSize:8,color:B.red,fontWeight:700}}>\u2717 </span>}</span>;
                })}
              </div>
              {showFB && <div style={{background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"8px 12px",marginBottom:8,border:"1px solid rgba(255,255,255,0.04)"}}>{q.passage.filter(s=>s.flag).map((s,i)=><div key={i} style={{fontSize:10,color:B.frost,opacity:0.7,marginBottom:3,lineHeight:1.4}}><span style={{color:B.amber}}>\u2192</span> {s.reason}</div>)}</div>}
              {!showFB ? <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:10,color:B.gray}}>{Object.values(spotSel).filter(Boolean).length} flagged</span><button onClick={subSpot} style={btnP}>Submit Flags</button></div> : waiting && <div style={{textAlign:"center",marginTop:6}}><button onClick={doContinue} style={btnP}>Continue \u2192</button></div>}
            </div>}
            {q.type==="slider" && <div>
              <input type="range" min={0} max={100} value={sliderV} onChange={e => setSliderV(+e.target.value)} disabled={locked} style={{width:"100%",accentColor:B.accent,cursor:locked?"default":"pointer",marginBottom:8}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:B.gray,maxWidth:"38%",lineHeight:1.3}}>{q.left}</span><span style={{fontSize:10,color:B.gray,maxWidth:"38%",textAlign:"right",lineHeight:1.3}}>{q.right}</span></div>
              <div style={{textAlign:"center",marginTop:12}}><button onClick={subSlider} disabled={locked} style={{...btnP,opacity:locked?0.4:1}}>Confirm \u2192</button></div>
            </div>}
            {q.type==="rank" && rankOrd.length>0 && <div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>{rankOrd.map((it,i) => <div key={it.id} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 10px",background:"rgba(255,255,255,0.025)",borderRadius:6,border:"1px solid rgba(255,255,255,0.05)"}}><span style={{fontSize:12,fontWeight:700,color:B.accent,minWidth:16}}>{i+1}</span><span style={{flex:1,fontSize:11,color:B.frost}}>{it.text}</span><div style={{display:"flex",flexDirection:"column"}}>{i>0&&<button onClick={()=>moveR(i,i-1)} disabled={locked} style={{background:"none",border:"none",color:B.gray,cursor:"pointer",fontSize:10,padding:"0 4px"}}>\u25b2</button>}{i<rankOrd.length-1&&<button onClick={()=>moveR(i,i+1)} disabled={locked} style={{background:"none",border:"none",color:B.gray,cursor:"pointer",fontSize:10,padding:"0 4px"}}>\u25bc</button>}</div></div>)}</div>
              <div style={{textAlign:"center"}}><button onClick={subRank} disabled={locked} style={{...btnP,opacity:locked?0.4:1}}>Lock Ranking \u2192</button></div>
            </div>}
            {q.type==="rapid" && <div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>{q.statements.map((s,i) => {
                const a = rapAns[i]; const picked = a !== undefined; const ok = picked && a === s.correct;
                const fbLocked = showFB;
                return <div key={i} style={{padding:"10px 12px",borderRadius:7,background:"rgba(255,255,255,0.025)",border:fbLocked&&picked?`1px solid ${ok?B.green:B.red}28`:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontSize:11,color:B.frost,marginBottom:6,lineHeight:1.5}}>{s.text}</div>
                  <div style={{display:"flex",gap:5}}>{["agree","disagree"].map(opt => {
                    const isT = picked && a === opt; const isC = fbLocked && opt === s.correct;
                    return <button key={opt} onClick={() => handleRap(i,opt)} disabled={fbLocked} style={{padding:"4px 14px",borderRadius:4,fontSize:10,fontWeight:600,cursor:fbLocked?"default":"pointer",border:isT?`1px solid ${fbLocked?(ok?B.green:B.red):B.accent}`:isC?`1px solid ${B.green}`:"1px solid rgba(255,255,255,0.07)",background:isT?(fbLocked?(ok?`${B.green}10`:`${B.red}10`):`${B.accent}10`):isC?`${B.green}06`:"transparent",color:isT?(fbLocked?(ok?B.green:B.red):B.accent):isC?B.green:B.gray,textTransform:"capitalize",pointerEvents:fbLocked?"none":"auto"}}>{opt}</button>;
                  })}</div>
                  {fbLocked&&picked&&<div style={{fontSize:9,color:ok?B.green:B.amber,marginTop:4,lineHeight:1.4}}>{ok?"\u2713 ":"\u2717 "}{s.explanation}</div>}
                </div>;
              })}</div>
              {waiting && <div style={{textAlign:"center",marginTop:10}}><button onClick={doContinue} style={btnP}>Continue \u2192</button></div>}
            </div>}
          </div>
        </div>
      </div>
    );
  }
  // ===== RESULTS =====
  if (screen === "results") {
    const scores = getScores(); const ov = getOv(); const lv = getLv(ov);
    const rd = DIMS.map(d => ({subject:d.short,score:scores[d.id],fullMark:100}));
    const bd = DIMS.map(d => ({name:d.short,score:scores[d.id],color:d.color}));
    return (
      <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${B.navy},${B.deep})`,fontFamily:"system-ui",padding:20}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:9,fontWeight:600,color:B.frost,textTransform:"uppercase",letterSpacing:2,marginBottom:3}}>Assessment Complete</div>
            {orgName&&<div style={{fontSize:11,color:B.gray}}>{orgName}</div>}
            <div style={{fontSize:10,color:B.gray}}>{ROLES.find(r=>r.id===role)?.label} \u00b7 {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:24,marginBottom:16,border:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:90,height:90,borderRadius:"50%",border:`3px solid ${lv.color}`,marginBottom:10}}><div><div style={{fontSize:30,fontWeight:800,color:lv.color,lineHeight:1}}>{ov}</div><div style={{fontSize:8,color:B.gray}}>/ 100</div></div></div>
            <div style={{fontSize:16,fontWeight:800,color:B.white}}>{lv.label}</div>
            <div style={{fontSize:10,color:lv.color,fontWeight:600}}>{lv.grade}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:"rgba(255,255,255,0.035)",borderRadius:10,padding:"12px 6px",border:"1px solid rgba(255,255,255,0.05)"}}>
              <ResponsiveContainer width="100%" height={180}><RadarChart data={rd} cx="50%" cy="50%" outerRadius="62%"><PolarGrid stroke="rgba(255,255,255,0.06)"/><PolarAngleAxis dataKey="subject" tick={{fill:B.frost,fontSize:8}}/><PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false}/><Radar dataKey="score" stroke={B.accent} fill={B.accent} fillOpacity={0.16} strokeWidth={2}/></RadarChart></ResponsiveContainer>
            </div>
            <div style={{background:"rgba(255,255,255,0.035)",borderRadius:10,padding:"12px 6px",border:"1px solid rgba(255,255,255,0.05)"}}>
              <ResponsiveContainer width="100%" height={180}><BarChart data={bd} layout="vertical" margin={{left:0,right:8}}><XAxis type="number" domain={[0,100]} tick={{fill:B.gray,fontSize:7}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={{fill:B.frost,fontSize:8}} width={62} axisLine={false} tickLine={false}/><Bar dataKey="score" radius={[0,4,4,0]} barSize={14}>{bd.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar></BarChart></ResponsiveContainer>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.035)",borderRadius:10,padding:16,marginBottom:16,border:"1px solid rgba(255,255,255,0.05)"}}>
            {DIMS.map(d => {const s=scores[d.id];const l=getLv(s);return <div key={d.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,fontWeight:600,color:B.white}}>{d.label}</span><span style={{fontSize:10,color:l.color,fontWeight:700}}>{s}%</span></div><div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${s}%`,background:d.color,borderRadius:2}}/></div></div>;})}
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={fullReset} style={{...btnO,marginRight:6}}>Retake</button>
            <button style={btnP}>Request Full Org Assessment</button>
          </div>
          <div style={{textAlign:"center",marginTop:14,fontSize:8,color:B.gray}}>\u00a9 ArcticMind {new Date().getFullYear()} \u00b7 v3.0</div>
        </div>
      </div>
    );
  }
  return null;
}
