import { test } from "node:test";
import assert from "node:assert/strict";
import { startVideoPlayback } from "../src/components/video-playback.ts";

test("inicia com áudio sem exigir um segundo clique", async () => {
  let calls = 0;
  const video = {
    muted: true,
    async play() {
      calls++;
      assert.equal(this.muted, false);
    },
  };
  assert.equal(
    await startVideoPlayback(video, new AbortController().signal),
    "playing",
  );
  assert.equal(calls, 1);
});

test("bloqueio de áudio tenta autoplay mudo e informa que precisa ativar o som", async () => {
  const mutedStates: boolean[] = [];
  const video = {
    muted: false,
    async play() {
      mutedStates.push(this.muted);
      if (!this.muted)
        throw new DOMException("Audio blocked", "NotAllowedError");
    },
  };
  assert.equal(
    await startVideoPlayback(video, new AbortController().signal),
    "muted",
  );
  assert.deepEqual(mutedStates, [false, true]);
});

test("uma falha de decodificação não é confundida com bloqueio de áudio", async () => {
  let calls = 0;
  const video = {
    muted: false,
    async play() {
      calls++;
      throw new DOMException("Unsupported", "NotSupportedError");
    },
  };
  assert.equal(
    await startVideoPlayback(video, new AbortController().signal),
    "blocked",
  );
  assert.equal(calls, 1);
  assert.equal(video.muted, false);
});

test("sair do slide impede uma tentativa tardia de autoplay mudo", async () => {
  const controller = new AbortController();
  let calls = 0;
  const video = {
    muted: false,
    async play() {
      calls++;
      controller.abort();
      throw new DOMException("Audio blocked", "NotAllowedError");
    },
  };
  assert.equal(await startVideoPlayback(video, controller.signal), "cancelled");
  assert.equal(calls, 1);
});

test("se o navegador bloquear as duas tentativas, mantém alternativa manual", async () => {
  const video = {
    muted: false,
    async play() {
      throw new DOMException("Blocked", "NotAllowedError");
    },
  };
  assert.equal(
    await startVideoPlayback(video, new AbortController().signal),
    "blocked",
  );
});
