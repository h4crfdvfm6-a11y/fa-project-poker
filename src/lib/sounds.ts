/**
 * Table sounds. The real recorded sounds from the original F.A Poker table
 * (poker chips, card deal, table knock — the app's own files in /banners) are played
 * through Web Audio; tiny beeps are only a fallback while they load.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Audio =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return null;
    if (!ctx || ctx.state === "closed") ctx = new Audio();
    // Safari can also enter "interrupted" after a call, lock, or app switch.
    if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Called on every gesture, including after returning from the phone lock screen. */
export async function unlockSounds() {
  const a = audio();
  if (!a) return false;
  try {
    if (a.state !== "running") await a.resume();
    const source = a.createBufferSource();
    source.buffer = a.createBuffer(1, 1, a.sampleRate);
    source.connect(a.destination);
    source.start();
    loadSamples();
    return a.state === "running";
  } catch {
    return false; // keep the gesture listeners so the next tap can retry
  }
}

export function listenForSoundUnlock() {
  const unlock = () => {
    void unlockSounds();
  };
  const visible = () => {
    if (document.visibilityState === "visible") unlock();
  };
  window.addEventListener("pointerup", unlock);
  window.addEventListener("touchend", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("focus", unlock);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("pointerup", unlock);
    window.removeEventListener("touchend", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("focus", unlock);
    document.removeEventListener("visibilitychange", visible);
  };
}

export type SoundKind =
  | "deal"
  | "check"
  | "call"
  | "bet"
  | "fold"
  | "raise"
  | "allin"
  | "win"
  | "turn"
  | "premium"
  | "react"
  | "collect";

const MUTE_KEY = "fa_mute_sounds";
let mutedForVisit = false;

export function soundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    mutedForVisit = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* restricted storage */
  }
  return mutedForVisit;
}

export function setSoundsMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  mutedForVisit = muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* keep the choice for this visit */
  }
  if (!muted) void unlockSounds();
}

/* ---------- recorded sounds from the original table ---------- */
const SAMPLE_FILES = {
  // the app's own copies (uploaded by the owner), no longer the prototype site
  chips: "/banners/poker-chips.mp3",
  deal: "/banners/card-deal.mp3",
  knock: "/banners/check-knock.mp3",
} as const;
type Sample = keyof typeof SAMPLE_FILES;
const buffers: Partial<Record<Sample, AudioBuffer>> = {};
let loading = false;

function loadSamples() {
  if (loading || typeof window === "undefined") return;
  const a = audio();
  if (!a) return;
  loading = true;
  (Object.keys(SAMPLE_FILES) as Sample[]).forEach((k) => {
    fetch(SAMPLE_FILES[k])
      .then((r) =>
        r.ok ? r.arrayBuffer() : Promise.reject(new Error("missing")),
      )
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) =>
            a.decodeAudioData(data, resolve, reject),
          ),
      )
      .then((buf) => {
        buffers[k] = buf;
      })
      .catch(() => undefined);
  });
}

/** Play a recorded sound; returns false if it isn't loaded yet. */
function sample(k: Sample, vol: number): boolean {
  if (soundsMuted()) return true;
  const a = audio();
  const buf = buffers[k];
  if (!a || !buf) {
    loadSamples();
    return false;
  }
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g);
  g.connect(a.destination);
  src.start();
  return true;
}

if (typeof window !== "undefined") {
  // start loading straight away so the first sound is ready
  setTimeout(loadSamples, 0);
}

function beep(
  freq: number,
  dur = 0.08,
  type: OscillatorType = "sine",
  gain = 0.04,
) {
  if (soundsMuted()) return;
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(a.destination);
  const t = a.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

export function playSound(kind: SoundKind) {
  // same sounds and loudness as the original F.A Poker table
  switch (kind) {
    case "deal":
      if (!sample("deal", 0.42)) beep(520, 0.05, "triangle", 0.03);
      break;
    case "turn":
      if (!sample("deal", 0.4)) beep(600, 0.05, "triangle", 0.035);
      break;
    case "check":
      if (!sample("knock", 0.72)) beep(340, 0.06, "sine", 0.03);
      break;
    case "call":
      if (!sample("chips", 0.52)) beep(400, 0.07, "sine", 0.035);
      break;
    case "bet":
    case "raise":
      if (!sample("chips", 0.62)) {
        beep(280, 0.09, "square", 0.03);
        setTimeout(() => beep(360, 0.06, "square", 0.025), 60);
      }
      break;
    case "fold":
      if (!sample("deal", 0.34)) beep(180, 0.1, "sawtooth", 0.025);
      break;
    case "allin":
      if (!sample("chips", 0.68)) {
        beep(220, 0.12, "square", 0.04);
        setTimeout(() => beep(440, 0.12, "square", 0.035), 90);
      }
      break;
    case "collect":
      if (!sample("chips", 0.48)) beep(400, 0.07, "sine", 0.03);
      break;
    case "win":
      if (!sample("chips", 0.72)) {
        beep(523, 0.1, "sine", 0.04);
        setTimeout(() => beep(659, 0.12, "sine", 0.04), 100);
      }
      break;
    case "premium":
      beep(660, 0.1, "sine", 0.045);
      setTimeout(() => beep(880, 0.14, "sine", 0.04), 80);
      break;
    case "react":
      beep(740, 0.05, "triangle", 0.03);
      break;
  }
}

export function soundForAction(type: string): SoundKind {
  if (type === "fold") return "fold";
  if (type === "check") return "check";
  if (type === "call") return "call";
  if (type === "bet") return "bet";
  if (type === "raise") return "raise";
  if (type === "allin") return "allin";
  return "check";
}
