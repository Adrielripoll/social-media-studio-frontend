import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMediaPending,
  isMediaProcessing,
  refreshPendingMedia,
  refreshPostMedia,
} from "../src/feeds/media-refresh.ts";
import type { PostMedia } from "../src/types.ts";

test("processamento atualiza só mídias pendentes e preserva rascunho e player pronto", () => {
  const image = {
    id: "image",
    url: "image-old",
    mediaType: "image" as const,
    status: "ready" as const,
  };
  const playing = {
    id: "playing",
    url: "video-playing",
    mediaType: "video" as const,
    status: "ready" as const,
  };
  const pending = {
    id: "pending",
    url: "",
    mediaType: "video" as const,
    status: "queued" as const,
  };
  const post = {
    id: "post",
    images: ["image-old", "video-playing", ""],
    mediaIds: ["image", "playing", "pending"],
    media: [image, playing, pending],
    caption: "Legenda ainda não salva",
    location: "Rascunho",
    likes: 4,
  };
  const fresh = new Map([
    ["image", { ...image, url: "image-new" }],
    ["playing", { ...playing, url: "video-new" }],
    [
      "pending",
      {
        ...pending,
        status: "ready" as const,
        url: "video-ready",
        posterUrl: "poster",
      },
    ],
  ]);
  const result = refreshPostMedia(post, fresh, false);
  assert.deepEqual(result.images, [
    "image-old",
    "video-playing",
    "video-ready",
  ]);
  assert.equal(result.media?.[0], image);
  assert.equal(result.media?.[1], playing);
  assert.equal(result.media?.[2].status, "ready");
  assert.equal(result.caption, post.caption);
  assert.equal(result.location, post.location);
  assert.deepEqual(result.mediaIds, post.mediaIds);
  assert.deepEqual(refreshPostMedia(post, fresh, true).images, [
    "image-new",
    "video-new",
    "video-ready",
  ]);
});

test("vídeo pendente removido ou expirado deixa de aguardar indefinidamente", () => {
  const post = {
    id: "p",
    images: [""],
    mediaIds: ["gone"],
    media: [
      {
        id: "gone",
        url: "",
        mediaType: "video" as const,
        status: "processing" as const,
      },
    ],
    caption: "Preservar",
    location: "",
    likes: 0,
  };
  assert.equal(
    refreshPostMedia(post, new Map(), false).media?.[0].status,
    "failed",
  );
});

test("prévia do modal substitui vídeo pendente pela capa pronta sem reordenar as mídias", () => {
  const image: PostMedia = {
    id: "image",
    url: "image",
    mediaType: "image",
    status: "ready",
  };
  const pending: PostMedia = {
    id: "video",
    url: "",
    mediaType: "video",
    status: "processing",
  };
  const ready: PostMedia = {
    ...pending,
    status: "ready",
    url: "video.webm",
    posterUrl: "poster.webp",
    duration: 3,
  };
  const result = refreshPendingMedia(
    [image, pending],
    new Map([["video", ready]]),
  );
  assert.equal(result[0], image);
  assert.equal(result[1], ready);
  assert.equal(result[1].posterUrl, "poster.webp");
  assert.equal(result.some(isMediaPending), false);
});

test("resposta tardia não restaura mídia removida nem sobrescreve vídeo pronto", () => {
  const ready: PostMedia = {
    id: "ready",
    url: "keep-url",
    mediaType: "video",
    status: "ready",
  };
  const removed: PostMedia = {
    id: "removed",
    url: "discard",
    mediaType: "video",
    status: "ready",
  };
  assert.deepEqual(
    refreshPendingMedia(
      [ready],
      new Map([
        ["ready", { ...ready, url: "different-url" }],
        ["removed", removed],
      ]),
    ),
    [ready],
  );
});

test("prévia preserva pendências em falha temporária e encerra em falha de processamento", () => {
  const pending: PostMedia = {
    id: "video",
    url: "",
    mediaType: "video",
    status: "queued",
  };
  assert.equal(refreshPendingMedia([pending], new Map())[0], pending);
  const failed: PostMedia = { ...pending, status: "failed" };
  const result = refreshPendingMedia([pending], new Map([["video", failed]]));
  assert.equal(result[0].status, "failed");
  assert.equal(result.some(isMediaPending), false);
});

test("vídeo preparado encerra o polling do modal e continua pendente no feed até a confirmação", () => {
  const pending: PostMedia = {
    id: "video",
    url: "",
    mediaType: "video",
    status: "processing",
  };
  const prepared: PostMedia = {
    ...pending,
    status: "processed",
    posterUrl: "data:image/webp;base64,test",
  };
  const result = refreshPendingMedia([pending], new Map([["video", prepared]]));
  assert.equal(result[0].posterUrl, prepared.posterUrl);
  assert.equal(isMediaPending(result[0]), true);
  assert.equal(isMediaProcessing(result[0]), false);
  const stored: PostMedia = {
    ...prepared,
    status: "ready",
    url: "private-video-url",
    posterUrl: "private-poster-url",
  };
  assert.equal(
    refreshPendingMedia(result, new Map([["video", stored]]))[0],
    stored,
  );
});
