import assert from "node:assert/strict";
import test from "node:test";

void test("sound unlock recovers from phone interruptions and unavailable storage", async (t) => {
  let canResume = false;
  let bufferStarts = 0;
  const contexts: FakeAudio[] = [];
  class FakeAudio {
    state = "suspended";
    sampleRate = 48000;
    currentTime = 0;
    destination = {};
    constructor() {
      contexts.push(this);
    }
    async resume() {
      if (!canResume) throw new Error("gesture required");
      this.state = "running";
    }
    createBuffer() {
      return {};
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start() {
          bufferStarts++;
        },
      };
    }
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
    createOscillator() {
      return {
        type: "",
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {},
      };
    }
    async decodeAudioData() {
      return {};
    }
  }
  const browser = Object.assign(new EventTarget(), { AudioContext: FakeAudio });
  const documentMock = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const old = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, {
    window: browser,
    document: documentMock,
    localStorage: {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    },
    fetch: async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    }),
  });
  const {
    unlockSounds,
    listenForSoundUnlock,
    soundsMuted,
    setSoundsMuted,
    playSound,
  } = await import("./sounds");
  const stop = listenForSoundUnlock();
  t.after(() => {
    stop();
    Object.assign(globalThis, old);
  });
  assert.equal(await unlockSounds(), false);
  canResume = true;
  browser.dispatchEvent(new Event("touchend"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(contexts[0]?.state, "running");
  assert.ok(bufferStarts > 0);
  contexts[0]!.state = "interrupted";
  browser.dispatchEvent(new Event("pointerup"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(contexts[0]?.state, "running");
  contexts[0]!.state = "closed";
  assert.equal(await unlockSounds(), true);
  assert.equal(contexts.length, 2);
  setSoundsMuted(true);
  assert.equal(soundsMuted(), true);
  const before = bufferStarts;
  playSound("bet");
  assert.equal(bufferStarts, before);
  setSoundsMuted(false);
  assert.equal(soundsMuted(), false);
  assert.doesNotThrow(() => playSound("bet"));
});
