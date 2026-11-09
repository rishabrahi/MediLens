import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Droplets,
  FileText,
  Footprints,
  HeartPulse,
  Home,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Moon,
  Phone,
  Pill,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type TabType = 'home' | 'ask' | 'symptoms' | 'report' | 'reminders';
type LanguageType = 'hi' | 'en';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isEmergency?: boolean;
}

interface Reminder {
  id: string;
  type: 'medicine' | 'appointment';
  title: string;
  dateTime: string;
  notes?: string;
  completed: boolean;
  alarmAt?: number;
  alarmDone?: boolean;
}

type Mood = 'good' | 'okay' | 'low' | 'stressed';

interface DailyCheckIn {
  date: string;
  mood: Mood | null;
  sleepHours: number | null;
  waterCups: number;
  movementDone: boolean;
}

type AnswerKind = 'plain' | 'caution' | 'questions' | 'labs' | 'emergency';

interface AnswerBlock {
  title: string;
  kind: AnswerKind;
  lines: string[];
}

function tx(lang: LanguageType, en: string, hi: string) {
  return lang === 'hi' ? hi : en;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDailyCheckIn(): DailyCheckIn {
  return {
    date: getLocalDateKey(),
    mood: null,
    sleepHours: null,
    waterCups: 0,
    movementDone: false,
  };
}

function loadDailyCheckIn(): DailyCheckIn {
  const empty = createDailyCheckIn();
  try {
    const saved = localStorage.getItem('medilens_daily_check_in');
    if (!saved) return empty;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return empty;

    const value = parsed as Partial<DailyCheckIn>;
    if (value.date !== empty.date) return empty;

    return {
      date: empty.date,
      mood: value.mood === 'good' || value.mood === 'okay' || value.mood === 'low' || value.mood === 'stressed'
        ? value.mood
        : null,
      sleepHours: typeof value.sleepHours === 'number' && value.sleepHours >= 0 && value.sleepHours <= 24
        ? value.sleepHours
        : null,
      waterCups: typeof value.waterCups === 'number'
        ? Math.max(0, Math.min(20, Math.floor(value.waterCups)))
        : 0,
      movementDone: value.movementDone === true,
    };
  } catch {
    return empty;
  }
}

function stripMarks(line: string) {
  return line.replace(/^[\s]*[\p{Extended_Pictographic}\u200d\uFE0F]+\s*/gu, '').trim();
}

function kindFor(title: string): AnswerKind {
  const n = title.toLowerCase();
  if (/emergency|immediate|आपात|तुरंत/.test(n)) return 'emergency';
  if (/good to know|ध्यान|सावधान|warning/.test(n)) return 'caution';
  if (/question|सवाल|पूछ/.test(n)) return 'questions';
  if (/lab|लैब|सार|summary/.test(n)) return 'labs';
  return 'plain';
}

function parseAnswer(raw: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let current: AnswerBlock | null = null;

  const push = () => {
    if (current && (current.title || current.lines.length)) blocks.push(current);
  };

  for (const rawLine of raw.replace(/\r/g, '').split('\n')) {
    const line = stripMarks(rawLine);
    if (!line) continue;

    const headingOnly = line.match(/^([^0-9]{3,80}?)\s*[:：]\s*$/);
    if (headingOnly) {
      push();
      const title = headingOnly[1].trim();
      current = { title, kind: kindFor(title), lines: [] };
      continue;
    }

    const item = line.replace(/^[•▪◦*-]\s*/, '').replace(/^\d+[.)]\s*/, '');
    if (!current) current = { title: '', kind: 'plain', lines: [] };
    current.lines.push(item);
  }

  push();
  return blocks;
}

function formatWhen(value: string, lang: LanguageType) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function reminderAlarmAt(item: Reminder) {
  if (item.completed || item.alarmDone) return null;
  if (typeof item.alarmAt === 'number' && !Number.isNaN(item.alarmAt)) return item.alarmAt;
  const parsed = new Date(item.dateTime).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

const homeLearningTopics = [
  {
    icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'UNDERSTANDING YOUR BODY', hi: 'अपने शरीर को समझें' },
    title: { en: 'What does blood pressure measure?', hi: 'ब्लड प्रेशर क्या मापता है?' },
    description: { en: 'A plain-language introduction to the numbers and what they describe.', hi: 'नंबरों और उनके अर्थ का आसान परिचय।' },
    prompt: { en: 'What does blood pressure measure?', hi: 'ब्लड प्रेशर क्या मापता है?' },
  },
  {
    icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'LAB REPORT BASICS', hi: 'लैब रिपोर्ट की जानकारी' },
    title: { en: 'How do lab reference ranges work?', hi: 'लैब की संदर्भ सीमाएँ कैसे काम करती हैं?' },
    description: { en: 'Learn why ranges differ and why one result is not a diagnosis.', hi: 'जानें कि सीमाएँ क्यों बदलती हैं और एक नतीजा निदान क्यों नहीं है।' },
    prompt: { en: 'How do lab reference ranges work?', hi: 'लैब की संदर्भ सीमाएँ कैसे काम करती हैं?' },
  },
  {
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'GETTING PREPARED', hi: 'तैयारी करें' },
    title: { en: 'What should I ask at an appointment?', hi: 'डॉक्टर से मिलने पर क्या पूछें?' },
    description: { en: 'A simple way to organize questions and information before a visit.', hi: 'मुलाक़ात से पहले सवाल और जानकारी व्यवस्थित करने का आसान तरीका।' },
    prompt: { en: 'What are useful questions to prepare for a doctor appointment?', hi: 'डॉक्टर से मिलने से पहले कौन से उपयोगी सवाल तैयार करूँ?' },
  },
  {
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'HEALTHY HABITS', hi: 'सेहतमंद आदतें' },
    title: { en: 'Why does consistent sleep matter?', hi: 'नियमित नींद क्यों ज़रूरी है?' },
    description: { en: 'A general look at sleep and the body, without one-size-fits-all promises.', hi: 'नींद और शरीर के बारे में सामान्य जानकारी, बिना पक्के दावों के।' },
    prompt: { en: 'Why is a consistent sleep routine helpful for general health?', hi: 'सेहत के लिए नियमित नींद की दिनचर्या क्यों मददगार है?' },
  },
  {
    icon: <FileText className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'LAB REPORT BASICS', hi: 'लैब रिपोर्ट की जानकारी' },
    title: { en: 'What is a complete blood count?', hi: 'कम्प्लीट ब्लड काउंट क्या है?' },
    description: { en: 'Get familiar with the kinds of information this common test reports.', hi: 'इस आम जाँच में मिलने वाली जानकारी से परिचित हों।' },
    prompt: { en: 'What information does a complete blood count usually include?', hi: 'कम्प्लीट ब्लड काउंट में आमतौर पर कौन सी जानकारी होती है?' },
  },
  {
    icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'UNDERSTANDING YOUR BODY', hi: 'अपने शरीर को समझें' },
    title: { en: 'What does body temperature tell us?', hi: 'शरीर का तापमान क्या बताता है?' },
    description: { en: 'Understand temperature as one piece of health information, not the whole picture.', hi: 'तापमान को सेहत की एक जानकारी समझें, पूरी तस्वीर नहीं।' },
    prompt: { en: 'What does body temperature tell us, and what are its limits?', hi: 'शरीर का तापमान क्या बताता है और इसकी सीमाएँ क्या हैं?' },
  },
  {
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'GETTING PREPARED', hi: 'तैयारी करें' },
    title: { en: 'How can I keep track of symptoms?', hi: 'लक्षणों का रिकॉर्ड कैसे रखें?' },
    description: { en: 'Simple details to note so you can describe changes clearly to a clinician.', hi: 'बदलावों को डॉक्टर को साफ़-साफ़ बताने के लिए आसान बातें नोट करें।' },
    prompt: { en: 'What details are useful to track when I notice a symptom?', hi: 'लक्षण होने पर कौन सी जानकारी लिखना उपयोगी है?' },
  },
  {
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'MEDICINE SAFETY', hi: 'दवा की सुरक्षा' },
    title: { en: 'How do I read a medicine label?', hi: 'दवा का लेबल कैसे पढ़ें?' },
    description: { en: 'Learn what label sections mean and when to ask a pharmacist.', hi: 'लेबल के हिस्सों का मतलब जानें और कब फार्मासिस्ट से पूछें।' },
    prompt: { en: 'What information is usually shown on a medicine label?', hi: 'दवा के लेबल पर आमतौर पर कौन सी जानकारी होती है?' },
  },
  {
    icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'UNDERSTANDING YOUR BODY', hi: 'अपने शरीर को समझें' },
    title: { en: 'Why can hydration matter?', hi: 'शरीर में पानी क्यों ज़रूरी है?' },
    description: { en: 'A general explanation of the role fluids play in everyday body functions.', hi: 'रोज़मर्रा के शारीरिक कामों में पानी की भूमिका की सामान्य जानकारी।' },
    prompt: { en: 'Why does the body need water for everyday functions?', hi: 'रोज़मर्रा के कामों के लिए शरीर को पानी क्यों चाहिए?' },
  },
  {
    icon: <FileText className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'LAB REPORT BASICS', hi: 'लैब रिपोर्ट की जानकारी' },
    title: { en: 'Why might a lab ask me to fast?', hi: 'लैब जाँच से पहले उपवास क्यों कह सकती है?' },
    description: { en: 'Understand why preparation instructions vary by test and should be confirmed.', hi: 'जानें कि जाँच की तैयारी अलग-अलग क्यों होती है और पुष्टि क्यों ज़रूरी है।' },
    prompt: { en: 'Why do some lab tests have fasting instructions?', hi: 'कुछ लैब जाँचों में उपवास की हिदायत क्यों होती है?' },
  },
  {
    icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
    category: { en: 'GETTING PREPARED', hi: 'तैयारी करें' },
    title: { en: 'How can I understand health information?', hi: 'स्वास्थ्य जानकारी को कैसे समझें?' },
    description: { en: 'A few useful checks for sources, context, and when to seek professional advice.', hi: 'स्रोत, संदर्भ और पेशेवर सलाह के बारे में कुछ उपयोगी बातें।' },
    prompt: { en: 'How can I check whether health information is trustworthy?', hi: 'स्वास्थ्य जानकारी भरोसेमंद है या नहीं, यह कैसे जाँचें?' },
  },
];

function startAlarmSound(ctx: AudioContext) {
  let timer = 0;
  let active = true;

  const pulse = () => {
    if (!active || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    [880, 660].forEach((frequency, index) => {
      const start = now + index * 0.42;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    navigator.vibrate?.([280, 120, 280, 120, 420]);
  };

  const arm = () => {
    if (!active) return;
    pulse();
    timer = window.setInterval(pulse, 1500);
  };

  if (ctx.state === 'suspended') void ctx.resume().then(arm);
  else arm();

  return () => {
    active = false;
    window.clearInterval(timer);
    navigator.vibrate?.(0);
  };
}

const primaryBtn =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 text-base font-semibold text-white transition-colors hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 transition-colors hover:bg-slate-50';
const fieldClass =
  'w-full min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/30';

function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white"
      style={{ width: size, height: size }}
    >
      <svg className="h-[55%] w-[55%]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" strokeWidth="2.2"></circle>
        <line x1="21" y1="21" x2="16" y2="16" strokeWidth="2.2"></line>
        <line x1="11" y1="8" x2="11" y2="14" strokeWidth="2.2"></line>
        <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2.2"></line>
      </svg>
    </span>
  );
}

function LanguageSwitch({
  lang,
  onChange,
}: {
  lang: LanguageType;
  onChange: (lang: LanguageType) => void;
}) {
  const option = (id: LanguageType, label: string) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={lang === id}
      className={`min-h-11 min-w-16 rounded-lg px-3 text-sm font-semibold transition-colors ${
        lang === id ? 'bg-[#0f766e] text-white' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1" role="group" aria-label="Language">
      {option('en', 'English')}
      {option('hi', 'हिन्दी')}
    </div>
  );
}

function LoadingNote({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700" role="status">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0f766e]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function StructuredAnswer({ text, emergency, lang }: { text: string; emergency?: boolean; lang: LanguageType }) {
  const blocks = parseAnswer(text).filter((block) => block.kind !== 'caution' && block.kind !== 'questions');
  const showCall = emergency || blocks.some((block) => block.kind === 'emergency');

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const Icon =
          block.kind === 'emergency'
            ? AlertTriangle
            : block.kind === 'labs'
              ? FileText
              : Info;
        const tone =
          block.kind === 'emergency'
            ? 'border-red-200 bg-red-50 text-red-950'
            : 'border-slate-200 bg-white text-slate-800';
        const iconTone = block.kind === 'emergency' ? 'text-red-700' : 'text-[#0f766e]';

        return (
          <section key={`${block.title}-${index}`} className={`rounded-xl border p-4 ${tone}`}>
            {block.title && (
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Icon className={`h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
                {block.title}
              </h3>
            )}
            {block.lines.length > 1 || block.kind === 'labs' ? (
              <ul className={`${block.title ? 'mt-3' : ''} list-disc space-y-2 pl-5 text-base leading-relaxed`}>
                {block.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              block.lines.map((line) => (
                <p key={line} className={`${block.title ? 'mt-3' : ''} text-base leading-relaxed`}>
                  {line}
                </p>
              ))
            )}
          </section>
        );
      })}

      {showCall && (
        <a href="tel:112" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-4 text-base font-semibold text-white hover:bg-red-800">
          <Phone className="h-5 w-5" aria-hidden="true" />
          {tx(lang, 'Call 112 now', 'अभी 112 पर कॉल करें')}
        </a>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [lang, setLang] = useState<LanguageType>('en');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('medilens_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [dailyCheckIn, setDailyCheckIn] = useState<DailyCheckIn>(loadDailyCheckIn);
  const [quickQuestion, setQuickQuestion] = useState('');
  const homeQuestionInputRef = useRef<HTMLInputElement>(null);
  const [visibleHomeTopics, setVisibleHomeTopics] = useState(4);
  const homeTopicsSentinelRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [symptomStep, setSymptomStep] = useState<1 | 2 | 3>(1);
  const [symptomText, setSymptomText] = useState('');
  const [symptomDuration, setSymptomDuration] = useState('2-3 days');
  const [symptomSeverity, setSymptomSeverity] = useState('Mild');
  const [symptomResult, setSymptomResult] = useState<{ content?: string; status?: string } | null>(null);
  const [symptomLoading, setSymptomLoading] = useState(false);

  const [reportInput, setReportInput] = useState('');
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportReading, setReportReading] = useState(false);
  const [reportNotice, setReportNotice] = useState('');

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('medilens_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [remType, setRemType] = useState<'medicine' | 'appointment'>('medicine');
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [remNotes, setRemNotes] = useState('');
  const [ringingId, setRingingId] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const stopAlarmRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (activeTab !== 'home') return;
    const input = homeQuestionInputRef.current;
    if (!input) return;

    const prompts = lang === 'hi'
      ? [
        'ब्लड प्रेशर क्या बताता है?',
        'लैब रिपोर्ट कैसे समझें?',
        'नींद सेहत के लिए क्यों ज़रूरी है?',
      ]
      : [
        'What does blood pressure tell us?',
        'How do I read a lab report?',
        'Why does sleep matter for health?',
      ];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let promptIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer = 0;

    const typeNextCharacter = () => {
      if (input.value || document.activeElement === input) {
        input.placeholder = tx(lang, 'What would you like to understand?', 'आप क्या समझना चाहते हैं?');
        timer = window.setTimeout(typeNextCharacter, 500);
        return;
      }

      const prompt = prompts[promptIndex];
      characterIndex += deleting ? -1 : 1;
      input.placeholder = prompt.slice(0, characterIndex);

      if (!deleting && characterIndex === prompt.length) {
        deleting = true;
        timer = window.setTimeout(typeNextCharacter, reducedMotion ? 2600 : 1800);
        return;
      }

      if (deleting && characterIndex === 0) {
        deleting = false;
        promptIndex = (promptIndex + 1) % prompts.length;
      }

      timer = window.setTimeout(typeNextCharacter, reducedMotion ? 160 : deleting ? 38 : 72);
    };

    if (reducedMotion) {
      input.placeholder = prompts[0];
      return;
    }

    timer = window.setTimeout(typeNextCharacter, 450);
    return () => window.clearTimeout(timer);
  }, [activeTab, lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    try {
      localStorage.setItem('medilens_theme', isDarkMode ? 'dark' : 'light');
    } catch {
      setStatusMessage(tx(lang, 'Your theme changed, but this browser could not save the preference.', 'थीम बदल गई, लेकिन ब्राउज़र इसे सहेज नहीं सका।'));
    }
  }, [isDarkMode, lang]);

  useEffect(() => {
    const refreshDailyCheckIn = () => {
      const today = getLocalDateKey();
      setDailyCheckIn((current) => current.date === today ? current : createDailyCheckIn());
    };
    const timer = window.setInterval(refreshDailyCheckIn, 60_000);
    document.addEventListener('visibilitychange', refreshDailyCheckIn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDailyCheckIn);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('medilens_daily_check_in', JSON.stringify(dailyCheckIn));
    } catch {
      setStatusMessage(tx(lang, 'Your daily check-in could not be saved in this browser.', 'आज की जानकारी इस ब्राउज़र में सहेजी नहीं जा सकी।'));
    }
  }, [dailyCheckIn]);

  useEffect(() => {
    if (activeTab !== 'home' || visibleHomeTopics >= homeLearningTopics.length) return;
    const sentinel = homeTopicsSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleHomeTopics((count) => Math.min(count + 4, homeLearningTopics.length));
      }
    }, { rootMargin: '240px 0px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, visibleHomeTopics]);

  useEffect(() => {
    setSymptomDuration(lang === 'hi' ? '2-3 दिन' : '2-3 days');
    setSymptomSeverity(lang === 'hi' ? 'हल्की' : 'Mild');
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    const ringing = reminders.find((item) => item.id === ringingId);
    document.title = ringing
      ? tx(lang, `Reminder: ${ringing.title}`, `याद: ${ringing.title}`)
      : tx(
        lang,
        'MediLens - Understand Your Health Simply',
        'MediLens - अपनी सेहत को आसानी से समझें'
      );
  }, [lang, ringingId, reminders]);

  useEffect(() => {
    const due = () => reminders
      .map((item) => ({ item, at: reminderAlarmAt(item) }))
      .filter((entry): entry is { item: Reminder; at: number } => entry.at !== null && entry.at <= Date.now())
      .sort((a, b) => a.at - b.at)[0]?.item;

    const tick = () => {
      if (ringingId) return;
      const next = due();
      if (next) setRingingId(next.id);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reminders, ringingId]);

  useEffect(() => {
    if (!ringingId) return;
    const reminder = reminders.find((item) => item.id === ringingId);
    if (!reminder) return;

    const ctx = audioRef.current;
    if (ctx) stopAlarmRef.current = startAlarmSound(ctx);

    let notification: Notification | null = null;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        notification = new Notification(tx(lang, 'Reminder', 'याद'), {
          body: reminder.notes ? `${reminder.title}. ${reminder.notes}` : reminder.title,
          tag: `medilens-${reminder.id}`,
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          notification?.close();
        };
      }
    } catch {
      notification = null;
    }

    return () => {
      stopAlarmRef.current?.();
      stopAlarmRef.current = null;
      notification?.close();
    };
  }, [ringingId]);

  useEffect(() => {
    try {
      localStorage.setItem('medilens_reminders', JSON.stringify(reminders));
    } catch (e) {
      console.error(e);
    }
  }, [reminders]);

  useEffect(() => {
    if (activeTab === 'ask' && chatMessages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const toggleSpeechRecognition = (onTranscript: (t: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage(tx(
        lang,
        'Voice input is not supported in this browser. Type your question, or use Chrome or Edge.',
        'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। सवाल टाइप करें, या Chrome या Edge का उपयोग करें।'
      ));
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recog = new SpeechRecognition();
      recog.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recog.interimResults = false;
      recog.continuous = false;
      recog.onstart = () => setIsListening(true);
      recog.onresult = (ev: any) => {
        const text = ev.results[0][0].transcript;
        if (text) onTranscript(text);
      };
      recog.onerror = () => setIsListening(false);
      recog.onend = () => setIsListening(false);
      recognitionRef.current = recog;
      recog.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSendChat = async (queryText?: string) => {
    const textToSend = (queryText || chatInput).trim();
    if (!textToSend || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/groq/explain-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend, language: lang }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.content || data.error || tx(lang, 'Sorry, a response could not be retrieved.', 'क्षमा करें, जवाब नहीं मिल सका।'),
          isEmergency: data.status === 'emergency',
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: tx(
            lang,
            `About the problem:
- This kind of symptom often comes from tiredness, too little fluid, or physical strain.
- It can feel like pain, pressure, or a general sense of being unwell.

Possible causes:
- Not drinking enough water can make the body tired and the discomfort stronger.
- Poor sleep or stress can tighten muscles and cause pain.
- Extra physical effort can leave the same kind of feeling afterward.

What usually helps:
- Rest gives the body time to recover.
- Drinking water through the day can ease problems linked to fluid loss.
- See a doctor if it gets severe, lasts more than 2 days, or comes with trouble breathing.

Questions for Your Doctor:
1. What is the most likely cause in my case?
2. Which home-care steps are safe for me?
3. Which warning signs mean I should be seen sooner?`,
            `समस्या के बारे में:
- यह तकलीफ़ अक्सर थकान, पानी की कमी, या शारीरिक जोर से जुड़ी होती है।
- इसमें दर्द, दबाव, या बेचैनी महसूस हो सकती है।

संभावित कारण:
- कम पानी पीने से शरीर थक जाता है और तकलीफ़ बढ़ सकती है।
- कम नींद या तनाव मांसपेशियों को कस सकता है।
- ज़्यादा शारीरिक मेहनत के बाद भी ऐसा महसूस हो सकता है।

आमतौर पर क्या मदद करता है:
- आराम से शरीर को संभलने का समय मिलता है।
- दिन भर थोड़ा-थोड़ा पानी पीना मदद कर सकता है।
- अगर तकलीफ़ तेज़ हो, 2 दिन से ज़्यादा रहे, या साँस में दिक्कत हो, तो डॉक्टर को दिखाएँ।

डॉक्टर से पूछने के सवाल:
1. मेरे मामले में सबसे संभावित कारण क्या है?
2. घर पर कौन सी देखभाल सुरक्षित है?
3. किन संकेतों पर मुझे जल्दी आना चाहिए?`
          ),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSymptomNext = async () => {
    if (symptomStep === 1) {
      if (!symptomText.trim()) return;
      setSymptomStep(2);
      return;
    }

    if (symptomStep !== 2) return;

    setSymptomLoading(true);
    setSymptomStep(3);
    const prompt = tx(
      lang,
      `${symptomText} (duration: ${symptomDuration}, severity: ${symptomSeverity})`,
      `${symptomText} (अवधि: ${symptomDuration}, तीव्रता: ${symptomSeverity})`
    );

    try {
      const res = await fetch('/api/groq/explain-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, language: lang }),
      });
      const data = await res.json();
      setSymptomResult({ ...data, content: data.content || data.error });
    } catch {
      setSymptomResult({
        status: 'success',
        content: tx(
          lang,
          `About the problem:
- ${symptomText} is the discomfort you described. It can change with rest, fluid, and how long it has lasted.
- This explanation describes the problem in general. It does not decide the cause for you.

Possible causes:
- Too little water or food can make this kind of discomfort stronger.
- Stress, poor sleep, or physical strain are common everyday triggers.
- An illness can also cause it, which is why a doctor may need to check.

What usually helps:
- Rest reduces extra strain on the body.
- Drinking water through the day helps when fluid loss is part of the problem.
- See a doctor if it becomes severe, lasts more than 2 days, or comes with trouble breathing.

Questions for Your Doctor:
1. What is the most likely cause of my ${symptomText}?
2. Which home-care steps are safe while I wait?
3. Do I need any tests?`,
          `समस्या के बारे में:
- ${symptomText} वह तकलीफ़ है जो आपने बताई। यह आराम, पानी, और अवधि के साथ बदल सकती है।
- यह सामान्य व्याख्या है। यह आपके लिए कारण तय नहीं करती।

संभावित कारण:
- कम पानी या भोजन इस तरह की तकलीफ़ बढ़ा सकता है।
- तनाव, कम नींद, या शारीरिक जोर आम कारण हैं।
- कोई बीमारी भी कारण हो सकती है, इसलिए डॉक्टर जाँच कर सकते हैं।

आमतौर पर क्या मदद करता है:
- आराम शरीर पर अतिरिक्त जोर कम करता है।
- दिन भर पानी पीना तब मदद करता है जब पानी की कमी जुड़ी हो।
- अगर यह तेज़ हो, 2 दिन से ज़्यादा रहे, या साँस में दिक्कत हो, तो डॉक्टर को दिखाएँ।

डॉक्टर से पूछने के सवाल:
1. मेरे ${symptomText} का सबसे संभावित कारण क्या है?
2. इंतज़ार के दौरान कौन सी घरेलू देखभाल सुरक्षित है?
3. क्या किसी जाँच की ज़रूरत है?`
        ),
      });
    } finally {
      setSymptomLoading(false);
    }
  };

  const handleExplainReport = async (source?: string) => {
    const text = (typeof source === 'string' ? source : reportInput).trim();
    if (!text || reportLoading) return;
    setReportLoading(true);
    setReportResult(null);

    try {
      const res = await fetch('/api/groq/explain-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportText: text, language: lang }),
      });
      const data = await res.json();
      setReportResult(data.content || data.error || tx(lang, 'No explanation was returned.', 'कोई स्पष्टीकरण नहीं मिला।'));
    } catch {
      setReportResult(tx(
        lang,
        `Lab Values Summary:
- Hemoglobin: carries oxygen. A value below the printed range is often described as low, but only a clinician can say why.
- Reference ranges differ by lab, age, and the machine used.

In Simple Words:
One number outside a printed range is not a diagnosis. Compare it with your symptoms and earlier reports.

Questions for Your Doctor:
1. Do these values need a diet change, a supplement, or a repeat test?
2. Which result, if any, needs follow-up soon?`,
        `लैब नतीजों का सार:
- हीमोग्लोबिन ऑक्सीजन ले जाता है। छपी सीमा से कम मान को अक्सर कम कहा जाता है, पर कारण डॉक्टर ही बता सकते हैं।
- संदर्भ सीमा लैब, उम्र और मशीन के साथ बदलती है।

सरल शब्दों में:
सीमा से बाहर एक संख्या निदान नहीं है। इसे लक्षणों और पुरानी रिपोर्ट के साथ देखें।

डॉक्टर से पूछने के सवाल:
1. क्या आहार, सप्लीमेंट, या दोबारा जाँच चाहिए?
2. किस नतीजे पर जल्दी ध्यान देना है?`
      ));
    } finally {
      setReportLoading(false);
    }
  };

  const unlockAlarmAudio = () => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioRef.current) audioRef.current = new AudioCtx();
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
  };

  const acknowledgeAlarm = (markDone: boolean) => {
    if (!ringingId) return;
    const id = ringingId;
    setRingingId(null);
    setReminders((current) => current.map((item) => (
      item.id === id ? { ...item, alarmDone: true, completed: markDone ? true : item.completed } : item
    )));
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const dateTime = remDate && remTime ? `${remDate}T${remTime}` : '';
    if (!remTitle.trim() || !dateTime) {
      setStatusMessage(tx(
        lang,
        'Add a name, a date, and a time so the alarm knows when to ring.',
        'नाम, तारीख़ और समय जोड़ें, ताकि अलार्म को बजने का समय पता हो।'
      ));
      return;
    }

    const alarmAt = new Date(dateTime).getTime();
    if (Number.isNaN(alarmAt)) {
      setStatusMessage(tx(lang, 'That date and time could not be read.', 'वह तारीख़ और समय पढ़ा नहीं जा सका।'));
      return;
    }

    unlockAlarmAudio();
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const newRem: Reminder = {
      id: Date.now().toString(),
      type: remType,
      title: remTitle.trim(),
      dateTime,
      notes: remNotes.trim(),
      completed: false,
      alarmAt,
      alarmDone: false,
    };
    setReminders([newRem, ...reminders]);
    setRemTitle('');
    setRemDate('');
    setRemTime('');
    setRemNotes('');
    setStatusMessage(alarmAt <= Date.now()
      ? tx(lang, 'Reminder saved. That time has passed, so the alarm is ringing now.', 'याद सहेज ली गई। वह समय निकल चुका है, इसलिए अलार्म अभी बज रहा है।')
      : tx(
        lang,
        `Reminder saved. It will ring at ${formatWhen(dateTime, lang)} while this tab is open.`,
        `याद सहेज ली गई। यह टैब खुला रहने पर ${formatWhen(dateTime, lang)} पर बजेगी।`
      ));
  };

  const loadSampleReport = () => {
    setReportNotice('');
    setReportInput(tx(
      lang,
      `Hemoglobin (Hb): 10.5 g/dL (Reference: 13.0 - 17.0 g/dL)
White Blood Cells (WBC): 12,400 /mcL (Reference: 4,500 - 11,000 /mcL)
Vitamin D (25-OH): 22 ng/mL (Reference: 30 - 100 ng/mL)
Fasting Blood Sugar: 98 mg/dL (Reference: 70 - 99 mg/dL)`,
      `हीमोग्लोबिन (Hemoglobin): 10.5 g/dL (सामान्य सीमा: 13.0 - 17.0)
श्वेत रक्त कोशिकाएं (WBC): 12,400 /mcL (सामान्य सीमा: 4,500 - 11,000)
विटामिन डी (Vitamin D): 22 ng/mL (सामान्य सीमा: 30 - 100)
फास्टिंग ब्लड शुगर (Fasting Glucose): 98 mg/dL (सामान्य सीमा: 70 - 99)`
    ));
  };

  const readImageAsJpeg = (file: File) => new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('canvas'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image'));
    };
    image.src = objectUrl;
  });

  const handleReportFile = async (file: File) => {
    const isText = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
    const isImage = /^image\/(jpeg|jpg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

    if (isText) {
      const reader = new FileReader();
      reader.onload = () => {
        setReportNotice(tx(lang, `Loaded text from ${file.name}.`, `${file.name} का टेक्स्ट लोड हो गया।`));
        setReportInput(String(reader.result || ''));
      };
      reader.onerror = () => {
        setReportNotice(tx(lang, 'That file could not be read. Paste the results instead.', 'यह फ़ाइल नहीं पढ़ी जा सकी। नतीजे चिपकाएँ।'));
      };
      reader.readAsText(file);
      return;
    }

    if (!isImage) {
      setReportNotice(tx(
        lang,
        `${file.name} was not read. Upload a JPG, PNG, or WebP photo, a .txt file, or paste the results. PDF files are not read here.`,
        `${file.name} नहीं पढ़ी गई। JPG, PNG, या WebP फ़ोटो, .txt फ़ाइल अपलोड करें, या नतीजे चिपकाएँ। PDF यहाँ नहीं पढ़ी जाती।`
      ));
      return;
    }

    setReportReading(true);
    setReportResult(null);
    setReportNotice(tx(
      lang,
      `Reading the text in ${file.name}…`,
      `${file.name} में लिखा टेक्स्ट पढ़ा जा रहा है…`
    ));

    try {
      const image = await readImageAsJpeg(file);
      const res = await fetch('/api/groq/image-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) {
        setReportNotice(data.error || tx(lang, 'The photo could not be turned into text.', 'फ़ोटो को टेक्स्ट में नहीं बदला जा सका।'));
        return;
      }
      setReportInput(data.text);
      setReportReading(false);
      setReportNotice(tx(
        lang,
        'The photo was turned into text below. That text is now being explained.',
        'फ़ोटो का टेक्स्ट नीचे आ गया है। अब उसी टेक्स्ट की व्याख्या हो रही है।'
      ));
      await handleExplainReport(data.text);
    } catch {
      setReportNotice(tx(
        lang,
        'The photo could not be read. Try a clearer picture or paste the results.',
        'फ़ोटो नहीं पढ़ी जा सकी। साफ़ तस्वीर आज़माएँ या नतीजे चिपकाएँ।'
      ));
    } finally {
      setReportReading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: tx(lang, 'Home', 'होम'), icon: <Home className="h-4 w-4" aria-hidden="true" /> },
    { id: 'ask', label: tx(lang, 'Ask', 'पूछें'), icon: <MessageCircle className="h-4 w-4" aria-hidden="true" /> },
    { id: 'symptoms', label: tx(lang, 'Symptoms', 'लक्षण'), icon: <Stethoscope className="h-4 w-4" aria-hidden="true" /> },
    { id: 'report', label: tx(lang, 'Report', 'रिपोर्ट'), icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
    { id: 'reminders', label: tx(lang, 'Reminders', 'यादें'), icon: <Bell className="h-4 w-4" aria-hidden="true" /> },
  ];

  const updateDailyCheckIn = (update: Partial<Omit<DailyCheckIn, 'date'>>) => {
    setDailyCheckIn((current) => ({ ...current, ...update, date: getLocalDateKey() }));
  };
  const dailyMoodOptions: { id: Mood; emoji: string; en: string; hi: string }[] = [
    { id: 'good', emoji: '🙂', en: 'Good', hi: 'अच्छा' },
    { id: 'okay', emoji: '😐', en: 'Okay', hi: 'ठीक' },
    { id: 'low', emoji: '😔', en: 'Low', hi: 'उदास' },
    { id: 'stressed', emoji: '😟', en: 'Stressed', hi: 'तनाव' },
  ];
  const durationOptions = [
    { hi: 'आज से', en: 'Since today' },
    { hi: '2-3 दिन', en: '2-3 days' },
    { hi: '1 हफ़्ते+', en: 'Over a week' },
  ];
  const severityOptions = [
    { hi: 'हल्की', en: 'Mild' },
    { hi: 'मध्यम', en: 'Moderate' },
    { hi: 'काफ़ी तेज़', en: 'Severe' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex min-h-12 items-center gap-3 rounded-xl pr-2 text-left"
          >
            <LogoMark />
            <span>
              <span className="block text-lg font-bold leading-tight">MediLens</span>
              <span className="hidden text-sm text-slate-600 sm:block">
                {tx(lang, 'Health explanations, not a diagnosis', 'स्वास्थ्य की व्याख्या, निदान नहीं')}
              </span>
            </span>
          </button>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label={tx(lang, 'Primary', 'मुख्य')}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-50 text-[#0f766e]'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <LanguageSwitch lang={lang} onChange={setLang} />
            <button
              type="button"
              onClick={() => setIsDarkMode((dark) => !dark)}
              aria-label={isDarkMode ? tx(lang, 'Switch to light mode', 'लाइट मोड चालू करें') : tx(lang, 'Switch to dark mode', 'डार्क मोड चालू करें')}
              aria-pressed={isDarkMode}
              title={isDarkMode ? tx(lang, 'Switch to light mode', 'लाइट मोड चालू करें') : tx(lang, 'Switch to dark mode', 'डार्क मोड चालू करें')}
              className="theme-toggle inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50"
            >
              {isDarkMode
                ? <Sun className="h-5 w-5" aria-hidden="true" />
                : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden" aria-label={tx(lang, 'Primary', 'मुख्य')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
                activeTab === tab.id
                  ? 'border-[#0f766e] bg-teal-50 text-[#0f766e]'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {statusMessage && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-3 text-base text-slate-800">
            <p>{statusMessage}</p>
            <button
              type="button"
              onClick={() => setStatusMessage('')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label={tx(lang, 'Dismiss message', 'संदेश बंद करें')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setShowSettings(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h2 id="settings-title" className="text-xl font-semibold text-slate-900">
                {tx(lang, 'Settings', 'सेटिंग्स')}
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
                aria-label={tx(lang, 'Close settings', 'सेटिंग्स बंद करें')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'English and Hindi are in the header on every page. Your theme and daily check-in are saved in this browser. Questions are sent to an AI service to draft an explanation, and reminders stay on this device.',
                'अंग्रेज़ी और हिन्दी का चयन हर पेज के हेडर में है। थीम और दैनिक चेक-इन इसी ब्राउज़र में सहेजे जाते हैं। जवाब का मसौदा बनाने के लिए सवाल एआई सेवा को जाते हैं और यादें इसी डिवाइस पर रहती हैं।'
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('medilens_reminders');
                setReminders([]);
                setRingingId(null);
                setChatMessages([]);
                setShowSettings(false);
                setStatusMessage(tx(
                  lang,
                  'Reminders and this chat were removed from this browser.',
                  'यादें और यह चैट इस ब्राउज़र से हटा दी गईं।'
                ));
              }}
              className={`${secondaryBtn} mt-5 w-full`}
            >
              {tx(lang, 'Clear reminders and chat', 'यादें और चैट साफ़ करें')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          <section className="home-hero relative isolate overflow-hidden rounded-[2rem] bg-[#073b3d] px-6 py-10 text-white shadow-2xl shadow-teal-950/15 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
            <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-teal-300/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-48 left-1/3 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative grid items-center gap-12 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-teal-50">
                  <Sparkles className="h-4 w-4 text-teal-200" aria-hidden="true" />
                  {tx(lang, 'A calmer way to understand health', 'सेहत को समझने का आसान तरीका')}
                </div>
                <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  {tx(lang, 'A little more clarity, for your health.', 'आपकी सेहत के लिए, थोड़ी और स्पष्टता।')}
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-teal-50/85">
                  {tx(
                    lang,
                    'Explore health topics, make sense of lab reports, and keep track of reminders — in everyday English or Hindi.',
                    'स्वास्थ्य विषय समझें, लैब रिपोर्ट पढ़ें और यादें रखें — आसान हिंदी या अंग्रेज़ी में।'
                  )}
                </p>

                <form
                  className="mt-8 flex flex-col gap-2 rounded-2xl border border-white/15 bg-white p-2 shadow-xl shadow-black/10 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!quickQuestion.trim()) {
                      setActiveTab('ask');
                      return;
                    }
                    setChatInput(quickQuestion.trim());
                    setQuickQuestion('');
                    setActiveTab('ask');
                  }}
                >
                  <label className="sr-only" htmlFor="home-question">
                    {tx(lang, 'What would you like to understand?', 'आप क्या समझना चाहते हैं?')}
                  </label>
                  <div className="flex min-h-12 flex-1 items-center gap-3 px-3 text-slate-400">
                    <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <input
                      id="home-question"
                      ref={homeQuestionInputRef}
                      value={quickQuestion}
                      onChange={(event) => setQuickQuestion(event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0"
                      placeholder={tx(lang, 'What would you like to understand?', 'आप क्या समझना चाहते हैं?')}
                    />
                  </div>
                  <button type="submit" className={`${primaryBtn} w-full sm:w-auto`}>
                    {tx(lang, 'Explore', 'जानें')}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-teal-50/75">
                  <span>{tx(lang, 'Try:', 'पूछें:')}</span>
                  {[tx(lang, 'Blood pressure basics', 'ब्लड प्रेशर'), tx(lang, 'Reading lab results', 'लैब रिपोर्ट')].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setChatInput(suggestion);
                        setActiveTab('ask');
                      }}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-left text-teal-50 transition-colors hover:bg-white/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto hidden w-full max-w-sm lg:block" aria-hidden="true">
                <div className="absolute inset-8 rounded-full border border-teal-100/10" />
                <div className="absolute inset-16 rounded-full border border-teal-100/10" />
                <div className="relative rounded-[2rem] border border-white/15 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-teal-50/80">{tx(lang, 'Your health, in context', 'आपकी सेहत, पूरे संदर्भ में')}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-200/15 text-teal-100">
                      <HeartPulse className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="my-8 flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300/10 to-cyan-200/5">
                    <svg viewBox="0 0 300 120" className="w-full px-4 text-teal-200" fill="none" aria-hidden="true">
                      <path d="M8 62h62l18-30 27 59 25-43 18 14h37l17-26 24 52 16-26h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 92h284" stroke="currentColor" strokeOpacity=".2" strokeWidth="1" />
                      <circle cx="158" cy="62" r="6" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/10 p-3">
                      <span className="text-xs text-teal-50/60">{tx(lang, 'Made for clarity', 'स्पष्टता के लिए')}</span>
                      <p className="mt-1 text-sm font-semibold">{tx(lang, 'Everyday language', 'आसान भाषा')}</p>
                    </div>
                    <div className="rounded-xl bg-black/10 p-3">
                      <span className="text-xs text-teal-50/60">{tx(lang, 'Always remember', 'हमेशा याद रखें')}</span>
                      <p className="mt-1 text-sm font-semibold">{tx(lang, 'Education, not diagnosis', 'जानकारी, निदान नहीं')}</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -left-7 top-16 flex items-center gap-2 rounded-xl border border-white/15 bg-[#104f4d] px-3 py-2 text-sm shadow-lg">
                  <CheckCircle2 className="h-4 w-4 text-teal-200" aria-hidden="true" />
                  {tx(lang, 'English + हिन्दी', 'अंग्रेज़ी + हिन्दी')}
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 -mt-5 grid gap-3 px-2 sm:grid-cols-3 sm:px-6" aria-label={tx(lang, 'MediLens tools', 'MediLens उपकरण')}>
            {[
              {
                id: 'symptoms' as TabType,
                icon: <Stethoscope className="h-5 w-5" aria-hidden="true" />,
                title: tx(lang, 'Explore a symptom', 'लक्षण समझें'),
                description: tx(lang, 'A guided, simple explanation', 'आसान चरणों में जानकारी'),
                tint: 'bg-cyan-50 text-cyan-800',
              },
              {
                id: 'report' as TabType,
                icon: <FileText className="h-5 w-5" aria-hidden="true" />,
                title: tx(lang, 'Read a lab report', 'लैब रिपोर्ट पढ़ें'),
                description: tx(lang, 'Paste results or add a photo', 'नतीजे लिखें या फ़ोटो डालें'),
                tint: 'bg-violet-50 text-violet-800',
              },
              {
                id: 'reminders' as TabType,
                icon: <Bell className="h-5 w-5" aria-hidden="true" />,
                title: tx(lang, 'Set a reminder', 'याद सेट करें'),
                description: tx(lang, 'Keep a helpful nudge nearby', 'ज़रूरी याद पास रखें'),
                tint: 'bg-amber-50 text-amber-800',
              },
            ].map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTab(tool.id)}
                className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-lg shadow-slate-900/5 transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl sm:p-5"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tool.tint}`}>
                  {tool.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{tool.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{tool.description}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" />
              </button>
            ))}
          </section>

          <section className="daily-checkin mt-14 rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/60 to-cyan-50/70 p-5 shadow-sm sm:mt-16 sm:p-8" aria-labelledby="daily-checkin-title">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-teal-800">
                  {tx(lang, 'A little pause for you', 'अपने लिए एक छोटा सा पल')}
                </p>
                <h2 id="daily-checkin-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {tx(lang, 'Your daily check-in', 'आज का चेक-इन')}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {tx(lang, 'A gentle space to notice how your day is going. No targets and no judgment.', 'आज का दिन कैसा जा रहा है, इसे समझने की एक छोटी जगह। कोई लक्ष्य नहीं, कोई तुलना नहीं।')}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
                {tx(lang, 'Saved only on this device', 'सिर्फ़ इसी डिवाइस पर सहेजा')}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="daily-option-card rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{tx(lang, 'How are you feeling?', 'आप कैसा महसूस कर रहे हैं?')}</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {dailyMoodOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateDailyCheckIn({ mood: dailyCheckIn.mood === option.id ? null : option.id })}
                      aria-pressed={dailyCheckIn.mood === option.id}
                      aria-label={tx(lang, option.en, option.hi)}
                      title={tx(lang, option.en, option.hi)}
                      className={`mood-option flex min-h-11 items-center justify-center rounded-xl border text-xl transition hover:-translate-y-0.5 ${
                        dailyCheckIn.mood === option.id
                          ? 'selected border-teal-600 bg-teal-50 ring-2 ring-teal-600/20'
                          : 'border-slate-200 bg-slate-50 hover:border-teal-300'
                      }`}
                    >
                      {option.emoji}
                    </button>
                  ))}
                </div>
                <p className="mt-2 min-h-5 text-xs text-slate-600">
                  {dailyCheckIn.mood
                    ? tx(
                      lang,
                      `Today: ${dailyMoodOptions.find((option) => option.id === dailyCheckIn.mood)?.en}`,
                      `आज: ${dailyMoodOptions.find((option) => option.id === dailyCheckIn.mood)?.hi}`
                    )
                    : tx(lang, 'Choose what feels right today.', 'आज जो सही लगे, वह चुनें।')}
                </p>
              </div>

              <div className="daily-option-card rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{tx(lang, 'Water breaks', 'पानी के विराम')}</p>
                <p className="mt-1 text-xs text-slate-600">{tx(lang, 'Log a glass when you have one.', 'पानी पीने पर एक गिलास दर्ज करें।')}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-teal-800">
                    <Droplets className="h-5 w-5" aria-hidden="true" />
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">{dailyCheckIn.waterCups}</span>
                    <span className="text-xs text-slate-600">{tx(lang, 'glasses', 'गिलास')}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateDailyCheckIn({ waterCups: Math.max(0, dailyCheckIn.waterCups - 1) })}
                      disabled={dailyCheckIn.waterCups === 0}
                      className="daily-counter-button min-h-10 min-w-10 rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 hover:bg-teal-50 disabled:opacity-40"
                      aria-label={tx(lang, 'Remove one glass', 'एक गिलास हटाएँ')}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDailyCheckIn({ waterCups: Math.min(20, dailyCheckIn.waterCups + 1) })}
                      disabled={dailyCheckIn.waterCups >= 20}
                      className="min-h-10 min-w-10 rounded-xl bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                      aria-label={tx(lang, 'Log one glass', 'एक गिलास दर्ज करें')}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="daily-option-card rounded-2xl border border-slate-200/80 bg-white p-4">
                <label htmlFor="daily-sleep-hours" className="text-sm font-semibold text-slate-900">
                  {tx(lang, 'Sleep, your way', 'आपकी नींद')}
                </label>
                <p className="mt-1 text-xs text-slate-600">{tx(lang, 'Optional: note last night.', 'वैकल्पिक: पिछली रात दर्ज करें।')}</p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    id="daily-sleep-hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={dailyCheckIn.sleepHours ?? ''}
                    onChange={(event) => {
                      const value = event.target.value === '' ? null : Number(event.target.value);
                      if (value === null || (Number.isFinite(value) && value >= 0 && value <= 24)) {
                        updateDailyCheckIn({ sleepHours: value });
                      }
                    }}
                    className="min-h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                    aria-label={tx(lang, 'Hours of sleep', 'नींद के घंटे')}
                  />
                  <span className="text-sm text-slate-600">{tx(lang, 'hours (optional)', 'घंटे (वैकल्पिक)')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateDailyCheckIn({ movementDone: !dailyCheckIn.movementDone })}
                aria-pressed={dailyCheckIn.movementDone}
                className={`daily-option-card flex min-h-32 flex-col items-start rounded-2xl border p-4 text-left transition hover:border-teal-300 ${
                  dailyCheckIn.movementDone
                    ? 'movement-done border-teal-300 bg-teal-50'
                    : 'border-slate-200/80 bg-white'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  dailyCheckIn.movementDone ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {dailyCheckIn.movementDone
                    ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    : <Footprints className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  {dailyCheckIn.movementDone
                    ? tx(lang, 'Movement break logged', 'चलने का विराम दर्ज हुआ')
                    : tx(lang, 'Take a movement break?', 'चलने का छोटा विराम?')}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-slate-600">
                  {tx(lang, 'A small stretch or walk counts.', 'थोड़ा खिंचाव या टहलना भी ठीक है।')}
                </span>
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {tx(lang, 'Your check-in is for personal reflection, not medical tracking or advice. It resets each day.', 'यह चेक-इन निजी जानकारी के लिए है, मेडिकल निगरानी या सलाह के लिए नहीं। यह हर दिन रीसेट होता है।')}
            </p>
          </section>

          <section className="mt-20 sm:mt-24" aria-labelledby="learning-title">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">
                  {tx(lang, 'A good place to start', 'यहाँ से शुरू करें')}
                </p>
                <h2 id="learning-title" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {tx(lang, 'Curious about your health?', 'अपनी सेहत के बारे में जानें')}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                  {tx(lang, 'Browse simple explainers, one question at a time. Choose a topic to open it in your health chat.', 'आसान जानकारी पढ़ें, एक सवाल के साथ। कोई विषय चुनें और उसे अपनी हेल्थ चैट में खोलें।')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById('learning-feed')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl px-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 sm:self-auto"
              >
                {tx(lang, 'Explore topics', 'विषय देखें')}
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div id="learning-feed" className="mt-8 grid scroll-mt-28 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {homeLearningTopics.slice(0, visibleHomeTopics).map((topic, index) => (
                <button
                  key={topic.title.en}
                  type="button"
                  onClick={() => {
                    setChatInput(topic.prompt[lang]);
                    setActiveTab('ask');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="learning-card group flex min-h-56 flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-950/5 sm:p-6"
                  style={{ animationDelay: `${(index % 4) * 70}ms` }}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800 transition-colors group-hover:bg-teal-100">
                      {topic.icon}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" />
                  </div>
                  <span className="mt-5 text-[11px] font-bold tracking-[0.13em] text-teal-800">{topic.category[lang]}</span>
                  <span className="mt-2 text-lg font-semibold leading-snug text-slate-950">{topic.title[lang]}</span>
                  <span className="mt-2 text-sm leading-relaxed text-slate-600">{topic.description[lang]}</span>
                  <span className="mt-auto pt-5 text-sm font-semibold text-teal-800">
                    {tx(lang, 'Ask MediLens', 'MediLens से पूछें')}
                    <span className="ml-1 inline-block transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
            </div>
            {visibleHomeTopics < homeLearningTopics.length ? (
              <div ref={homeTopicsSentinelRef} className="flex min-h-20 items-center justify-center gap-3 text-sm text-slate-500" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
                {tx(lang, 'More topics as you explore…', 'आगे और विषय देखें…')}
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-slate-500">
                {tx(lang, 'You’re all caught up. Choose a topic above or explore a tool.', 'सभी विषय दिखा दिए गए हैं। ऊपर से कोई विषय या उपकरण चुनें।')}
              </p>
            )}
          </section>

          <section className="mt-20 overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-6 sm:mt-24 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-800 shadow-sm">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {tx(lang, 'Helpful context, with clear boundaries.', 'उपयोगी जानकारी, साफ़ सीमाओं के साथ।')}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  {tx(lang, 'MediLens is designed to explain general health information — not to replace your clinician or make decisions for you.', 'MediLens सामान्य स्वास्थ्य जानकारी समझाता है — यह डॉक्टर की जगह नहीं लेता और आपके लिए निर्णय नहीं करता।')}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  tx(lang, 'Simple explanations, not medical jargon', 'आसान व्याख्या, मुश्किल शब्द नहीं'),
                  tx(lang, 'English and Hindi, side by side', 'अंग्रेज़ी और हिन्दी में'),
                  tx(lang, 'Your reminders stay in this browser', 'आपकी यादें इसी ब्राउज़र में रहती हैं'),
                  tx(lang, 'Urgent symptoms need urgent care', 'गंभीर लक्षणों में तुरंत मदद लें'),
                ].map((item) => (
                  <div key={item} className="flex min-h-16 items-start gap-3 rounded-xl border border-white bg-white/80 p-4 text-sm font-medium leading-relaxed text-slate-800 shadow-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16 mb-4 flex flex-col items-start justify-between gap-5 rounded-2xl bg-slate-950 px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8">
            <div>
              <h2 className="text-xl font-semibold">{tx(lang, 'Not sure where to start?', 'पता नहीं कहाँ से शुरू करें?')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{tx(lang, 'Ask a question in your own words. You can choose Hindi or English.', 'अपने शब्दों में सवाल पूछें। हिंदी या अंग्रेज़ी चुनें।')}</p>
            </div>
            <button type="button" onClick={() => setActiveTab('ask')} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 font-semibold text-white transition hover:bg-teal-400">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              {tx(lang, 'Start a conversation', 'बात शुरू करें')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        </main>
      )}

      {activeTab === 'ask' && (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {tx(lang, 'Ask one health question', 'एक सेहत का सवाल पूछें')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'You will get a clear explanation of the problem, common causes, and what usually helps.',
                'आपको समस्या, आम कारण, और आमतौर पर क्या मदद करता है, यह स्पष्ट रूप से मिलेगा।'
              )}
            </p>
          </section>

          <div className="mt-6 flex-1 space-y-4">
            {chatMessages.length === 0 && !chatLoading && (
              <p className="text-base text-slate-700">
                {tx(lang, 'Try a suggestion, or type your own question.', 'कोई सुझाव चुनें, या अपना सवाल लिखें।')}
              </p>
            )}

            {chatMessages.map((msg) => (
              <div key={msg.id} className={msg.sender === 'user' ? 'flex justify-end' : ''}>
                {msg.sender === 'user' ? (
                  <p className="max-w-[85%] rounded-xl bg-[#0f766e] px-4 py-3 text-base leading-relaxed text-white">
                    {msg.text}
                  </p>
                ) : (
                  <StructuredAnswer text={msg.text} emergency={msg.isEmergency} lang={lang} />
                )}
              </div>
            ))}

            {chatLoading && <LoadingNote label={tx(lang, 'Writing a short explanation…', 'छोटा स्पष्टीकरण लिखा जा रहा है…')} />}
            <div ref={chatBottomRef} />
          </div>

          <div className="sticky bottom-0 mt-6 bg-slate-50 pb-2 pt-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                tx(lang, 'I have a headache', 'मुझे सिरदर्द है'),
                tx(lang, 'What is blood pressure?', 'ब्लड प्रेशर क्या होता है?'),
                tx(lang, 'How do I read a hemoglobin result?', 'हीमोग्लोबिन का नतीजा कैसे पढ़ें?'),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSendChat(suggestion)}
                  className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSendChat();
              }}
            >
              <label htmlFor="health-question" className="mb-2 block text-sm font-semibold text-slate-800">
                {tx(lang, 'Your question', 'आपका सवाल')}
              </label>
              <input
                id="health-question"
                className={fieldClass}
                placeholder={isListening
                  ? tx(lang, 'Listening… speak now', 'सुन रहा है… अब बोलें')
                  : tx(lang, 'Example: What does a mild fever usually mean?', 'उदाहरण: हल्का बुखार आमतौर पर क्या बताता है?')}
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleSpeechRecognition((text) => setChatInput(text))}
                  aria-pressed={isListening}
                  className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-base font-semibold ${
                    isListening ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Mic className="h-5 w-5" aria-hidden="true" />
                  {isListening ? tx(lang, 'Stop', 'रोकें') : tx(lang, 'Speak', 'बोलें')}
                </button>
                <button type="submit" disabled={chatLoading || !chatInput.trim()} className={`${primaryBtn} flex-1`}>
                  <Send className="h-5 w-5" aria-hidden="true" />
                  {tx(lang, 'Send', 'भेजें')}
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

      {activeTab === 'symptoms' && (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {tx(lang, 'Describe one symptom', 'एक लक्षण बताएं')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'Two questions, then one explanation. This does not decide what illness you have.',
                'दो सवाल, फिर एक स्पष्टीकरण। यह तय नहीं करता कि आपको कौन सी बीमारी है।'
              )}
            </p>
          </section>

          {symptomStep < 3 && (
            <p className="mt-6 text-sm font-semibold text-slate-700">
              {tx(lang, `Step ${symptomStep} of 2`, `चरण ${symptomStep} / 2`)}
            </p>
          )}
          {symptomStep < 3 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <div
                className="h-full bg-[#0f766e] transition-[width] duration-300"
                style={{ width: symptomStep === 1 ? '50%' : '100%' }}
              />
            </div>
          )}

          {symptomStep === 1 && (
            <section className="mt-8" aria-labelledby="symptom-question">
              <h2 id="symptom-question" className="text-xl font-semibold text-slate-900">
                {tx(lang, 'What is bothering you?', 'आपको क्या तकलीफ़ है?')}
              </h2>
              <div className="mt-4 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="symptom-text" className="mb-2 block text-sm font-semibold text-slate-800">
                    {tx(lang, 'Symptom', 'लक्षण')}
                  </label>
                  <input
                    id="symptom-text"
                    value={symptomText}
                    onChange={(event) => setSymptomText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSymptomNext();
                    }}
                    className={fieldClass}
                    placeholder={tx(lang, 'Example: headache, fever, stomach ache', 'उदाहरण: सिरदर्द, बुखार, पेट दर्द')}
                    type="text"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toggleSpeechRecognition((text) => setSymptomText(text))}
                  aria-pressed={isListening}
                  aria-label={tx(lang, 'Speak the symptom', 'लक्षण बोलें')}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
                    isListening ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <Mic className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                disabled={!symptomText.trim()}
                onClick={handleSymptomNext}
                className={`${primaryBtn} mt-4 w-full sm:w-auto`}
              >
                {tx(lang, 'Next', 'आगे')}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </section>
          )}

          {symptomStep === 2 && (
            <section className="mt-8 space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {tx(lang, 'How long has this lasted?', 'यह कब से है?')}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" role="radiogroup" aria-label={tx(lang, 'Duration', 'अवधि')}>
                  {durationOptions.map((option) => {
                    const value = lang === 'hi' ? option.hi : option.en;
                    const selected = symptomDuration === value;
                    return (
                      <button
                        key={option.en}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSymptomDuration(value)}
                        className={`min-h-12 rounded-xl border px-3 text-base font-semibold ${
                          selected ? 'border-[#0f766e] bg-[#0f766e] text-white' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {tx(lang, 'How strong is it?', 'यह कितनी तेज़ है?')}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" role="radiogroup" aria-label={tx(lang, 'Severity', 'तीव्रता')}>
                  {severityOptions.map((option) => {
                    const value = lang === 'hi' ? option.hi : option.en;
                    const selected = symptomSeverity === value;
                    return (
                      <button
                        key={option.en}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSymptomSeverity(value)}
                        className={`min-h-12 rounded-xl border px-3 text-base font-semibold ${
                          selected ? 'border-[#0f766e] bg-[#0f766e] text-white' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => setSymptomStep(1)} className={`${secondaryBtn} sm:w-auto`}>
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  {tx(lang, 'Back', 'पीछे')}
                </button>
                <button type="button" onClick={handleSymptomNext} className={`${primaryBtn} sm:flex-1`}>
                  {tx(lang, 'Show the explanation', 'स्पष्टीकरण देखें')}
                </button>
              </div>
            </section>
          )}

          {symptomStep === 3 && (
            <section className="mt-8 space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {tx(lang, `Explanation for ${symptomText || 'this symptom'}`, `${symptomText || 'इस लक्षण'} का स्पष्टीकरण`)}
              </h2>
              {symptomLoading ? (
                <LoadingNote label={tx(lang, 'Preparing the explanation…', 'स्पष्टीकरण तैयार हो रहा है…')} />
              ) : (
                <StructuredAnswer
                  text={symptomResult?.content || tx(lang, 'No explanation was returned.', 'कोई स्पष्टीकरण नहीं मिला।')}
                  emergency={symptomResult?.status === 'emergency'}
                  lang={lang}
                />
              )}
              {!symptomLoading && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setSymptomStep(1);
                      setSymptomText('');
                      setSymptomResult(null);
                    }}
                    className={primaryBtn}
                  >
                    {tx(lang, 'Start another symptom', 'दूसरा लक्षण शुरू करें')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ask');
                      setChatInput(tx(
                        lang,
                        `I have ${symptomText}. What should I watch for?`,
                        `मुझे ${symptomText} है। मुझे किस पर ध्यान रखना चाहिए?`
                      ));
                    }}
                    className={secondaryBtn}
                  >
                    {tx(lang, 'Ask a follow-up', 'और पूछें')}
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {activeTab === 'report' && (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {tx(lang, 'Explain a lab report from text or a photo', 'टेक्स्ट या फ़ोटो से लैब रिपोर्ट समझें')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'Paste the results, or upload a photo. A photo is turned into text first, and that text is what gets explained. This does not decide if you are ill.',
                'नतीजे चिपकाएँ, या फ़ोटो अपलोड करें। फ़ोटो पहले टेक्स्ट बनती है, और वही टेक्स्ट समझाया जाता है। यह तय नहीं करता कि आप बीमार हैं।'
              )}
            </p>
          </section>

          <section className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className={`${secondaryBtn} cursor-pointer ${reportReading || reportLoading ? 'pointer-events-none opacity-60' : ''}`}>
                <Upload className="h-5 w-5" aria-hidden="true" />
                {tx(lang, 'Upload a photo or text file', 'फ़ोटो या टेक्स्ट फ़ाइल अपलोड करें')}
                <input
                  type="file"
                  accept=".txt,text/plain,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  disabled={reportReading || reportLoading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleReportFile(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <button type="button" onClick={loadSampleReport} className="min-h-12 text-left text-base font-semibold text-[#0f766e] underline-offset-2 hover:underline">
                {tx(lang, 'Use a sample report', 'नमूना रिपोर्ट इस्तेमाल करें')}
              </button>
            </div>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'JPG, PNG, and WebP photos are read into text before the explanation. PDF files are not read here, so copy those results into the box.',
                'JPG, PNG, और WebP फ़ोटो व्याख्या से पहले टेक्स्ट बनती हैं। PDF यहाँ नहीं पढ़ी जाती, इसलिए वे नतीजे बॉक्स में कॉपी करें।'
              )}
            </p>
            {reportNotice && (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950" role="status">
                {reportNotice}
              </p>
            )}

            <label htmlFor="report-text" className="mb-2 mt-6 block text-sm font-semibold text-slate-800">
              {tx(lang, 'Report text', 'रिपोर्ट का टेक्स्ट')}
            </label>
            <textarea
              id="report-text"
              rows={6}
              value={reportInput}
              onChange={(event) => setReportInput(event.target.value)}
              className={`${fieldClass} min-h-40 py-3 leading-relaxed`}
              placeholder={tx(
                lang,
                'Hemoglobin 10.5 g/dL (reference 13.0 - 17.0)',
                'हीमोग्लोबिन 10.5 g/dL (सामान्य सीमा 13.0 - 17.0)'
              )}
            />
            <button
              type="button"
              disabled={reportLoading || reportReading || !reportInput.trim()}
              onClick={() => handleExplainReport()}
              className={`${primaryBtn} mt-4 w-full sm:w-auto`}
            >
              {(reportLoading || reportReading) && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {reportReading
                ? tx(lang, 'Reading text from the photo…', 'फ़ोटो से टेक्स्ट पढ़ा जा रहा है…')
                : reportLoading
                ? tx(lang, 'Explaining the results…', 'नतीजे समझाए जा रहे हैं…')
                : tx(lang, 'Explain these results', 'इन नतीजों को समझाएँ')}
            </button>
          </section>

          {reportResult && (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                {tx(lang, 'What these numbers describe', 'ये संख्याएँ क्या बताती हैं')}
              </h2>
              <StructuredAnswer text={reportResult} lang={lang} />
            </section>
          )}
        </main>
      )}

      {activeTab === 'reminders' && (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {tx(lang, 'Reminders saved on this device', 'इस डिवाइस पर सहेजी यादें')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {tx(
                lang,
                'Add a medicine name or a visit and choose when it should ring. The alarm sounds in this tab. If you allow notifications, the browser can also alert you while the tab is in the background. It cannot ring after the browser is closed. This list does not change a prescription.',
                'दवा का नाम या मुलाक़ात जोड़ें और बताएँ कि यह कब बजे। अलार्म इसी टैब में बजता है। सूचना की अनुमति देने पर ब्राउज़र टैब पीछे होने पर भी बता सकता है। ब्राउज़र बंद होने के बाद यह नहीं बजता। यह सूची नुस्खा नहीं बदलती।'
              )}
            </p>
          </section>

          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {tx(lang, 'Add a reminder', 'याद जोड़ें')}
            </h2>
            <form onSubmit={handleAddReminder} className="mt-5 space-y-5">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-800">
                  {tx(lang, 'Type', 'प्रकार')}
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={remType === 'medicine'}
                    onClick={() => setRemType('medicine')}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold ${
                      remType === 'medicine' ? 'border-[#0f766e] bg-teal-50 text-[#0f766e]' : 'border-slate-300 bg-white text-slate-800'
                    }`}
                  >
                    <Pill className="h-5 w-5" aria-hidden="true" />
                    {tx(lang, 'Medicine', 'दवा')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={remType === 'appointment'}
                    onClick={() => setRemType('appointment')}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold ${
                      remType === 'appointment' ? 'border-[#0f766e] bg-teal-50 text-[#0f766e]' : 'border-slate-300 bg-white text-slate-800'
                    }`}
                  >
                    <Calendar className="h-5 w-5" aria-hidden="true" />
                    {tx(lang, 'Doctor visit', 'डॉक्टर से मुलाक़ात')}
                  </button>
                </div>
              </fieldset>

              <div>
                <label htmlFor="reminder-title" className="mb-2 block text-sm font-semibold text-slate-800">
                  {tx(lang, 'Name', 'नाम')}
                </label>
                <input
                  id="reminder-title"
                  type="text"
                  value={remTitle}
                  onChange={(event) => setRemTitle(event.target.value)}
                  placeholder={tx(lang, 'Example: Morning tablets', 'उदाहरण: सुबह की गोलियाँ')}
                  className={fieldClass}
                />
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reminder-date" className="mb-2 block text-sm font-semibold text-slate-800">
                      {tx(lang, 'Date', 'तारीख़')}
                    </label>
                    <input
                      id="reminder-date"
                      type="date"
                      required
                      value={remDate}
                      onChange={(event) => setRemDate(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="reminder-time" className="mb-2 block text-sm font-semibold text-slate-800">
                      {tx(lang, 'Time', 'समय')}
                    </label>
                    <input
                      id="reminder-time"
                      type="time"
                      required
                      step={60}
                      value={remTime}
                      onChange={(event) => setRemTime(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <p className="mt-2 text-base text-slate-700">
                  {tx(lang, 'The alarm rings at this time while this tab stays open.', 'यह टैब खुला रहने पर अलार्म इसी समय बजेगा।')}
                </p>
              </div>

              <div>
                <label htmlFor="reminder-notes" className="mb-2 block text-sm font-semibold text-slate-800">
                  {tx(lang, 'Note, optional', 'टिप्पणी, वैकल्पिक')}
                </label>
                <textarea
                  id="reminder-notes"
                  rows={2}
                  value={remNotes}
                  onChange={(event) => setRemNotes(event.target.value)}
                  className={`${fieldClass} min-h-24 py-3`}
                />
              </div>

              <p className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {tx(
                  lang,
                  'Do not change a dose from this list. Follow the instructions your doctor or pharmacist gave you.',
                  'इस सूची से खुराक न बदलें। डॉक्टर या फ़ार्मासिस्ट के निर्देश का पालन करें।'
                )}
              </p>

              <button type="submit" disabled={!remTitle.trim() || !remDate || !remTime} className={`${primaryBtn} w-full sm:w-auto`}>
                {tx(lang, 'Save reminder', 'याद सहेजें')}
              </button>
            </form>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900">
              {tx(lang, `Saved (${reminders.length})`, `सहेजी गई (${reminders.length})`)}
            </h2>
            {reminders.length === 0 ? (
              <p className="mt-3 text-base text-slate-700">
                {tx(lang, 'No reminders yet. Use the form above to add one.', 'अभी कोई याद नहीं है। ऊपर का फ़ॉर्म इस्तेमाल करें।')}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reminders.map((reminder) => (
                  <li key={reminder.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <input
                      type="checkbox"
                      checked={reminder.completed}
                      onChange={() => {
                        const completed = !reminder.completed;
                        if (completed && reminder.id === ringingId) setRingingId(null);
                        setReminders((current) => current.map((item) => (
                          item.id === reminder.id
                            ? { ...item, completed, alarmDone: completed ? true : item.alarmDone }
                            : item
                        )));
                      }}
                      className="mt-1 h-6 w-6 accent-[#0f766e]"
                      aria-label={tx(lang, `Mark ${reminder.title} done`, `${reminder.title} को पूरा चिह्नित करें`)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0f766e]">
                          {reminder.type === 'medicine' ? <Pill className="h-4 w-4" aria-hidden="true" /> : <Calendar className="h-4 w-4" aria-hidden="true" />}
                          {reminder.type === 'medicine' ? tx(lang, 'Medicine', 'दवा') : tx(lang, 'Visit', 'मुलाक़ात')}
                        </span>
                        <span className={`text-base font-semibold ${reminder.completed ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                          {reminder.title}
                        </span>
                      </p>
                      <p className="mt-1 text-base text-slate-700">
                        {formatWhen(reminder.dateTime, lang)}
                        {!reminder.completed && !reminder.alarmDone && reminderAlarmAt({ ...reminder, completed: false, alarmDone: false })
                          ? ` · ${tx(lang, 'Alarm set', 'अलार्म सेट')}`
                          : ''}
                        {reminder.alarmDone && !reminder.completed ? ` · ${tx(lang, 'Alarm already rang', 'अलार्म बज चुका है')}` : ''}
                        {reminder.notes ? ` · ${reminder.notes}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (reminder.id === ringingId) setRingingId(null);
                        setReminders((current) => current.filter((item) => item.id !== reminder.id));
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-red-50 hover:text-red-800"
                      aria-label={tx(lang, `Delete ${reminder.title}`, `${reminder.title} हटाएँ`)}
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      {ringingId && (() => {
        const ringing = reminders.find((item) => item.id === ringingId);
        if (!ringing) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="alarm-title"
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f766e]">
                <Bell className="h-5 w-5" aria-hidden="true" />
                {tx(lang, 'Reminder', 'याद')}
              </p>
              <h2 id="alarm-title" className="mt-2 text-2xl font-bold text-slate-900">
                {ringing.title}
              </h2>
              <p className="mt-2 text-base text-slate-700">
                {formatWhen(ringing.dateTime, lang)}
                {ringing.notes ? ` · ${ringing.notes}` : ''}
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => acknowledgeAlarm(false)} className={`${primaryBtn} w-full sm:w-auto`}>
                  {tx(lang, 'Stop alarm', 'अलार्म बंद करें')}
                </button>
                <button type="button" onClick={() => acknowledgeAlarm(true)} className={`${secondaryBtn} w-full sm:w-auto`}>
                  {tx(lang, 'Mark done', 'पूरा चिह्नित करें')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <LogoMark size={32} />
            <p className="max-w-xl text-sm leading-relaxed text-slate-700">
              {tx(
                lang,
                'MediLens explains general health information. It does not provide a diagnosis, a prescription, or emergency care.',
                'MediLens सामान्य स्वास्थ्य जानकारी समझाता है। यह निदान, नुस्खा, या आपातकालीन देखभाल नहीं देता।'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowSettings(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {tx(lang, 'Privacy & settings', 'निजता और सेटिंग्स')}
            </button>
            <a href="tel:112" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100">
              <Phone className="h-5 w-5" aria-hidden="true" />
              {tx(lang, 'Emergency: call 112 or 108', 'आपात: 112 या 108 पर कॉल करें')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
