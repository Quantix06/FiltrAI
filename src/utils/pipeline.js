// pipeline.js
// Fact-checking pipeline logic coordinating LLM (OpenRouter / Anthropic) and Serper Web Search.

const EVALUATE_PROMPT = `You are FiltrAI, an expert real-time fact-checking assistant.
Your task is to analyze the provided conversation transcript snippet and identify any clear, check-worthy, factual claims that have been made.
Check-worthy claims are specific factual statements, statistics, historical facts, public policies, or records that can be proven true or false. Do NOT extract subjective opinions, predictions, value judgments, or rhetorical questions.

For each check-worthy claim you find, you must assign a fast initial verdict and a short, one-sentence explanation.
The possible verdicts are:
- TRUE: The claim is fully accurate and aligns with established facts.
- SUBSTANTIALLY TRUE: The claim is mostly accurate but lacks minor context or detail.
- MISLEADING: The claim contains some factual elements but is framed or presented in a way that creates a false or distorted impression.
- FALSE: The claim is factually incorrect.
- UNVERIFIABLE: There is not enough public record to verify the claim. (Do NOT output this verdict; only output claims that are checkable).

You MUST output your response as a JSON array of objects, containing ONLY the array, with the following format:
[
  {
    "claim": "Specific factual claim extracted from the transcript",
    "verdict": "TRUE" | "SUBSTANTIALLY TRUE" | "MISLEADING" | "FALSE",
    "explanation": "Concise, one-sentence explanation of why this verdict was given",
    "speaker": "Inferred speaker name, or 'Unknown'"
  }
]

Ensure the JSON is valid and can be parsed directly. Do not include markdown code block wrapper or any other text.`;

const GROUNDED_PROMPT = `You are FiltrAI, an expert real-time fact-checking assistant.
Your task is to review a specific claim, its initial verdict, and the web search evidence provided, and issue a finalized grounded verdict and explanation.
Ignore any information in the search evidence that was published after the event date, if provided.
Write the claim, verdict, and explanation. The explanation must be highly objective, reference the source facts directly, and be written in the language of the transcript if possible.

The possible verdicts are:
- TRUE
- SUBSTANTIALLY TRUE
- MISLEADING
- FALSE
- UNVERIFIABLE

You MUST output your response as a JSON array containing a single object, with the following format:
[
  {
    "claim": "The refined or original claim",
    "verdict": "TRUE" | "SUBSTANTIALLY TRUE" | "MISLEADING" | "FALSE" | "UNVERIFIABLE",
    "explanation": "Concise explanation incorporating details from the web search evidence",
    "speaker": "Speaker name"
  }
]

Do not include markdown code block wrapper or any other text. Output ONLY the valid JSON array.`;

const BLOCKED_DOMAINS = [
  'reddit.com', 'facebook.com', 'twitter.com', 'x.com',
  'tiktok.com', 'instagram.com', 'pinterest.com', 'quora.com',
  'yelp.com', 'tripadvisor.com', 'youtube.com',
  'democrats.org', 'republicans.org', 'gop.com', 'dnc.org',
  'afscme.org', 'ntu.org', 'americanprogress.org', 'heritage.org',
  'breitbart.com', 'dailykos.com', 'mediamatters.org', 'newsmax.com',
  'thefederalist.com', 'motherjones.com', 'nationalreview.com',
  'democrats-appropriations.house.gov', 'waysandmeans.house.gov',
  'bostonkravmaga.com', 'israelpolicyforum.org'
];

const LANGUAGE_LOCALE = {
  en: { gl: 'us', hl: 'en' },
  es: { gl: 'es', hl: 'es' },
  fr: { gl: 'fr', hl: 'fr' },
  de: { gl: 'de', hl: 'de' },
  it: { gl: 'it', hl: 'it' },
  pt: { gl: 'br', hl: 'pt' },
  nl: { gl: 'nl', hl: 'nl' },
  hi: { gl: 'in', hl: 'hi' },
  ja: { gl: 'jp', hl: 'ja' },
  zh: { gl: 'cn', hl: 'zh-cn' },
  ar: { gl: 'sa', hl: 'ar' },
  ko: { gl: 'kr', hl: 'ko' },
  ru: { gl: 'ru', hl: 'ru' },
  pl: { gl: 'pl', hl: 'pl' },
  sv: { gl: 'se', hl: 'sv' },
  tr: { gl: 'tr', hl: 'tr' },
};

// ── Model Call Helper ─────────────────────────────────────────────────────────

async function callLLM(prompt, systemPrompt, settings) {
  const isOpenRouter = settings.provider === 'openrouter';
  console.log(`[pipeline] callLLM started. Provider: ${settings.provider}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[pipeline] LLM fetch request timed out (30s). Aborting...');
    controller.abort();
  }, 30000);
  
  try {
    if (isOpenRouter) {
      if (!settings.openrouterKey) {
        throw new Error('OpenRouter API key is missing. Please set it in Settings.');
      }
      const model = settings.openrouterModel || 'cohere/north-mini-code:free';
      console.log(`[pipeline] Contacting OpenRouter. Model: ${model}`);
      console.log('[pipeline] Initiating OpenRouter POST fetch request...');
      
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openrouterKey}`,
          'HTTP-Referer': 'https://filtrai.ai',
          'X-Title': 'FiltrAI Realtime'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: 'user', 
              content: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER INPUT:\n${prompt}` 
            }
          ],
          temperature: 0,
          max_tokens: 1024
        })
      });
      
      clearTimeout(timeoutId);
      console.log(`[pipeline] OpenRouter fetch resolved. HTTP Status: ${res.status}`);
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[pipeline] OpenRouter HTTP Error details:`, errText);
        throw new Error(`OpenRouter API error: ${res.status} - ${errText}`);
      }
      
      const data = await res.json();
      if (data.error) {
        console.error(`[pipeline] OpenRouter Payload Error:`, data.error);
        throw new Error(data.error.message || 'Unknown OpenRouter API error');
      }
      
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      console.log('[pipeline] OpenRouter raw response content:', raw);
      return cleanJSON(raw);
    } else {
      // Anthropic Provider
      if (!settings.anthropicKey) {
        throw new Error('Anthropic API key is missing. Please set it in Settings.');
      }
      const model = settings.anthropicModel || 'claude-haiku-4-5-20251001';
      console.log(`[pipeline] Contacting Anthropic. Model: ${model}`);
      console.log('[pipeline] Initiating Anthropic POST fetch request...');
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1024,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      clearTimeout(timeoutId);
      console.log(`[pipeline] Anthropic fetch resolved. HTTP Status: ${res.status}`);
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[pipeline] Anthropic HTTP Error details:`, errText);
        throw new Error(`Anthropic API error: ${res.status} - ${errText}`);
      }
      
      const data = await res.json();
      if (data.error) {
        console.error(`[pipeline] Anthropic Payload Error:`, data.error);
        throw new Error(data.error.message || 'Unknown Anthropic API error');
      }
      
      const raw = data.content?.[0]?.text?.trim() || '';
      console.log('[pipeline] Anthropic raw response content:', raw);
      return cleanJSON(raw);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function cleanJSON(str) {
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/g, '');
  }
  return cleaned.trim();
}

function parseArray(str) {
  const start = str.indexOf('[');
  const end = str.lastIndexOf(']');
  if (start === -1 || end === -1) {
    console.warn('[pipeline] JSON Array brackets [ ] not found in output:', str);
    return [];
  }
  const sliceStr = str.slice(start, end + 1);
  try {
    return JSON.parse(sliceStr);
  } catch (err) {
    console.error('[pipeline] Failed to parse JSON array. String segment:', sliceStr, err);
    return [];
  }
}

// ── Web Search Helper ────────────────────────────────────────────────────────

async function searchWeb(query, serperKey, language = 'en', retries = 2) {
  if (!serperKey) {
    console.warn('[pipeline] Serper API Key is missing. Skipping web search grounding.');
    return { organic: [], answerBox: null, knowledgeGraph: null };
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  console.log(`[pipeline] Google search querying Serper: "${query}"`);
  try {
    const locale = LANGUAGE_LOCALE[language] || LANGUAGE_LOCALE.en;
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': serperKey
      },
      body: JSON.stringify({
        q: query,
        num: 6,
        gl: locale.gl,
        hl: locale.hl
      })
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Serper API status ${res.status}`);
    }
    
    const data = await res.json();
    const organic = (data.organic ?? [])
      .filter(r => r.link && !BLOCKED_DOMAINS.some(d => r.link.includes(d)))
      .slice(0, 3)
      .map(r => ({
        url: r.link,
        title: r.title || '',
        snippet: r.snippet || '',
        date: r.date || ''
      }));
      
    const answerBox = data.answerBox
      ? {
          answer: data.answerBox.answer || data.answerBox.snippet || '',
          title: data.answerBox.title || '',
          url: data.answerBox.link || ''
        }
      : null;
      
    const knowledgeGraph = data.knowledgeGraph
      ? {
          description: data.knowledgeGraph.description || '',
          title: data.knowledgeGraph.title || ''
        }
      : null;
      
    console.log(`[pipeline] Serper results found: ${organic.length} links`);
    return { organic, answerBox, knowledgeGraph };
  } catch (err) {
    clearTimeout(timeoutId);
    if (retries > 0 && err.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, 500));
      return searchWeb(query, serperKey, language, retries - 1);
    }
    console.error('[pipeline] [serper] search error:', err);
    return { organic: [], answerBox: null, knowledgeGraph: null };
  }
}

// ── Lexical Features Extractor ───────────────────────────────────────────────

const HEDGING_WORDS   = ['think','believe','maybe','perhaps','probably','might','could','seem','appears','guess','suppose','somewhat'];
const CERTAINTY_WORDS = ['definitely','certainly','absolutely','always','never','clearly','obviously','undoubtedly','exactly','proven'];
const FILLER_WORDS    = ['um','uh','like','basically','actually','literally','right','okay'];
const EMOTIONAL_WORDS = ['disaster','terrible','horrible','amazing','incredible','great','awful','fantastic','disgusting','wonderful','worst','best'];
const EXCLUSIVE_WORDS = ['but','except','however','although','unless','without','exclude'];
const FP_SINGULAR     = ['i','me','my','mine','myself'];

function extractLexical(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const total = words.length || 1;
  const rate = (list) => Math.round(words.filter(w => list.some(h => w.includes(h))).length / total * 100);
  
  return {
    rates: {
      hedging: rate(HEDGING_WORDS),
      certainty: rate(CERTAINTY_WORDS),
      filler: rate(FILLER_WORDS),
      emotional: rate(EMOTIONAL_WORDS),
      exclusive: rate(EXCLUSIVE_WORDS),
      firstPersonSg: Math.round(words.filter(w => FP_SINGULAR.includes(w)).length / total * 100)
    },
    wordCount: total
  };
}

function buildLexicalSummary(f) {
  const r = f.rates || f;
  const notes = [];
  if (r.hedging > 5)       notes.push(`hedging language (${r.hedging}%)`);
  if (r.certainty > 5)     notes.push(`certainty markers (${r.certainty}%)`);
  if (r.filler > 5)        notes.push(`filler words (${r.filler}%)`);
  if (r.emotional > 5)     notes.push(`emotional language (${r.emotional}%)`);
  if (r.exclusive > 5)     notes.push(`qualifying words (${r.exclusive}%)`);
  if (r.firstPersonSg > 5) notes.push(`first-person singular (${r.firstPersonSg}%)`);
  return notes.length ? `Features: ${notes.join(', ')}.` : 'Neutral delivery.';
}

// ── Claim Deduplication ──────────────────────────────────────────────────────

const normalizeClaimKey = (claim) => {
  return claim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .sort()
    .join(' ');
};

// ── Pipeline Orchestrator Class ──────────────────────────────────────────────

export class FactCheckPipeline {
  constructor(settings, callbacks = {}) {
    this.settings = settings;
    this.callbacks = {
      onNewVerdict: callbacks.onNewVerdict || (() => {}),
      onUpdateVerdicts: callbacks.onUpdateVerdicts || (() => {}),
      onNewSpeaker: callbacks.onNewSpeaker || (() => {}),
      onError: callbacks.onError || (() => {}),
      onCheckingBubbles: callbacks.onCheckingBubbles || (() => {}),
      onCheckComplete: callbacks.onCheckComplete || (() => {})
    };
    
    this.recentClaims = new Map(); // key -> [timestamp, originalClaim]
    this.CLAIM_DEDUP_MS = 180000;  // 3 minutes
    
    this.WINDOW_SIZE = 4;
    this.sentenceWindow = [];
    this.sentenceCount = 0;
    
    this.windowLexical = {
      rates: { hedging: 0, certainty: 0, filler: 0, emotional: 0, exclusive: 0, firstPersonSg: 0 },
      wordCount: 0,
      _sentenceCount: 0
    };
    this.windowStartTime = null;
    
    this.lastSpeakerId = null;
    this.speakerIdToName = {};
    this.confirmedSpeakers = new Set();
    
    // Inactivity timeout for evaluation trigger
    this.inactivityTimeout = null;
  }
  
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('[pipeline] Settings updated:', this.settings);
  }
  
  registerSpeakerName(id, name) {
    this.speakerIdToName[id] = name;
    this.confirmedSpeakers.add(id);
    console.log(`[pipeline] Speaker name registered: ID ${id} -> "${name}"`);
  }
  
  reset() {
    this.recentClaims.clear();
    this.sentenceWindow = [];
    this.sentenceCount = 0;
    this.windowLexical = {
      rates: { hedging: 0, certainty: 0, filler: 0, emotional: 0, exclusive: 0, firstPersonSg: 0 },
      wordCount: 0,
      _sentenceCount: 0
    };
    this.windowStartTime = null;
    this.lastSpeakerId = null;
    this.speakerIdToName = {};
    this.confirmedSpeakers.clear();
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    console.log('[pipeline] Reset state.');
  }
  
  isDuplicate(claim) {
    const key = normalizeClaimKey(claim);
    const now = Date.now();
    
    for (const [k, v] of this.recentClaims) {
      const t = v[0];
      if (now - t > this.CLAIM_DEDUP_MS) {
        this.recentClaims.delete(k);
      }
    }
    
    if (this.recentClaims.has(key)) return true;
    
    const keyWords = new Set(key.split(' ').filter(Boolean));
    const figures = (claim.match(/\$[\d,.]+(?:\s*(?:trillion|billion|million|thousand))?/gi) || [])
      .map(d => d.replace(/[,\s]/g, '').toLowerCase());
      
    for (const [k, v] of this.recentClaims) {
      const kWords = k.split(' ').filter(Boolean);
      const overlap = kWords.filter(w => keyWords.has(w)).length / Math.max(keyWords.size, kWords.length);
      if (overlap >= 0.35) return true;
      
      if (figures.length) {
        const origClaim = v[1] || '';
        const origFigures = (origClaim.match(/\$[\d,.]+(?:\s*(?:trillion|billion|million|thousand))?/gi) || [])
          .map(d => d.replace(/[,\s]/g, '').toLowerCase());
        if (figures.some(f => origFigures.includes(f))) return true;
      }
    }
    
    this.recentClaims.set(key, [now, claim]);
    return false;
  }
  
  async handleNewSentence(text, speakerId, bubbleId) {
    if (!text || text.trim().length < 5) {
      if (bubbleId) {
        this.callbacks.onCheckComplete?.([bubbleId], []);
      }
      return;
    }
    
    console.log(`[pipeline] handleNewSentence: "${text}" | speakerId: ${speakerId} | bubbleId: ${bubbleId}`);
    
    // Clear any pending inactivity timeout
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    
    // Speaker transition flush (only if diarized)
    if (
      this.lastSpeakerId !== null &&
      speakerId !== null &&
      speakerId !== undefined &&
      speakerId !== this.lastSpeakerId &&
      this.sentenceWindow.length >= 2
    ) {
      console.log(`[pipeline] Speaker changed from ID ${this.lastSpeakerId} to ${speakerId}. Flushing early...`);
      await this.flushCurrentWindow();
    }
    
    this.lastSpeakerId = speakerId;
    
    const confirmedName = (speakerId !== null && speakerId !== undefined) ? this.speakerIdToName[speakerId] : null;
    const label = confirmedName ? `[${confirmedName}]` : (speakerId !== null && speakerId !== undefined ? `[Speaker ${speakerId}]` : null);
    const labeledText = label ? `${label} ${text}` : text;
    
    this.sentenceWindow.push({ text: labeledText, speakerId, speakerName: confirmedName, bubbleId });
    if (this.sentenceWindow.length > 15) this.sentenceWindow.shift();
    this.sentenceCount++;
    
    if (!this.windowStartTime) this.windowStartTime = Date.now();
    
    // Accumulate lexical rates
    const f = extractLexical(text);
    const r = f.rates, wr = this.windowLexical.rates;
    wr.hedging += r.hedging;
    wr.certainty += r.certainty;
    wr.filler += r.filler;
    wr.emotional += r.emotional;
    wr.exclusive += r.exclusive;
    wr.firstPersonSg += r.firstPersonSg;
    this.windowLexical.wordCount += f.wordCount;
    this.windowLexical._sentenceCount = (this.windowLexical._sentenceCount || 0) + 1;
    
    // Fire event for newly detected speaker
    if (speakerId !== null && speakerId !== undefined && !this.confirmedSpeakers.has(speakerId)) {
      this.callbacks.onNewSpeaker(speakerId, text.slice(0, 80));
    }
    
    // Window trigger check (every WINDOW_SIZE sentences)
    if (this.sentenceWindow.length >= this.WINDOW_SIZE) {
      console.log(`[pipeline] Window buffer size reached (${this.WINDOW_SIZE}). Evaluating...`);
      await this.evaluateWindow();
    } else {
      // Set inactivity timeout to flush sentences after 3.5 seconds of silence
      this.inactivityTimeout = setTimeout(async () => {
        if (this.sentenceWindow.length > 0) {
          console.log('[pipeline] Silence detected (3.5s). Inactivity flush triggered...');
          await this.flushCurrentWindow();
        }
      }, 3500);
    }
  }
  
  async flushCurrentWindow() {
    if (this.sentenceWindow.length === 0) return;
    
    const bubbleIds = this.sentenceWindow.map(s => s.bubbleId).filter(Boolean);
    const text = this.sentenceWindow.map(s => s.text).join(' ');
    console.log('[pipeline] Flushing current sentences:', text);
    
    const counts = {};
    this.sentenceWindow.forEach(s => {
      if (s.speakerId !== null && s.speakerId !== undefined) {
        counts[s.speakerId] = (counts[s.speakerId] || 0) + 1;
      }
    });
    
    const dominantSpeakerId = Object.keys(counts).length
      ? Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0]
      : null;
      
    const dominantSpeaker = dominantSpeakerId !== null ? (this.speakerIdToName[dominantSpeakerId] || null) : null;
    
    const lexicalSnapshot = JSON.parse(JSON.stringify(this.windowLexical));
    const sc = lexicalSnapshot._sentenceCount || 1;
    const lr = lexicalSnapshot.rates;
    lr.hedging = Math.round(lr.hedging / sc);
    lr.certainty = Math.round(lr.certainty / sc);
    lr.filler = Math.round(lr.filler / sc);
    lr.emotional = Math.round(lr.emotional / sc);
    lr.exclusive = Math.round(lr.exclusive / sc);
    lr.firstPersonSg = Math.round(lr.firstPersonSg / sc);
    
    const lexicalSummary = buildLexicalSummary(lexicalSnapshot);
    
    // Clear buffer states
    this.sentenceWindow = [];
    this.windowLexical = {
      rates: { hedging: 0, certainty: 0, filler: 0, emotional: 0, exclusive: 0, firstPersonSg: 0 },
      wordCount: 0,
      _sentenceCount: 0
    };
    this.windowStartTime = null;
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    
    await this.evaluateClaims(text, lexicalSummary, lexicalSnapshot, dominantSpeaker, dominantSpeakerId, bubbleIds);
  }
  
  async evaluateWindow() {
    const bubbleIds = this.sentenceWindow.map(s => s.bubbleId).filter(Boolean);
    const text = this.sentenceWindow.map(s => s.text).join(' ');
    console.log('[pipeline] Evaluating window buffer:', text);
    
    const counts = {};
    this.sentenceWindow.forEach(s => {
      if (s.speakerId !== null && s.speakerId !== undefined) {
        counts[s.speakerId] = (counts[s.speakerId] || 0) + 1;
      }
    });
    
    const dominantSpeakerId = Object.keys(counts).length
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      : null;
      
    const dominantSpeaker = dominantSpeakerId !== null ? (this.speakerIdToName[dominantSpeakerId] || null) : null;
    
    const lexicalSnapshot = JSON.parse(JSON.stringify(this.windowLexical));
    const sc = lexicalSnapshot._sentenceCount || 1;
    const lr = lexicalSnapshot.rates;
    lr.hedging = Math.round(lr.hedging / sc);
    lr.certainty = Math.round(lr.certainty / sc);
    lr.filler = Math.round(lr.filler / sc);
    lr.emotional = Math.round(lr.emotional / sc);
    lr.exclusive = Math.round(lr.exclusive / sc);
    lr.firstPersonSg = Math.round(lr.firstPersonSg / sc);
    
    const lexicalSummary = buildLexicalSummary(lexicalSnapshot);
    
    // Clear buffer states
    this.sentenceWindow = [];
    this.windowLexical = {
      rates: { hedging: 0, certainty: 0, filler: 0, emotional: 0, exclusive: 0, firstPersonSg: 0 },
      wordCount: 0,
      _sentenceCount: 0
    };
    this.windowStartTime = null;
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    
    await this.evaluateClaims(text, lexicalSummary, lexicalSnapshot, dominantSpeaker, dominantSpeakerId, bubbleIds);
  }
  
  async evaluateClaims(contextText, lexicalSummary, lexicalSnapshot, dominantSpeaker, dominantSpeakerId, bubbleIds) {
    console.log(`[pipeline] evaluateClaims called. Context: "${contextText}" | Bubbles: ${JSON.stringify(bubbleIds)}`);
    if (bubbleIds && bubbleIds.length > 0) {
      this.callbacks.onCheckingBubbles?.(bubbleIds);
    }
    try {
      const language = this.settings.language || 'en';
      let titleContext = '';
      if (language !== 'en') {
        titleContext = `LANGUAGE REQUIREMENT: You MUST write the "claim" and "explanation" fields in the language with code "${language}". This is mandatory. Only the verdict values (TRUE, FALSE, etc.) stay in English.\n\n`;
      }
      
      const promptText = `${titleContext}Transcript: "${contextText}"\n\nLexical analysis: ${lexicalSummary}`;
      
      // 1. Call LLM for initial fast checks
      const rawResponse = await callLLM(promptText, EVALUATE_PROMPT, this.settings);
      const results = parseArray(rawResponse);
      console.log(`[pipeline] Initial LLM parsed claims count: ${results.length}`);
      
      // Filter valid check-worthy claims, deduplicate
      const valid = results.filter(r => r.claim && r.verdict && r.verdict !== 'UNVERIFIABLE' && !this.isDuplicate(r.claim));
      console.log(`[pipeline] Check-worthy and non-duplicate claims found: ${valid.length}`);
      
      if (!valid.length) {
        if (bubbleIds && bubbleIds.length > 0) {
          this.callbacks.onCheckComplete?.(bubbleIds, []);
        }
        return;
      }
      
      // Generate unique IDs for the new claims
      const fastCards = valid.map(r => ({
        id: 'claim_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
        claim: r.claim,
        verdict: r.verdict,
        explanation: r.explanation,
        sources: [],
        pending: true, // Marker for verifying spinner
        lexical: lexicalSnapshot,
        dominantSpeakerId,
        speaker: dominantSpeaker || (r.speaker && !r.speaker.match(/^Speaker\s*\d+$/i) ? r.speaker : null),
        timestamp: Date.now()
      }));
      
      // Call listener with fast cards
      this.callbacks.onNewVerdict(fastCards);
      
      if (bubbleIds && bubbleIds.length > 0) {
        this.callbacks.onCheckComplete?.(bubbleIds, valid.map(v => v.claim));
      }
      
      // 2. Perform Web search and grounding in parallel for each card
      fastCards.forEach(async (card) => {
        try {
          const searchData = await searchWeb(card.claim, this.settings.serperKey, language);
          
          if (!searchData.organic?.length && !searchData.answerBox && !searchData.knowledgeGraph) {
            console.log(`[pipeline] No search results for: "${card.claim}". Finalizing card with fast verdict.`);
            this.callbacks.onUpdateVerdicts([{ ...card, pending: false }]);
            return;
          }
          
          // Build search results block
          const parts = [];
          if (searchData.answerBox?.answer) {
            parts.push(`[Direct Answer] ${searchData.answerBox.title ? searchData.answerBox.title + ': ' : ''}${searchData.answerBox.answer}\nSource: ${searchData.answerBox.url}`);
          }
          if (searchData.knowledgeGraph?.description) {
            parts.push(`[Knowledge Panel] ${searchData.knowledgeGraph.title ? searchData.knowledgeGraph.title + ': ' : ''}${searchData.knowledgeGraph.description}`);
          }
          searchData.organic.forEach((r, idx) => {
            parts.push(`[Source ${idx + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`);
          });
          const evidenceBlock = parts.join('\n\n');
          
          const groundPrompt = `Transcript: "${contextText}"\n\nClaim: "${card.claim}"\nFast Initial Verdict: ${card.verdict}\n\nWeb Search Evidence:\n${evidenceBlock}\n\nLexical analysis: ${lexicalSummary}`;
          
          console.log(`[pipeline] Grounding claim "${card.claim}"...`);
          const groundRaw = await callLLM(groundPrompt, GROUNDED_PROMPT, this.settings);
          const groundParsed = parseArray(groundRaw);
          const match = groundParsed.find(r => r.claim && r.verdict);
          
          if (!match || match.verdict === 'UNVERIFIABLE') {
            console.log(`[pipeline] Grounding returned empty or unverifiable for claim "${card.claim}". Finalizing card with fast verdict.`);
            this.callbacks.onUpdateVerdicts([{ ...card, pending: false }]);
            return;
          }
          
          const resolvedSpeaker = dominantSpeaker 
            || (card.speaker && !card.speaker.match(/^Speaker\s*\d+$/i) ? card.speaker : null)
            || (match.speaker && !match.speaker.match(/^Speaker\s*\d+$/i) ? match.speaker : null);
            
          // Rule: Don't downgrade TRUE/SUBSTANTIALLY TRUE to MISLEADING or FALSE based on small snippets
          const fastWasTrue = card.verdict === 'TRUE' || card.verdict === 'SUBSTANTIALLY TRUE';
          const groundedDowngrades = match.verdict === 'MISLEADING' || match.verdict === 'FALSE';
          const finalVerdict = (fastWasTrue && groundedDowngrades) ? card.verdict : match.verdict;
          
          const urls = searchData.organic.map(r => r.url);
          console.log(`[pipeline] Grounding complete. Verdict: ${finalVerdict} | Sources: ${urls.length}`);
          
          this.callbacks.onUpdateVerdicts([{
            ...card,
            claim: match.claim || card.claim,
            verdict: finalVerdict,
            explanation: match.explanation || card.explanation,
            sources: urls,
            pending: false,
            speaker: resolvedSpeaker
          }]);
          
        } catch (err) {
          console.error(`[pipeline] Error grounding claim: "${card.claim}"`, err);
          // Failsafe: stop pending state
          this.callbacks.onUpdateVerdicts([{ ...card, pending: false }]);
        }
      });
      
    } catch (err) {
      if (bubbleIds && bubbleIds.length > 0) {
        this.callbacks.onCheckComplete?.(bubbleIds, []);
      }
      let msg = err.message;
      if (err.name === 'AbortError') {
        msg = 'Request timed out after 30 seconds. The AI model took too long to respond.';
      }
      console.error('[pipeline] FactCheckPipeline evaluation error:', err);
      this.callbacks.onError(msg || 'Error occurred during evaluation');
    }
  }
}
