/**
 * Table sounds. The real recorded sounds from the original F.A Poker table
 * (poker chips, card deal, table knock — served by /sounds/[name]) are played
 * through Web Audio; tiny beeps are only a fallback while they load.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    // Phones start audio "suspended" until the player taps — wake it up.
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Unlock sound on the first tap anywhere (iPhone/Android block audio until then).
if (typeof window !== "undefined") {
  const unlock = () => {
    const a = audio();
    if (a) {
      const o = a.createOscillator();
      const g = a.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.01);
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchend", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("touchend", unlock);
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

export function soundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setSoundsMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/* ---------- recorded sounds from the original table ---------- */
const SAMPLE_FILES = {
  chips: "/sounds/poker-chips.mp3",
  deal: "/sounds/card-deal.mp3",
  knock: "/sounds/check-knock.mp3",
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
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("missing"))))
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => a.decodeAudioData(data, resolve, reject)),
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

function beep(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.04) {
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
