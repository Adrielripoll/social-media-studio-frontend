import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPostDraftChanges } from "../src/components/post-draft.ts";
import type { PostDraft } from "../src/components/post-draft.ts";
import { videoUploadError } from "../src/feeds/video-upload-error.ts";

function draft(): PostDraft {
  return {
    caption: "",
    location: "",
    likes: 128,
    media: [
      { id: "first", url: "", mediaType: "video", status: "processing" },
      { id: "second", url: "image", mediaType: "image", status: "ready" },
    ],
  };
}

test("atualização assíncrona de vídeo não torna o rascunho alterado", () => {
  const initial = draft();
  assert.equal(
    hasPostDraftChanges(initial, {
      ...initial,
      media: [
        { ...initial.media[0], status: "processed", posterUrl: "poster" },
        initial.media[1],
      ],
    }),
    false,
  );
});
test("texto, localização, curtidas, remoção e reordenação exigem proteção do rascunho", () => {
  const initial = draft();
  for (const changed of [
    { ...initial, caption: "Legenda" },
    { ...initial, location: "Porto Alegre" },
    { ...initial, likes: 2 },
    { ...initial, media: initial.media.slice(1) },
    { ...initial, media: [...initial.media].reverse() },
  ]) {
    assert.equal(hasPostDraftChanges(initial, changed), true);
  }
});
test("reverter os campos ao estado inicial deixa de exigir descarte", () => {
  const initial = draft();
  assert.equal(
    hasPostDraftChanges(initial, { ...initial, media: [...initial.media] }),
    false,
  );
});
test("mídias locais sem ID também são comparadas por sua ordem e conteúdo", () => {
  const initial = {
    ...draft(),
    media: [{ url: "local-a", mediaType: "image" as const }],
  };
  assert.equal(
    hasPostDraftChanges(initial, {
      ...initial,
      media: [{ url: "local-b", mediaType: "image" }],
    }),
    true,
  );
});
for (const [status, expected] of [
  [413, "Reduza o arquivo"],
  [403, "autorização"],
  [410, "não está mais disponível"],
  [415, "formato"],
  [429, "Aguarde um minuto"],
  [500, "Aguarde um pouco"],
] as const) {
  test(
    "upload " + status + " informa a orientação sem expor o erro do provedor",
    () => {
      const message = videoUploadError({
        originalResponse: { getStatus: () => status },
        message: "secret-signature",
      });
      assert.ok(message.includes(expected));
      assert.ok(!message.includes("secret-signature"));
    },
  );
}
test("falha de rede orienta conferir a conexão", () => {
  assert.ok(
    videoUploadError(new Error("private-provider-error")).includes("conexão"),
  );
});
