import { useState, useEffect, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { supabase } from "./supabaseClient";

const BRAND = {
  navy: "#0B1D3A",
  deepBlue: "#122B52",
  accent: "#3AAFDB",
  accentDim: "#2A8FB8",
  ice: "#E8F4F8",
  frost: "#C5E4EF",
  white: "#FFFFFF",
  gray: "#7B8FA3",
  green: "#34C38F",
  amber: "#F4B740",
  red: "#E55C5C",
  darkText: "#0F2644",
  purple: "#9B59B6",
  orange: "#E67E22",
};

const ROLES = [
  { id: "knowledge", label: "Knowledge Worker", desc: "Analyst, coordinator, specialist, or individual contributor" },
  { id: "manager", label: "People Manager", desc: "Team lead, director, or department head" },
  { id: "hr", label: "HR / People Ops", desc: "Talent, L&D, people analytics, or workforce planning" },
  { id: "finance", label: "Finance", desc: "FP&A, accounting, audit, or financial operations" },
  { id: "it_product", label: "IT / Product", desc: "Engineering, product management, IT operations, or security" },
];

const DIMENSIONS = [
  { id: "foundations", label: "AI Foundations", short: "Foundations", color: "#3AAFDB" },
  { id: "proficiency", label: "Tool Proficiency", short: "Proficiency", color: "#34C38F" },
  { id: "judgment", label: "Critical Judgment", short: "Judgment", color: "#F4B740" },
  { id: "workflow", label: "Workflow Integration", short: "Workflow", color: "#9B59B6" },
  { id: "mindset", label: "Mindset & Experimentation", short: "Mindset", color: "#E67E22" },
];

/*
SCORING PHILOSOPHY:
- Scores are NOT linear from "least to most enthusiastic about AI"
- The MOST aggressive/confident answer is sometimes a 2 or 3, not a 4
- Overcorrection (blind trust, reckless adoption) scores LOWER than calibrated caution
- The best answers demonstrate JUDGMENT, not enthusiasm
- Many questions have no obvious "right" answer — they test tradeoff reasoning
*/

const QUESTIONS = [
  // ====== FOUNDATIONS (5) ======
  {
    dimension: "foundations",
    text: "Your CEO announces: \"We're going to use AI to make all our hiring decisions faster and more objective.\" In a leadership meeting, you're asked for your honest reaction. What's closest to what you'd actually say?",
    scalar: true,
    options: [
      { text: "Great idea — AI removes human bias from hiring, so decisions will be fairer and faster", score: 1 },
      { text: "Let's pilot it. We can track whether AI selections perform better than human ones and adjust from there", score: 2 },
      { text: "This is a bad idea — we shouldn't let machines make decisions about people's careers", score: 2 },
      { text: "I'm concerned. AI hiring tools have well-documented bias issues and this might create more legal risk than it solves. I'd want to understand the specific tool, what data it trains on, and whether we have the oversight structure to catch problems", score: 4 },
    ],
  },
  {
    dimension: "foundations",
    text: "A vendor tells you their AI product is \"99% accurate.\" What's your first instinct?",
    scalar: true,
    options: [
      { text: "That's impressive — sounds like a solid product", score: 1 },
      { text: "All vendors exaggerate. I'd ignore the claim and just test it myself", score: 3 },
      { text: "I don't trust accuracy numbers — AI is too unpredictable to put a number on", score: 1 },
      { text: "I'd want to know: 99% accurate at what? On whose data? Measured how? And what happens in the 1% failure case — because if the failure mode is catastrophic, 99% might not be good enough", score: 4 },
    ],
  },
  {
    dimension: "foundations",
    text: "Two colleagues are debating. One says AI will eliminate most white-collar jobs within 5 years. The other says it's overhyped and won't change much. Who's closer to right?",
    options: [
      { text: "The first one — AI is advancing incredibly fast and most knowledge work will be automated", score: 1 },
      { text: "The second one — people have been predicting automation replacing jobs for decades and it never really happens", score: 1 },
      { text: "Neither. AI will likely reshape roles more than eliminate them — the tasks within jobs will shift, but the transition will be uneven across industries and functions. The real risk is for orgs that do nothing", score: 4 },
      { text: "It's impossible to predict — nobody really knows what will happen", score: 2 },
    ],
  },
  {
    dimension: "foundations",
    text: "Your company wants to build an internal AI tool using company data. The engineering team says they can have a prototype in two weeks. What question would you ask first?",
    options: [
      { text: "How will we prevent the AI from surfacing confidential data to people who shouldn't have access to it?", score: 4 },
      { text: "What's the projected ROI?", score: 2 },
      { text: "Can we see a demo of what it would look like?", score: 1 },
      { text: "Two weeks sounds fast — we should take longer to make sure it's built properly", score: 2 },
    ],
  },
  {
    dimension: "foundations",
    text: "You read that a major AI company just released a model that scores \"expert-level\" on medical licensing exams. What does this mean for using AI in healthcare?",
    scalar: true,
    options: [
      { text: "AI is now ready to help diagnose patients — this could democratize access to healthcare", score: 1 },
      { text: "We should immediately pilot AI-assisted diagnostics at hospitals that volunteer — the potential benefit is too large to wait", score: 1 },
      { text: "It doesn't mean much — AI can't replace doctors", score: 2 },
      { text: "Exam performance doesn't equal clinical competence. Exams are structured and predictable; patient care involves ambiguity, context, and stakes that benchmarks don't capture. It's promising but the gap between test performance and safe deployment is enormous", score: 4 },
    ],
  },

  // ====== PROFICIENCY (5) ======
  {
    dimension: "proficiency",
    text: "You ask AI to write an email to a frustrated client. The draft is polished but feels generic. You're in a rush. What do you actually do?",
    scalar: true,
    options: [
      { text: "Send it — it's professional and the client won't know the difference", score: 1 },
      { text: "Paste our recent email thread into the AI and ask it to draft something that reflects the specific situation and tone of our relationship", score: 3 },
      { text: "Rewrite it from scratch — AI doesn't understand this client relationship", score: 2 },
      { text: "Keep the structure, but rewrite the opening and closing to reference specific details from our relationship. Add one sentence that only someone who knows this client would write", score: 4 },
    ],
  },
  {
    dimension: "proficiency",
    text: "You're using AI to help analyze quarterly sales data. The AI summary says revenue grew 12% YoY. You glance at the raw numbers and the growth looks closer to 8%. What do you do?",
    scalar: true,
    options: [
      { text: "Go with the AI number — it probably accounted for something I'm not seeing", score: 1 },
      { text: "Go with my quick calculation — I trust my own math more", score: 2 },
      { text: "Flag both numbers in my report and note the discrepancy so leadership can decide which methodology to use", score: 3 },
      { text: "Dig into the discrepancy. Ask the AI to show its calculation step by step, then verify against the raw data. The gap itself is the most important thing to understand — it reveals either my error or the AI's", score: 4 },
    ],
  },
  {
    dimension: "proficiency",
    text: "A colleague asks you to recommend an AI tool for their work. You've never used one for their specific task. What's your honest response?",
    options: [
      { text: "Recommend the AI tool I use most — it's probably versatile enough", score: 1 },
      { text: "Tell them I don't know enough about their specific task to recommend something, but I'd be happy to help them test 2–3 options against a real task from their work to see what actually fits", score: 4 },
      { text: "Point them to a review site or YouTube comparison so they can decide themselves", score: 2 },
      { text: "Tell them AI probably isn't the right solution until they know exactly what problem they're solving", score: 3 },
    ],
  },
  {
    dimension: "proficiency",
    text: "You've been using an AI tool for a month and it's saving you real time. Then a newer, \"better\" tool launches. What's your move?",
    scalar: true,
    options: [
      { text: "Switch immediately — newer is usually better in AI", score: 1 },
      { text: "Wait 3–6 months for reviews to come in before considering a switch", score: 2 },
      { text: "Stick with what works — switching costs are real and the new tool is unproven in my workflow", score: 3 },
      { text: "Run both on the same task for a week. Compare on speed, accuracy, and output quality for my specific use cases — then decide based on evidence, not hype", score: 4 },
    ],
  },
  {
    dimension: "proficiency",
    text: "You're trying to use AI to draft a complex project proposal. After three attempts, the output is mediocre. What's your next step?",
    scalar: true,
    options: [
      { text: "Give up on AI for this task — some things are too complex for it", score: 1 },
      { text: "Try a completely different AI tool — this one clearly can't handle it", score: 1 },
      { text: "Feed the AI a similar proposal I wrote before and ask it to follow that structure with updated details", score: 3 },
      { text: "Break the proposal into smaller components (executive summary, timeline, risk section) and generate each piece separately with specific context and constraints. The task was probably too broad for a single prompt", score: 4 },
    ],
  },

  // ====== JUDGMENT (5) ======
  {
    dimension: "judgment",
    text: "Your team builds an AI workflow that saves 10 hours per week. Three months later, you notice the quality of the outputs has quietly degraded — but nobody else has flagged it. What do you do?",
    scalar: true,
    options: [
      { text: "Nothing yet — if nobody's complained, the quality is probably still acceptable", score: 1 },
      { text: "Mention it at the next team meeting and see if others have noticed", score: 2 },
      { text: "Immediately shut down the workflow until quality is restored", score: 2 },
      { text: "Document the specific degradation, assess the business impact, then bring it to the team with a proposal: either recalibrate the workflow or add a periodic quality check. The 10 hours saved are only valuable if the output is trustworthy", score: 4 },
    ],
  },
  {
    dimension: "judgment",
    text: "Your company's legal team asks you to stop using AI for any client-facing work until they finish a 6-month policy review. But your competitors are clearly using AI to move faster. What do you do?",
    options: [
      { text: "Follow the policy — legal risk isn't worth the speed advantage", score: 3 },
      { text: "Use AI anyway but don't mention it — the policy is overly cautious and we're falling behind", score: 1 },
      { text: "Propose a middle path: identify 2–3 low-risk, internal-facing use cases that legal can approve quickly while the broader review continues. Show legal you're being responsible while not losing 6 months of progress", score: 4 },
      { text: "Escalate to senior leadership — legal is blocking innovation and someone needs to override them", score: 1 },
    ],
  },
  {
    dimension: "judgment",
    text: "An AI tool generates a summary of a client meeting. It's 95% accurate but includes one detail that didn't actually come up in the meeting — a plausible-sounding action item attributed to the client. What's the right call?",
    scalar: true,
    options: [
      { text: "Share it as-is but note it was AI-generated so the client can flag any inaccuracies", score: 1 },
      { text: "Remove the fabricated item and share the rest — most of it is accurate", score: 2 },
      { text: "Discard the entire summary and write it manually — if it hallucinated one thing, the rest can't be trusted either", score: 2 },
      { text: "Remove the fabricated item, verify every remaining point against your notes, then share with a note about how the summary was generated. Use this as a data point to calibrate how much verification this tool needs going forward", score: 4 },
    ],
  },
  {
    dimension: "judgment",
    text: "A junior team member is excited about an AI tool they found online and wants to use it for a sensitive internal project. The tool isn't on the company's approved list. What do you tell them?",
    scalar: true,
    options: [
      { text: "Great initiative — go ahead and use it, just don't upload anything confidential", score: 1 },
      { text: "Let me test it first with non-sensitive data. If it works well, I'll handle the approval process", score: 3 },
      { text: "Absolutely not — if it's not approved, it's not allowed. Full stop", score: 2 },
      { text: "I appreciate you finding this. Before we use it, we need to understand its data handling: does it train on inputs? Where is data stored? What are the terms of service? If it checks those boxes, let's submit it for IT review. If not, let's find an approved alternative that does something similar", score: 4 },
    ],
  },
  {
    dimension: "judgment",
    text: "You're presenting AI-generated analysis to the board. A board member asks: \"How confident are you in these numbers?\" What do you say?",
    scalar: true,
    options: [
      { text: "Very confident — the AI model is highly capable and the methodology is sound", score: 1 },
      { text: "I wouldn't present numbers I'm not confident in. The analysis is solid", score: 2 },
      { text: "Moderately confident — AI helped with the analysis but I'd recommend validating independently before acting on it", score: 3 },
      { text: "I've verified the key findings against our source data and they hold up. But I want to be transparent: the analysis was AI-assisted, which means I've spot-checked the outputs rather than computed every number by hand. Here's where I'm most and least confident, and here's what I'd want to validate further before making major decisions based on this", score: 4 },
    ],
  },

  // ====== WORKFLOW (5) ======
  {
    dimension: "workflow",
    text: "Your boss asks you to identify which of your team's processes would benefit most from AI. You have 50+ processes. How do you prioritize?",
    options: [
      { text: "Start with whatever processes use the most labor hours — that's where the biggest ROI is", score: 2 },
      { text: "Ask each team member what they'd like to automate", score: 1 },
      { text: "Score each process on three factors: how repetitive it is, how easy it is to verify the output, and what happens if the AI gets it wrong. Start with high-repetition, easy-to-verify, low-consequence tasks — even if they're not the highest-hour processes", score: 4 },
      { text: "Pick the most painful process and try AI on it — if it works on the hardest one, it'll work on the rest", score: 1 },
    ],
  },
  {
    dimension: "workflow",
    text: "You've automated a report that used to take 4 hours using AI. It now takes 20 minutes. But the AI-generated version occasionally has formatting errors that take 10 minutes to fix. Is this workflow a success?",
    scalar: true,
    options: [
      { text: "Yes — we're saving 3.5 hours per report even with the fixes", score: 2 },
      { text: "Partially — it's worth using but I'd keep the manual process as a backup", score: 3 },
      { text: "No — if we can't trust the output, we haven't really automated anything", score: 1 },
      { text: "Depends. Track the formatting errors over 10 reports. If they're consistent and predictable, build a fix into the workflow (template, post-processing script, or adjusted prompt). If they're random and growing, the automation has a reliability problem. The answer is in the pattern, not any single report", score: 4 },
    ],
  },
  {
    dimension: "workflow",
    text: "A colleague in another department asks how you used AI to improve a process. They want to replicate it. But their workflow is quite different from yours. What's your advice?",
    scalar: true,
    options: [
      { text: "Introduce them to the AI tool I used and let them figure out how it applies to their work", score: 1 },
      { text: "Share my exact prompts and tools — they can adapt from there", score: 2 },
      { text: "Offer to build their workflow for them — I already know what works", score: 2 },
      { text: "Tell them the principle behind what worked (breaking complex tasks into smaller ones, providing specific context, building verification steps) and suggest they map their own workflow first before choosing tools. The approach transfers; the specifics probably don't", score: 4 },
    ],
  },
  {
    dimension: "workflow",
    text: "Your team starts using AI heavily and individual output goes up 30%. But in a team retrospective, several people say they feel less creative and more like \"AI editors\" than original thinkers. How do you respond?",
    scalar: true,
    options: [
      { text: "That's the tradeoff — the productivity gains are worth it", score: 1 },
      { text: "Let each person decide how much AI they want to use — make it optional", score: 3 },
      { text: "Scale back AI usage to restore creative ownership", score: 2 },
      { text: "This is important signal. Redesign the workflow: use AI for the parts that are genuinely repetitive (data gathering, formatting, first-pass analysis) but protect the parts where human creativity adds the most value (strategy, synthesis, client insight). Productivity without engagement is a slow-burning retention problem", score: 4 },
    ],
  },
  {
    dimension: "workflow",
    text: "You discover that a process you automated with AI 6 months ago is now producing subtly different outputs than when you first set it up — the AI model was updated by the vendor. Nothing is \"wrong\" but the outputs are inconsistent with historical data. What do you do?",
    scalar: true,
    options: [
      { text: "Nothing — the newer model is probably better anyway", score: 1 },
      { text: "Pin to the older model version if possible and continue as before", score: 2 },
      { text: "Report it to the vendor and ask them to maintain backward compatibility", score: 2 },
      { text: "Compare outputs from both versions against your quality criteria. If the new version is actually better, update your baselines. If consistency matters more than marginal quality improvement, pin to the old version. Either way, add model version tracking to your workflow documentation — this will happen again", score: 4 },
    ],
  },

  // ====== MINDSET (5) ======
  {
    dimension: "mindset",
    text: "Your company offers a voluntary 2-hour AI training session during work hours. Attendance is tracked but not required. Do you go?",
    scalar: true,
    options: [
      { text: "No — I'll learn AI on my own when I need to", score: 1 },
      { text: "Yes — any learning opportunity is worth taking", score: 2 },
      { text: "Yes, and I'd encourage my whole team to go", score: 3 },
      { text: "Depends entirely on who's running it and what's covered. If it's a generic overview I've heard before, my time is better spent. If it's hands-on with real use cases, I'm there. I'd check the agenda first and advocate for making it more practical if it looks too theoretical", score: 4 },
    ],
  },
  {
    dimension: "mindset",
    text: "You use AI to complete a task in 30 minutes that normally takes your team a full day. When presenting the result, do you mention that AI helped?",
    scalar: true,
    options: [
      { text: "No — the result speaks for itself and mentioning AI might make people trust it less", score: 1 },
      { text: "Yes, proudly — it shows I'm innovative and efficient", score: 2 },
      { text: "Only if asked — I don't want to make colleagues feel they need to use AI to keep up", score: 3 },
      { text: "Yes, but framed specifically: explain what AI handled, what I verified, and what I added. This normalizes AI use, builds trust through transparency, and helps others learn what's possible — without overselling or underselling my contribution", score: 4 },
    ],
  },
  {
    dimension: "mindset",
    text: "You try an AI experiment at work and it fails spectacularly — the output is embarrassingly wrong and you've wasted a morning. A colleague asks how it went. What do you say?",
    scalar: true,
    options: [
      { text: "\"AI isn't ready for this kind of work yet\" — and move on", score: 1 },
      { text: "\"It didn't work, but I don't want to talk about it\" — it's embarrassing", score: 1 },
      { text: "\"It didn't work this time, but I'll try again with a different approach\"", score: 3 },
      { text: "\"It failed, and here's exactly why — I gave it too broad a task without enough constraints. Next time I'd approach it differently by doing X.\" Then share the specific failure with the team because someone else was probably about to make the same mistake", score: 4 },
    ],
  },
  {
    dimension: "mindset",
    text: "An industry report says your specific job function has a \"high automation potential\" within 3 years. How does this affect your behavior?",
    scalar: true,
    options: [
      { text: "I'd start looking for a role that's harder to automate", score: 1 },
      { text: "I'm not worried — these predictions are usually overblown", score: 1 },
      { text: "I'd start learning as many AI tools as possible to stay ahead of the curve", score: 2 },
      { text: "I'd study which parts of my role are most automatable and start building depth in the parts that aren't — judgment, relationships, creative strategy. Then I'd learn to orchestrate the AI tools that automate the rest, so I'm the person who makes the automation work, not the person replaced by it", score: 4 },
    ],
  },
  {
    dimension: "mindset",
    text: "Your team is debating whether to adopt AI for a key process. Half the team is excited, half is resistant. You're asked to make the call. What do you decide?",
    scalar: true,
    options: [
      { text: "Adopt it — the resistant half will come around once they see results", score: 1 },
      { text: "Don't adopt it — forcing tools on people who resist them creates bigger problems than not having the tool", score: 2 },
      { text: "Let each person decide individually whether to use it — don't force standardization", score: 2 },
      { text: "Run a time-boxed pilot with volunteers from both sides. Give the skeptics a genuine role in evaluating results — not just observing. Their concerns probably surface real risks that the enthusiasts are glossing over. Make the final decision based on measured results, not opinions", score: 4 },
    ],
  },
];

const LEVELS = [
  { min: 0, max: 35, label: "Unaware", grade: "Level 1", color: BRAND.red, desc: "Minimal AI understanding. Significant upskilling needed before safe, productive AI use. Priority: foundational literacy and supervised tool exposure." },
  { min: 36, max: 52, label: "Aware", grade: "Level 2", color: BRAND.amber, desc: "Basic awareness but limited practical capability. Ready for structured learning with guided experiments and clear guardrails." },
  { min: 53, max: 72, label: "Capable", grade: "Level 3", color: BRAND.accent, desc: "Solid foundation with real-world application. Ready for advanced workflows, cross-team knowledge sharing, and expanded use cases." },
  { min: 73, max: 88, label: "Proficient", grade: "Level 4", color: BRAND.green, desc: "Strong across all dimensions. Candidate for AI champion role — can train peers, design workflows, and contribute to governance." },
  { min: 89, max: 100, label: "Advanced", grade: "Level 5", color: BRAND.green, desc: "Exceptional AI readiness. Natural leader for adoption initiatives. Combines tool fluency with governance awareness and experimental discipline." },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [role, setRole] = useState(null);
  const [orgName, setOrgName] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [fadeIn, setFadeIn] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", org: "", size: "", message: "" });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [assessmentId, setAssessmentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const hasSaved = useRef(false);

  useEffect(() => {
    if (screen === "assessment") {
      const grouped = DIMENSIONS.map(d => {
        const dimQs = QUESTIONS.filter(q => q.dimension === d.id);
        return dimQs.map(q => {
          if (q.scalar) {
            // Scalar questions: randomly present in authored order OR reversed
            // This prevents gaming by always picking the last option
            const flip = Math.random() < 0.5;
            return { ...q, options: flip ? [...q.options].reverse() : [...q.options] };
          }
          // Non-scalar questions: shuffle options
          return { ...q, options: shuffle(q.options) };
        });
      });
      setShuffledQuestions(grouped.flat());
    }
  }, [screen]);

  // Save assessment results to Supabase when reaching results screen
  useEffect(() => {
    if (screen !== "results" || hasSaved.current) return;
    hasSaved.current = true;

    async function saveResults() {
      setSaving(true);
      try {
        const scores = {};
        DIMENSIONS.forEach(d => { scores[d.id] = { total: 0, count: 0 }; });
        Object.values(answers).forEach(a => {
          if (scores[a.dimension]) {
            scores[a.dimension].total += a.score;
            scores[a.dimension].count += 1;
          }
        });
        const dimScores = {};
        DIMENSIONS.forEach(d => {
          const s = scores[d.id];
          dimScores[d.id] = s.count > 0 ? Math.round((s.total / (s.count * 4)) * 100) : 0;
        });
        const vals = Object.values(dimScores);
        const overall = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        const level = LEVELS.find(l => overall >= l.min && overall <= l.max) || LEVELS[0];

        const { data, error } = await supabase
          .from("assessment_results")
          .insert({
            organization_name: orgName || null,
            role: role,
            overall_score: overall,
            overall_level: level.label,
            foundations_score: dimScores.foundations,
            proficiency_score: dimScores.proficiency,
            judgment_score: dimScores.judgment,
            workflow_score: dimScores.workflow,
            mindset_score: dimScores.mindset,
            answers: answers,
            user_agent: navigator.userAgent,
          })
          .select()
          .single();

        if (!error && data) {
          setAssessmentId(data.id);
        }
      } catch (err) {
        console.error("Failed to save assessment:", err);
      } finally {
        setSaving(false);
      }
    }

    saveResults();
  }, [screen]);

  const totalQuestions = QUESTIONS.length;
  const progress = totalQuestions > 0 ? ((currentQ + 1) / totalQuestions) * 100 : 0;

  function handleAnswer(index, score) {
    if (locked) return;
    setLocked(true);
    setSelectedIndex(index);
    setTimeout(() => {
      const q = shuffledQuestions[currentQ];
      setAnswers(prev => ({ ...prev, [currentQ]: { dimension: q.dimension, score } }));
      if (currentQ < totalQuestions - 1) {
        setFadeIn(false);
        setTimeout(() => {
          setCurrentQ(prev => prev + 1);
          setSelectedIndex(null);
          setLocked(false);
          setFadeIn(true);
        }, 200);
      } else {
        setScreen("results");
      }
    }, 350);
  }

  function getScores() {
    const scores = {};
    DIMENSIONS.forEach(d => { scores[d.id] = { total: 0, count: 0 }; });
    Object.values(answers).forEach(a => {
      if (scores[a.dimension]) {
        scores[a.dimension].total += a.score;
        scores[a.dimension].count += 1;
      }
    });
    const result = {};
    DIMENSIONS.forEach(d => {
      const s = scores[d.id];
      result[d.id] = s.count > 0 ? Math.round((s.total / (s.count * 4)) * 100) : 0;
    });
    return result;
  }

  function getOverallScore() {
    const scores = getScores();
    const vals = Object.values(scores);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  function getLevel(score) {
    return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0];
  }

  function getRecommendations(scores) {
    const recs = [];
    const sorted = DIMENSIONS.map(d => ({ ...d, score: scores[d.id] })).sort((a, b) => a.score - b.score);
    const lowest = sorted[0];
    const secondLowest = sorted[1];
    const highest = sorted[sorted.length - 1];

    const recMap = {
      foundations: {
        low: "Priority gap: AI conceptual foundations. Focus on understanding what models can and can't do, how to evaluate vendor claims critically, and the real-world limitations behind impressive benchmarks. Recommended: scenario-based learning (not lectures) that forces calibration between AI hype and reality.",
        high: "Strong conceptual grounding. Leverage this by contributing to internal AI governance discussions and helping colleagues develop more realistic mental models of AI capabilities."
      },
      proficiency: {
        low: "Priority gap: hands-on tool fluency. Start with structured experiments on low-stakes tasks — but focus on the iteration loop (why did this output miss, and how do I adjust?), not just the initial prompt. The skill is in refinement, not generation.",
        high: "Strong tool fluency. Push toward multi-tool orchestration: how do different tools chain together to handle complex workflows? Document your best practices as reusable templates for your team."
      },
      judgment: {
        low: "This is the highest-risk gap. Without strong judgment, AI usage creates more liability than value. Prioritize: output verification habits, data privacy instincts, and learning to calibrate confidence ('how sure am I that this AI output is correct, and what's at stake if it's wrong?').",
        high: "Excellent critical judgment. You're the person who should be reviewing others' AI workflows for risk and quality. Consider contributing to your org's AI usage policies."
      },
      workflow: {
        low: "Priority gap: systematic workflow thinking. Start by mapping your top 5 repetitive tasks, but resist the urge to automate the biggest ones first. Pick the most verifiable, lowest-consequence task and build a repeatable process before scaling.",
        high: "Strong workflow integration skills. You're ready to help other teams identify their own AI opportunities. Focus on documentation and knowledge transfer — your playbooks are potentially more valuable than your personal productivity gains."
      },
      mindset: {
        low: "The biggest unlock isn't a tool or a skill — it's shifting from threat-avoidance to structured experimentation. Start with: one deliberate AI experiment per week, with a specific hypothesis and a willingness to share what you learn (especially failures).",
        high: "Your experimental mindset is a multiplier. Use it to create psychological safety for others: share your failures openly, champion structured pilot programs, and model the behavior of treating every AI interaction as a learning opportunity."
      },
    };

    recs.push({ type: "priority", title: `#1 Priority: ${lowest.label}`, text: recMap[lowest.id].low, color: BRAND.red });
    if (secondLowest.score < 60) {
      recs.push({ type: "attention", title: `#2 Needs Attention: ${secondLowest.label}`, text: recMap[secondLowest.id].low, color: BRAND.amber });
    }
    recs.push({ type: "strength", title: `Strength: ${highest.label}`, text: recMap[highest.id].high, color: BRAND.green });

    return recs;
  }

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)",
    color: BRAND.white, fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600, color: BRAND.frost,
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
  };

  // ============ WELCOME ============
  if (screen === "welcome") {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.deepBlue} 50%, #1a3a6a 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 620, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.frost})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, color: BRAND.navy, fontWeight: 800 }}>A</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: BRAND.frost, letterSpacing: 2, textTransform: "uppercase" }}>ArcticMind</span>
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: BRAND.white, margin: "0 0 10px", lineHeight: 1.15 }}>AI Readiness Assessment</h1>
            <p style={{ fontSize: 14, color: BRAND.frost, opacity: 0.7, margin: 0, lineHeight: 1.6 }}>
              25 scenario-based questions. No obvious right answers —<br/>only tradeoffs that reveal how you actually think about AI at work.
            </p>
          </div>

          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "24px 22px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Organization (optional)</label>
              <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Acme Corp" autoComplete="organization" id="assessment-org" style={inputStyle} />
            </div>

            <label style={{ ...labelStyle, marginBottom: 10 }}>Select your role</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ROLES.map(r => (
                <button key={r.id} onClick={() => setRole(r.id)}
                  style={{
                    padding: "12px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    border: role === r.id ? `2px solid ${BRAND.accent}` : "1px solid rgba(255,255,255,0.08)",
                    background: role === r.id ? "rgba(58,175,219,0.1)" : "rgba(255,255,255,0.02)",
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: role === r.id ? BRAND.accent : BRAND.white }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: BRAND.gray, marginTop: 1 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.frost, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>What this measures</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DIMENSIONS.map(d => (
                <span key={d.id} style={{ padding: "4px 10px", borderRadius: 16, background: `${d.color}18`, color: d.color, fontSize: 11, fontWeight: 600 }}>{d.label}</span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: BRAND.gray, margin: "10px 0 0", lineHeight: 1.5 }}>
              Each question presents a realistic workplace scenario with competing valid approaches. The assessment measures how you reason through tradeoffs — not what you know about AI terminology.
            </p>
          </div>

          <div style={{ textAlign: "center" }}>
            <button onClick={() => role && setScreen("assessment")} disabled={!role}
              style={{
                padding: "13px 44px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
                background: role ? `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentDim})` : "rgba(255,255,255,0.08)",
                color: role ? BRAND.white : BRAND.gray, cursor: role ? "pointer" : "not-allowed",
                transition: "all 0.3s", letterSpacing: 0.3
              }}>
              Begin Assessment →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ ASSESSMENT ============
  if (screen === "assessment" && shuffledQuestions.length > 0) {
    const q = shuffledQuestions[currentQ];
    const dim = DIMENSIONS.find(d => d.id === q.dimension);
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.deepBlue} 100%)`, fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif", padding: "20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.frost, textTransform: "uppercase", letterSpacing: 1.5 }}>ArcticMind</span>
            <span style={{ fontSize: 12, color: BRAND.gray }}>{currentQ + 1} / {totalQuestions}</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 28, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.green})`, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 16, background: `${dim.color}1A`, color: dim.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{dim.label}</span>
          </div>
          <div style={{ opacity: fadeIn ? 1 : 0, transition: "opacity 0.18s ease" }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: BRAND.white, lineHeight: 1.5, margin: "0 0 24px", letterSpacing: -0.2 }}>{q.text}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.options.map((opt, i) => {
                const isSelected = selectedIndex === i;
                const isDisabled = locked;
                return (
                  <button key={i} onClick={() => handleAnswer(i, opt.score)}
                    disabled={isDisabled}
                    style={{
                      padding: "14px 18px", borderRadius: 10, textAlign: "left",
                      cursor: isDisabled ? "default" : "pointer",
                      opacity: locked && !isSelected ? 0.5 : 1,
                      border: isSelected ? `2px solid ${BRAND.accent}` : "1px solid rgba(255,255,255,0.08)",
                      background: isSelected ? "rgba(58,175,219,0.12)" : "rgba(255,255,255,0.03)",
                      transition: "all 0.2s",
                      pointerEvents: isDisabled ? "none" : "auto",
                    }}>
                    <span style={{ fontSize: 13, color: isSelected ? BRAND.accent : BRAND.frost, lineHeight: 1.55 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ RESULTS ============
  if (screen === "results") {
    const scores = getScores();
    const overall = getOverallScore();
    const level = getLevel(overall);
    const recs = getRecommendations(scores);
    const radarData = DIMENSIONS.map(d => ({ subject: d.short, score: scores[d.id], fullMark: 100 }));
    const barData = DIMENSIONS.map(d => ({ name: d.short, score: scores[d.id], color: d.color }));

    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.deepBlue} 100%)`, fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif", padding: "24px 20px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.frost, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Assessment Results</div>
            {orgName && <div style={{ fontSize: 14, color: BRAND.gray, marginBottom: 2 }}>{orgName}</div>}
            <div style={{ fontSize: 12, color: BRAND.gray }}>
              {orgName ? `${orgName} · ` : ""}{ROLES.find(r => r.id === role)?.label} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "28px 24px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 110, height: 110, borderRadius: "50%", border: `3px solid ${level.color}`, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 38, fontWeight: 800, color: level.color, lineHeight: 1 }}>{overall}</div>
                <div style={{ fontSize: 10, color: BRAND.gray, marginTop: 2 }}>/ 100</div>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.white, marginBottom: 3 }}>{level.label}</div>
            <div style={{ fontSize: 12, color: level.color, fontWeight: 600, marginBottom: 10 }}>{level.grade}</div>
            <p style={{ fontSize: 13, color: BRAND.frost, lineHeight: 1.6, maxWidth: 480, margin: "0 auto", opacity: 0.75 }}>{level.desc}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "18px 10px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.frost, textAlign: "center", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Competency Map</div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: BRAND.frost, fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke={BRAND.accent} fill={BRAND.accent} fillOpacity={0.18} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "18px 10px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.frost, textAlign: "center", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Dimension Scores</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: BRAND.gray, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: BRAND.frost, fontSize: 10 }} width={72} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: BRAND.navy, border: `1px solid ${BRAND.accent}`, borderRadius: 8, color: BRAND.white, fontSize: 12 }} formatter={(v) => [`${v}%`, "Score"]} />
                  <Bar dataKey="score" radius={[0, 5, 5, 0]} barSize={18}>
                    {barData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "20px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.frost, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Dimension Breakdown</div>
            {DIMENSIONS.map(d => {
              const s = scores[d.id]; const lvl = getLevel(s);
              return (
                <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.white }}>{d.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: lvl.color, fontWeight: 700 }}>{s}%</span>
                      <span style={{ fontSize: 10, color: BRAND.gray, padding: "1px 6px", borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>{lvl.label}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s}%`, background: d.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "20px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.frost, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Personalized Recommendations</div>
            {recs.map((rec, i) => (
              <div key={i} style={{ marginBottom: 14, paddingLeft: 14, borderLeft: `3px solid ${rec.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: rec.color, marginBottom: 3 }}>{rec.title}</div>
                <p style={{ fontSize: 12, color: BRAND.frost, lineHeight: 1.6, margin: 0, opacity: 0.8 }}>{rec.text}</p>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          {!showContactForm ? (
            <div style={{ background: `linear-gradient(135deg, rgba(58,175,219,0.1), rgba(52,195,143,0.06))`, borderRadius: 14, padding: "24px 20px", textAlign: "center", border: `1px solid ${BRAND.accent}25`, marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.white, marginBottom: 6 }}>What does this look like across your whole org?</div>
              <p style={{ fontSize: 12, color: BRAND.frost, lineHeight: 1.6, marginBottom: 18, opacity: 0.7, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                Individual scores tell one story. Org-wide patterns — by department, role, and seniority — tell a different one. We run structured assessments across your workforce and deliver an actionable readiness report.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => { setScreen("welcome"); setCurrentQ(0); setAnswers({}); setRole(null); setOrgName(""); setLocked(false); setSelectedIndex(null); setAssessmentId(null); hasSaved.current = false; }}
                  style={{ padding: "10px 24px", borderRadius: 8, border: `1px solid ${BRAND.accent}`, background: "transparent", color: BRAND.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Retake Assessment
                </button>
                <button onClick={() => setShowContactForm(true)}
                  style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentDim})`, color: BRAND.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Request Full Org Assessment →
                </button>
              </div>
            </div>
          ) : !contactSubmitted ? (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "24px 20px", border: `1px solid ${BRAND.accent}30`, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.white, marginBottom: 4 }}>Request a Full Org Assessment</div>
              <p style={{ fontSize: 12, color: BRAND.gray, marginBottom: 16, lineHeight: 1.5 }}>
                We'll reach out to schedule a brief call about running a structured assessment across your workforce.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input type="text" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Your name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Work Email *</label>
                  <input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="you@company.com" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Organization *</label>
                  <input type="text" value={contactForm.org} onChange={e => setContactForm({ ...contactForm, org: e.target.value })} placeholder="Company name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Approx. Org Size</label>
                  <select value={contactForm.size} onChange={e => setContactForm({ ...contactForm, size: e.target.value })}
                    style={{ ...inputStyle, appearance: "auto" }}>
                    <option value="" style={{ background: BRAND.navy }}>Select...</option>
                    <option value="under-500" style={{ background: BRAND.navy }}>Under 500</option>
                    <option value="500-2000" style={{ background: BRAND.navy }}>500 – 2,000</option>
                    <option value="2000-10000" style={{ background: BRAND.navy }}>2,000 – 10,000</option>
                    <option value="10000-50000" style={{ background: BRAND.navy }}>10,000 – 50,000</option>
                    <option value="50000+" style={{ background: BRAND.navy }}>50,000+</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Anything specific you're looking for? (optional)</label>
                <textarea value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="e.g. We're rolling out Copilot next quarter and want to measure readiness first..."
                  rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowContactForm(false)}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: BRAND.gray, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (contactForm.name && contactForm.email && contactForm.org) {
                      // Save to Supabase
                      try {
                        await supabase.from("contact_requests").insert({
                          assessment_id: assessmentId || null,
                          name: contactForm.name,
                          email: contactForm.email,
                          organization: contactForm.org,
                          org_size: contactForm.size || null,
                          message: contactForm.message || null,
                        });
                      } catch (err) {
                        console.error("Failed to save contact request:", err);
                      }
                      // Also open mailto as backup notification
                      const resultsSummary = DIMENSIONS.map(d => `${d.label}: ${scores[d.id]}%`).join(" | ");
                      const body = [
                        "New ArcticMind Org Assessment Request",
                        "",
                        `From: ${contactForm.name}`,
                        `Email: ${contactForm.email}`,
                        `Organization: ${contactForm.org}`,
                        `Org Size: ${contactForm.size || "Not specified"}`,
                        "",
                        `Individual Assessment Score: ${overall}/100 (${level.label})`,
                        resultsSummary,
                        `Role: ${ROLES.find(r => r.id === role)?.label}`,
                        "",
                        "Message:",
                        contactForm.message || "No additional details provided.",
                        "",
                        "---",
                        "Submitted via ArcticMind AI Readiness Assessment"
                      ].join("\n");
                      const subject = `Org Assessment Request - ${contactForm.org}`;
                      window.open(`mailto:hello@arcticblue.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
                      setContactSubmitted(true);
                    }
                  }}
                  disabled={!contactForm.name || !contactForm.email || !contactForm.org}
                  style={{
                    padding: "10px 28px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600,
                    cursor: contactForm.name && contactForm.email && contactForm.org ? "pointer" : "not-allowed",
                    background: contactForm.name && contactForm.email && contactForm.org ? `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentDim})` : "rgba(255,255,255,0.08)",
                    color: contactForm.name && contactForm.email && contactForm.org ? BRAND.white : BRAND.gray,
                  }}>
                  Submit Request →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: `linear-gradient(135deg, rgba(52,195,143,0.1), rgba(58,175,219,0.06))`, borderRadius: 14, padding: "24px 20px", textAlign: "center", border: `1px solid ${BRAND.green}30`, marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.green, marginBottom: 6 }}>Request Submitted</div>
              <p style={{ fontSize: 12, color: BRAND.frost, opacity: 0.7, margin: "0 0 16px" }}>
                We'll reach out to {contactForm.email} within 48 hours to schedule a brief call.
              </p>
              <button onClick={() => { setScreen("welcome"); setCurrentQ(0); setAnswers({}); setRole(null); setOrgName(""); setLocked(false); setSelectedIndex(null); setShowContactForm(false); setContactSubmitted(false); setContactForm({ name: "", email: "", org: "", size: "", message: "" }); setAssessmentId(null); hasSaved.current = false; }}
                style={{ padding: "10px 24px", borderRadius: 8, border: `1px solid ${BRAND.accent}`, background: "transparent", color: BRAND.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Start Over
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: BRAND.gray }}>
            © ArcticMind {new Date().getFullYear()} · AI Readiness Assessment v2.0
          </div>
        </div>
      </div>
    );
  }

  return null;
}
