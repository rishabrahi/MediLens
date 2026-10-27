import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '12mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_VISION_MODELS = [
  process.env.GROQ_VISION_MODEL,
  'qwen/qwen3.8-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
].filter((model): model is string => Boolean(model));

const REPORT_TRANSCRIBE_PROMPT = `
You only transcribe text from a laboratory report image.
Copy every visible test name, result, unit, and reference range.
Put one test on each line, for example: Hemoglobin 10.5 g/dL (reference 13.0 - 17.0).
Do not explain, diagnose, or add words that are not printed in the image.
If a word cannot be read, write [unclear] in its place.
Return only the transcribed lines.
`;

// Clear, Complete, Bite-Sized Prompt (Never Truncated or Messy)
const SYSTEM_HEALTHCARE_SAFETY_PROMPT = `
You are MediLens, a healthcare literacy assistant.
Explain the user's health question in complete, everyday language that a non-medical person can understand on the first read.

STRICT INSTRUCTIONS:
1. Be complete. Finish every sentence and every section. Do not stop halfway, do not use "etc.", and do not leave a heading empty.
2. Be clear. Use short sentences. If you use a medical word, explain it in the same sentence in plain words.
3. Cover three things, in this order: what the problem is, the common causes, and what usually helps.
4. Explain each cause on its own line, and say how that cause can lead to the problem.
5. Explain each helpful step on its own line, and say why that step can ease the problem. This is general care, not a personal treatment plan.
6. Do not diagnose the user. Do not name medicines, doses, or a guaranteed cure.
7. Do not repeat the user's question. Answer in {target_language} only.
8. Never include a "Good to Know", "ध्यान देने योग्य बातें", "Questions for Your Doctor", or "डॉक्टर से पूछने के सवाल" section.
9. Put each heading on its own line, with the colon at the end and nothing after it. Put each point on its own following line, starting with "- ".

Use these English headings when the answer language is English:

About the problem:
- [2 to 4 complete sentences. What this is, what the person usually feels, and which body part or process is involved.]

Possible causes:
- [A common cause, explained in one full sentence.]
- [Another common cause, explained in one full sentence.]
- [Another common cause, explained in one full sentence.]
- [One more cause if it is commonly relevant, explained in one full sentence.]

What usually helps:
- [A safe general step, and why it can ease this problem.]
- [Another safe general step, and why it can ease this problem.]
- [Another safe general step, and why it can ease this problem.]
- [When the person should see a doctor, explained in one full sentence.]

Use these Hindi headings when the answer language is Hindi:

समस्या के बारे में:
- [2 से 4 पूरे वाक्य। यह समस्या क्या है, व्यक्ति को क्या महसूस होता है, और शरीर का कौन सा हिस्सा जुड़ा है।]

संभावित कारण:
- [एक आम कारण, एक पूरे वाक्य में।]
- [दूसरा आम कारण, एक पूरे वाक्य में।]
- [तीसरा आम कारण, एक पूरे वाक्य में।]

आमतौर पर क्या मदद करता है:
- [एक सुरक्षित सामान्य कदम, और वह इस समस्या को क्यों हल्का कर सकता है।]
- [दूसरा सुरक्षित सामान्य कदम, और उसका कारण।]
- [तीसरा सुरक्षित सामान्य कदम, और उसका कारण।]
- [डॉक्टर को कब दिखाना चाहिए, एक पूरे वाक्य में।]
`;

const SYSTEM_REPORT_PROMPT = `
You are MediLens, a lab-report literacy assistant.
Explain every pasted test in complete, everyday language. Finish every sentence. Do not use jargon unless you explain it in the same sentence.

STRICT INSTRUCTIONS:
1. Cover every test the user pasted. Do not skip a value.
2. For each test, say what it measures, whether the number is inside or outside the printed range, and what that means in plain words.
3. Then explain common reasons a number can sit outside the range. These are general reasons, not a diagnosis for this person.
4. Then explain general steps that usually help, and why. Do not name medicines, doses, or a guaranteed cure.
5. Say that ranges differ by lab, age, and machine, and one number is not a diagnosis.
6. Answer in {target_language} only. Never include a "Good to Know" or "Questions for Your Doctor" section.
7. Put each heading alone on its line. Put each point on its own line starting with "- ".

Use these English headings when the answer language is English:

Lab Values Summary:
- [Test name]: [What it measures, the person's value compared with the printed range, and what that means in plain words.]

Possible causes:
- [Why this kind of result can happen, in one full sentence.]
- [Another common reason, in one full sentence.]
- [Another common reason, in one full sentence.]

What usually helps:
- [A general next step, and why it can help.]
- [Another general next step, and why it can help.]
- [When to ask a doctor to review the report, in one full sentence.]

Use these Hindi headings when the answer language is Hindi:

लैब नतीजों का सार:
- [जाँच का नाम]: [यह क्या मापती है, मान सीमा के अंदर है या बाहर, और इसका सरल अर्थ।]

संभावित कारण:
- [ऐसा नतीजा क्यों आ सकता है, एक पूरे वाक्य में।]
- [दूसरा आम कारण, एक पूरे वाक्य में।]
- [तीसरा आम कारण, एक पूरे वाक्य में।]

आमतौर पर क्या मदद करता है:
- [एक सामान्य अगला कदम, और वह क्यों मदद कर सकता है।]
- [दूसरा सामान्य कदम, और उसका कारण।]
- [डॉक्टर को रिपोर्ट कब दिखानी चाहिए।]
`;

const PRESCRIPTION_PATTERNS = [
  /\b(prescribe|give me a prescription|what dose of|how many mg of|dosage of|how much (paracetamol|crocin|dolo|ibuprofen|amoxicillin|metformin|azithromycin|antibiotic|aspirin))\b/i,
  /\b(can i take \d+\s*(mg|ml|tablets|pills)|how many tablets|how many pills)\b/i,
  /\b(should i stop\s+(?:taking\s+)?(?:my\s+)?(?:medicine|medication|insulin|metformin|pills|treatment))\b/i,
  /\b(substitute for my medicine|can i double my dose)\b/i,
  /(दवा की खुराक|कितने एमजी|कितनी गोली|क्या मैं दवा बंद कर दूं|एंटीबायोटिक लिखो|नुस्खा बनाओ|पेरासिटामोल की खुराक)/i
];

const EMERGENCY_PATTERNS = [
  /chest\s+(pain|tightness|pressure)|pain\s+in\s+(my\s+)?chest|heart\s+attack/i,
  /short(ness)?\s+of\s+breath|can'?t\s+breathe|cannot\s+breathe|(difficulty|trouble)\s+breathing/i,
  /face\s+droop|slurred\s+speech|weakness\s+on\s+one\s+side|stroke/i,
  /(severe|heavy|uncontrolled)\s+bleeding/i,
  /unconscious|passed\s+out|seizure|fainted/i,
  /suicid|kill\s+myself|want\s+to\s+die|self[-\s]?harm/i,
  /सीने\s*में\s*(दर्द|जकड़न)|(सांस|साँस)\s*(लेने\s*में\s*)?(तकलीफ|दिक्कत)|बेहोश|दौरा|आत्महत्या|(ज़्यादा|ज्यादा)\s*खून/i
];

function generateEducationalFallback(messages: Array<{ role: string; content: string }>) {
  const userMsg = messages.find(m => m.role === 'user')?.content || '';
  const isHindi = /[\u0900-\u097F]/.test(userMsg) || userMsg.toLowerCase().includes('hindi');
  
  if (userMsg.toLowerCase().includes('report') || userMsg.toLowerCase().includes('रिपोर्ट') || userMsg.includes('g/dL') || userMsg.includes('mg/dL')) {
    if (isHindi) {
      return `🧪 लैब रिपोर्ट सारांश:
• रिपोर्ट पैरामीटर्स: आपके द्वारा दिए गए परीक्षण के मान सामान्य सीमाओं की जांच के लिए दर्ज किए गए हैं।

💡 सरल शब्दों में:
प्रयोगशाला की सामान्य सीमाएँ विभिन्न लैब मशीनों और तकनीकों के अनुसार थोड़ी भिन्न हो सकती हैं। कोई भी एक मान अकेले रोग का निदान नहीं करता।

🩺 डॉक्टर से पूछने के सवाल:
1. क्या मेरी इस रिपोर्ट के परिणाम मेरी सेहत और पिछली रिपोर्ट के अनुकूल हैं?
2. क्या मुझे कोई अतिरिक्त जांच या जीवनशैली में बदलाव करने की आवश्यकता है?`;
    }
    return `🧪 Lab Values Summary:
• Laboratory Parameters: The measured values are compared against standard clinical reference ranges.

💡 In Simple Words:
Reference boundaries naturally vary across diagnostic laboratories and equipment. A single parameter outside range is not an automatic diagnosis.

🩺 Questions for Your Doctor:
1. How do these test numbers relate to my symptoms and medical history?
2. Do you recommend any follow-up tests, dietary adjustments, or re-testing?`;
  }

  if (isHindi) {
    return `समस्या के बारे में:
- यह शरीर की एक आम प्रतिक्रिया हो सकती है, जैसे थकान, तनाव, या पानी की कमी।
- व्यक्ति को दर्द, कमजोरी, या बेचैनी महसूस हो सकती है।

संभावित कारण:
- पर्याप्त पानी न पीना शरीर को थका देता है और तकलीफ़ बढ़ा सकता है।
- कम नींद या तनाव मांसपेशियों और सिर में दबाव पैदा कर सकता है।
- ज़्यादा शारीरिक जोर या मौसम का बदलाव भी ऐसी तकलीफ़ ला सकता है।

आमतौर पर क्या मदद करता है:
- आराम करने से शरीर को ठीक होने का समय मिलता है।
- थोड़ा-थोड़ा पानी पीने से पानी की कमी कम हो सकती है।
- अगर तकलीफ़ तेज़ हो, 2 दिन से ज़्यादा रहे, या साँस लेने में दिक्कत हो, तो डॉक्टर को दिखाएँ।

डॉक्टर से पूछने के सवाल:
1. मेरे मामले में इसका सबसे संभावित कारण क्या हो सकता है?
2. घर पर कौन सी देखभाल सुरक्षित है?
3. किन संकेतों पर मुझे तुरंत आना चाहिए?`;
  }

  return `About the problem:
- This kind of symptom is often the body reacting to strain, tiredness, or not enough fluid.
- A person may feel pain, pressure, weakness, or a general sense of being unwell.

Possible causes:
- Too little water can leave the body tired and make discomfort stronger.
- Poor sleep or stress can tighten muscles and create pain or pressure.
- Extra physical effort or a change in weather can also bring on the same feeling.

What usually helps:
- Rest gives the body time to settle.
- Drinking water through the day can ease problems linked to fluid loss.
- See a doctor if it becomes severe, lasts more than 2 days, or comes with trouble breathing.

Questions for Your Doctor:
1. What is the most likely cause in my case?
2. Which home-care steps are safe for me?
3. Which warning signs mean I should be seen sooner?`;
}

async function callGroqChat(messages: Array<{ role: string; content: string }>, maxTokens = 800) {
  if (!GROQ_API_KEY) {
    return {
      content: generateEducationalFallback(messages),
      modelUsed: 'medilens-health-engine',
    };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MediLens-Web/1.0',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      console.warn(`Groq API warning (${response.status}), using intelligent fallback`);
      return {
        content: generateEducationalFallback(messages),
        modelUsed: 'medilens-health-engine',
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return {
      content: content.trim() || generateEducationalFallback(messages),
      modelUsed: data.model || GROQ_MODEL,
    };
  } catch (err) {
    console.warn('Groq fetch error, falling back to local health engine:', err);
    return {
      content: generateEducationalFallback(messages),
      modelUsed: 'medilens-health-engine',
    };
  }
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    groqConfigured: !!GROQ_API_KEY,
    model: GROQ_MODEL,
  });
});

// Topic Explainer API
app.post('/api/groq/explain-topic', async (req: Request, res: Response) => {
  try {
    const { query, language = 'en' } = req.body;
    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'Query is too short. Please provide symptoms or a healthcare topic.' });
    }

    const cleanQuery = query.trim();
    const isHindi = language === 'hi';

    // 1. Deterministic Emergency Check
    const isEmergency = EMERGENCY_PATTERNS.some(re => re.test(cleanQuery));
    if (isEmergency) {
      const emergencyContent = isHindi
        ? `⚠️ आपातकालीन स्थिति (Immediate Care):
आपके बताए लक्षणों में गंभीर स्वास्थ्य खतरे के संकेत हो सकते हैं जिन्हें तुरंत अस्पताल में जांच की आवश्यकता है। स्वयं गाड़ी न चलाएं और उपचार में देरी न करें।

🩺 डॉक्टर से पूछने के सवाल:
1. तुरंत आपातकालीन हेल्पलाइन 112 (या एम्बुलेंस 108) पर कॉल करें।
2. परिवार के सदस्य को सूचित करें और नजदीकी आपातकालीन वार्ड में जाएं।`
        : `⚠️ Immediate Medical Attention Advised:
Your symptoms indicate potential high-urgency red flags that need immediate in-person medical evaluation. Do not delay care or drive yourself to the clinic.

🩺 Questions for Your Doctor:
1. Please call 112 (or 108 in India) immediately for emergency medical transport.
2. Inform family or friends and go to the nearest hospital emergency room now.`;

      return res.json({
        status: 'emergency',
        content: emergencyContent,
        modelUsed: 'deterministic-safety-engine',
        language,
      });
    }

    // 2. Deterministic Prescription & Dosage Interception
    const isPrescriptionRequest = PRESCRIPTION_PATTERNS.some(re => re.test(cleanQuery));
    if (isPrescriptionRequest) {
      const prescriptionContent = isHindi
        ? `💡 सरल शब्दों में:
MediLens केवल स्वास्थ्य साक्षरता के लिए है और यह किसी दवा का नुस्खा नहीं लिख सकता और न ही खुराक बता सकता है। सुरक्षित खुराक उम्र, वजन और सेहत पर निर्भर करती है, इसलिए बिना डॉक्टर की सलाह के दवा न लें।

🩺 डॉक्टर से पूछने के सवाल:
1. मेरी सेहत और बीमारी के अनुसार इस दवा की सही खुराक और समय क्या होना चाहिए?
2. क्या इस दवा के कोई साइड इफेक्ट्स या खान-पान में परहेज रखने की जरूरत है?`
        : `💡 In Simple Words:
MediLens is an educational assistant and cannot prescribe medicines, recommend drug doses, or adjust prescriptions. A safe dose depends on your health, and taking an unprescribed dose can be dangerous.

🩺 Questions for Your Doctor:
1. What is the safest medication and exact dosage for my current symptoms and health history?
2. Are there any safe non-medicinal remedies or lifestyle changes that can help me while waiting?`;

      return res.json({
        status: 'prescription_blocked',
        content: prescriptionContent,
        modelUsed: 'deterministic-safety-engine',
        language,
      });
    }

    // 3. Normal Groq LLM Healthcare Explanation
    const targetLang = isHindi ? 'Hindi (सरल और स्पष्ट हिंदी)' : 'Simple, Clear Everyday English';
    const systemMsg = SYSTEM_HEALTHCARE_SAFETY_PROMPT.replace(/\{target_language\}/g, targetLang);

    const messages = [
      { role: 'system', content: systemMsg },
      { role: 'user', content: `Explain '${cleanQuery}' completely in ${targetLang}. Cover what the problem is, the common causes, and what usually helps. Finish every sentence and every section.` }
    ];

    const result = await callGroqChat(messages, 1600);
    res.json({
      status: 'success',
      content: result.content,
      modelUsed: result.modelUsed,
      language,
    });
  } catch (err: any) {
    console.error('Groq topic error:', err);
    res.status(500).json({ error: err.message || 'Error processing healthcare topic' });
  }
});

// Chat alias endpoint
app.post('/api/groq/chat', async (req: Request, res: Response) => {
  const query = req.body.message || req.body.query || '';
  if (!query) {
    return res.status(400).json({ error: 'Message or query is required' });
  }
  req.body.query = query;
  // Delegate to explain-topic
  const handler = (app as any)._router.stack.find((s: any) => s.route?.path === '/api/groq/explain-topic')?.route?.stack?.[0]?.handle;
  if (handler) {
    return handler(req, res);
  }
  res.status(500).json({ error: 'Endpoint routing error' });
});

// Report Explainer API
app.post('/api/groq/explain-report', async (req: Request, res: Response) => {
  try {
    const { reportText, language = 'en' } = req.body;
    if (!reportText || reportText.trim().length < 15) {
      return res.status(400).json({ error: 'Report text is too short. Please include lab markers and values.' });
    }

    const targetLang = language === 'hi' ? 'Hindi (सरल और स्पष्ट हिंदी)' : 'Simple, Clear Everyday English';
    const systemMsg = SYSTEM_REPORT_PROMPT.replace(/\{target_language\}/g, targetLang);

    const messages = [
      { role: 'system', content: systemMsg },
      {
        role: 'user',
        content: `Explain every value in this report completely in ${targetLang}. For each test, say what it is, why the number can look like this, and what usually helps. Finish every sentence.\n\n${reportText.trim()}`
      }
    ];

    const result = await callGroqChat(messages, 1600);
    res.json({
      status: 'success',
      content: result.content,
      modelUsed: result.modelUsed,
      language,
    });
  } catch (err: any) {
    console.error('Groq report error:', err);
    res.status(500).json({ error: err.message || 'Error processing report' });
  }
});

function cleanTranscript(text: string) {
  return text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
}

async function transcribeReportImage(dataUrl: string) {
  if (!GROQ_API_KEY) {
    throw new Error('Image reading is unavailable because no API key is configured.');
  }

  let lastStatus = 0;
  for (const model of GROQ_VISION_MODELS) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MediLens-Web/1.0',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: REPORT_TRANSCRIBE_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      lastStatus = response.status;
      console.warn(`Report image transcription failed on ${model} (${response.status})`);
      if (response.status === 401 || response.status === 413) break;
      continue;
    }

    const data = await response.json();
    const text = cleanTranscript(data.choices?.[0]?.message?.content || '');
    if (text) return { text, model };
  }

  throw new Error(lastStatus
    ? `The image could not be read (status ${lastStatus}).`
    : 'The image could not be read.');
}

app.post('/api/groq/image-to-text', async (req: Request, res: Response) => {
  try {
    const image = String(req.body?.image || '');
    const valid = /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(image);
    if (!valid) {
      return res.status(400).json({ error: 'Upload a JPG, PNG, or WebP photo of the report.' });
    }
    if (image.length > 8_000_000) {
      return res.status(413).json({ error: 'That photo is too large. Use a smaller image or paste the text.' });
    }

    const result = await transcribeReportImage(image);
    if (result.text.trim().length < 15) {
      return res.status(422).json({ error: 'Not enough text was found in that photo. Try a clearer picture or paste the results.' });
    }

    res.json({ status: 'success', text: result.text, modelUsed: result.model });
  } catch (err: any) {
    console.error('Report image transcription error:', err.message || err);
    res.status(500).json({ error: err.message || 'The photo could not be turned into text.' });
  }
});

// Setup Vite middleware in dev or static serving in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`MediLens server listening on http://localhost:${PORT}`);
  });
}

startServer();
