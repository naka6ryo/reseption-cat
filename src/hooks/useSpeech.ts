import { useAppStore } from '../store/useAppStore';

function resolveVoice(preferredName?: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices?.() || [];
  if (preferredName) {
    const m = voices.find(v => v.name === preferredName || v.voiceURI === preferredName);
    if (m) return m;
  }
  // Japanese voice fallback (cute voice tuning is done via pitch/rate)
  const jpVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('ja'));
  // Prefer Google/Microsoft if present
  const preferredJp = jpVoices.find(v => /google|microsoft/i.test(v.name)) || jpVoices[0];
  return preferredJp;
}

// --- Simple in-memory cache for VOICEVOX audio (ArrayBuffer) ---
type CacheVal = { buf: ArrayBuffer; at: number };
const vvCache = new Map<string, CacheVal>();
const vvPending = new Map<string, Promise<ArrayBuffer>>();
const VV_CACHE_MAX = 32;
// Decoded audio cache for instant playback
let audioCtx: AudioContext | null = null;
const vvDecoded = new Map<string, AudioBuffer>();

function ttsLog(msg: string) {
  try { useAppStore.getState?.().pushLog?.(`[TTS] ${msg}`); } catch {}
}
function vvKey(text: string, speaker: number) {
  return `${speaker}|${text}`;
}
function vvSet(key: string, buf: ArrayBuffer) {
  vvCache.set(key, { buf, at: Date.now() });
  if (vvCache.size > VV_CACHE_MAX) {
    // prune oldest
    const oldest = [...vvCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) vvCache.delete(oldest);
  }
}

export async function speak(text: string, opt?: Partial<SpeechSynthesisUtterance> & { voiceName?: string }) {
  const cfg = useAppStore.getState?.().config.tts;
  const engine = cfg?.engine ?? 'web';
  if (engine === 'voicevox') {
    try {
      await speakWithVoiceVox(text, { speaker: cfg?.voicevoxSpeaker ?? 3 });
      return; // 成功
    } catch (e) {
  console.warn('VOICEVOX speak failed', e);
  ttsLog(`speak failed: ${String((e as any)?.message || e)}`);
      return; // フォールバックしない（声が混ざらないように）
    }
  }
  const preferred = opt?.voiceName ?? cfg?.voice;
  const u = new SpeechSynthesisUtterance(text);
  Object.assign(u, { rate: cfg?.rate ?? 1.0, pitch: cfg?.pitch ?? 1.0, volume: cfg?.volume ?? 1.0 }, opt);
  const v = resolveVoice(preferred);
  if (v) u.voice = v;
  try { speechSynthesis.cancel(); } catch {}
  speechSynthesis.speak(u);
}

// 複数の発話を順番に話す（最初に一度だけキャンセルし、以降はキューに積む）
export async function speakAll(texts: string[], opt?: Partial<SpeechSynthesisUtterance> & { voiceName?: string }) {
  if (!texts.length) return;
  const cfg = useAppStore.getState?.().config.tts;
  const engine = cfg?.engine ?? 'web';
  if (engine === 'voicevox') {
    try {
  const speaker = cfg?.voicevoxSpeaker ?? 3;
  // 先に全てを並列でキャッシュしてから、直列で再生
      await Promise.allSettled(texts.map((t) => fetchVoiceVoxBuffer(t, speaker).then((buf)=>{ vvSet(vvKey(t, speaker), buf); })));
  for (const t of texts) await speakWithVoiceVox(t, { speaker });
      return;
    } catch (e) {
      console.warn('VOICEVOX speakAll failed', e);
  ttsLog(`speakAll failed: ${String((e as any)?.message || e)}`);
      return; // フォールバックしない
    }
  }
  const preferred = opt?.voiceName ?? cfg?.voice;
  const voice = resolveVoice(preferred);
  try { speechSynthesis.cancel(); } catch {}
  texts.forEach((text) => {
    const u = new SpeechSynthesisUtterance(text);
    Object.assign(u, { rate: cfg?.rate ?? 1.0, pitch: cfg?.pitch ?? 1.0, volume: cfg?.volume ?? 1.0 }, opt);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  });
}

async function speakWithVoiceVox(text: string, opt: { speaker: number }) {
  const key = vvKey(text, opt.speaker);
  let buf = vvCache.get(key)?.buf;
  if (!buf) {
    const pending = vvPending.get(key);
    if (pending) {
      buf = await pending; // 既存fetchの完了を待つ
    } else {
      const p = fetchVoiceVoxBuffer(text, opt.speaker).then((b) => { vvSet(key, b); vvPending.delete(key); return b; })
        .catch((e) => { vvPending.delete(key); throw e; });
      vvPending.set(key, p);
      buf = await p;
    }
  }
  // Prefer Web Audio (decoded cache) for faster start
  const decoded = await getDecodedBuffer(key, buf).catch(() => null);
  if (decoded) {
    await playDecoded(decoded);
  } else {
    await playAudioFromBuffer(buf);
  }
}

function playAudio(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('audio play error'));
    a.play().catch(reject);
  });
}

function playAudioFromBuffer(buf: ArrayBuffer): Promise<void> {
  const blob = new Blob([buf], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return playAudio(url).finally(() => URL.revokeObjectURL(url));
}

async function getDecodedBuffer(key: string, buf: ArrayBuffer): Promise<AudioBuffer> {
  const cached = vvDecoded.get(key);
  if (cached) return cached;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Note: decodeAudioData copies buffer, create a detached copy to avoid neutering issues
    const copy = buf.slice(0);
    const audioBuffer = await audioCtx.decodeAudioData(copy as any);
    vvDecoded.set(key, audioBuffer);
    return audioBuffer;
  } catch (e) {
    throw e;
  }
}

function playDecoded(buffer: AudioBuffer): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} }
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);
      src.onended = () => resolve();
      src.start();
    } catch (e) {
      reject(e);
    }
  });
}

async function fetchVoiceVoxBuffer(text: string, speaker: number): Promise<ArrayBuffer> {
  const tts = useAppStore.getState?.().config.tts;
  const tQuery = 5000; // audio_query timeout
  const query = await vvFetchWithRetry(async () => {
    const res = await vvFetch(`/api/voicevox/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, tQuery);
    if (!res.ok) throw new Error('voicevox audio_query failed');
    return res.json();
  });
  // パラメータ調整（必要に応じて）
  if (query) {
    // VOICEVOXのaudio_queryには次のようなフィールドがある: speedScale, pitchScale, intonationScale など
    if (typeof tts?.rate === 'number') query.speedScale = tts.rate;
    if (typeof tts?.pitch === 'number') query.pitchScale = tts.pitch - 1; // pitch=1 を基準(0)として微調整
    if (typeof tts?.voicevoxIntonation === 'number') query.intonationScale = tts.voicevoxIntonation;
  }
  const tSynth = Math.min(20000, 4000 + text.length * 60); // length-aware timeout
  const buf = await vvFetchWithRetry(async () => {
    const res = await vvFetch(`/api/voicevox/synthesis?speaker=${speaker}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query)
    }, tSynth);
    if (!res.ok) throw new Error('voicevox synthesis failed');
    return res.arrayBuffer();
  });
  return buf;
}

// 事前に生成してキャッシュだけ行う（再生はしない）
export async function preloadTTS(text: string): Promise<void> {
  const cfg = useAppStore.getState?.().config.tts;
  if ((cfg?.engine ?? 'web') !== 'voicevox') return; // VOICEVOXのみ対象
  const speaker = cfg?.voicevoxSpeaker ?? 3;
  const key = vvKey(text, speaker);
  if (vvCache.has(key)) return;
  try {
    const pending = vvPending.get(key) ?? fetchVoiceVoxBuffer(text, speaker)
      .then((b)=>{ vvSet(key,b); vvPending.delete(key); return b; })
      .catch((e)=>{ vvPending.delete(key); throw e; });
    vvPending.set(key, pending);
    const buf = await pending;
    // Try to pre-decode for instant playback; ignore failures silently
    try { await getDecodedBuffer(key, buf); } catch {}
  } catch {
    // ignore errors; fallback occurs on speak
  }
}

// VOICEVOXのスピーカーを事前初期化（対応エンジンのみ）
export async function initVoiceVox(): Promise<void> {
  const cfg = useAppStore.getState?.().config.tts;
  if ((cfg?.engine ?? 'web') !== 'voicevox') return;
  const speaker = cfg?.voicevoxSpeaker ?? 3;
  try {
    await vvFetch(`/api/voicevox/initialize_speaker?speaker=${speaker}`).then(()=>{});
  } catch {
    // ignore if unsupported
  }
}

// Fetch helpers with timeout and small retry to reduce transient failures
function vvFetch(input: RequestInfo, init?: RequestInit, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function vvFetchWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; }
  }
  ttsLog(`fetch failed after retries: ${String((lastErr as any)?.message || lastErr)}`);
  throw lastErr;
}