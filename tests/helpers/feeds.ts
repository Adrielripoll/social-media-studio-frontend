import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { apiUrl, corsHeaders, user } from "./auth";
interface Profile {
  username: string;
  name: string;
  category: string;
  bio: string;
  website: string;
  followers: number;
  following: number;
  avatarMediaId: string | null;
}
interface Post {
  id: string;
  caption: string;
  location: string;
  likes: number;
  mediaIds: string[];
}
interface Media {
  id: string;
  url: string;
  purpose: string;
  mediaType?: "image" | "video";
  status?:
    "uploading" | "queued" | "processing" | "processed" | "ready" | "failed";
  posterUrl?: string;
}
export interface Feed {
  pendingDeletion?: boolean;
  id: string;
  name: string;
  userId: string;
  clientId: string | null;
  platform: string;
  revision: number;
  profile: Profile;
  posts: Post[];
  media: Media[];
}
export function feed(name = "Meu feed", clientId: string | null = null): Feed {
  return {
    id: randomUUID(),
    name,
    userId: user.id,
    clientId,
    platform: "instagram",
    revision: 0,
    profile: {
      username: "sua.marca",
      name: "Sua marca",
      category: "Marca",
      bio: "",
      website: "",
      followers: 0,
      following: 0,
      avatarMediaId: null,
    },
    posts: [],
    media: [],
  };
}
export async function mockFeeds(page: Page, initial: Feed[] = []) {
  const state = {
    feeds: structuredClone(initial),
    failLoad: false,
    failSave: false,
    failUpload: false,
    conflict: false,
    holdSave: false,
    releaseSave: undefined as (() => void) | undefined,
  };
  const requests: {
    method: string;
    path: string;
    body: unknown;
    csrf?: string;
    cookie?: string;
    contentType?: string;
  }[] = [];
  await page.route("https://assets.test/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/kWQAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route(apiUrl + "/feeds**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      headers = await request.allHeaders();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const parts = url.pathname.split("/"),
      id = parts[2],
      mediaId = parts[4];
    const multipart = headers["content-type"]?.includes("multipart/form-data");
    const body =
      request.postData() && !multipart ? request.postDataJSON() : null;
    requests.push({
      method,
      path: url.pathname,
      body,
      csrf: headers["x-csrf-token"],
      cookie: headers.cookie,
      contentType: headers["content-type"],
    });
    let status = 200,
      value: unknown = {};
    const current = state.feeds.find((item) => item.id === id);
    if (method === "GET") {
      if (state.failLoad) {
        status = 503;
        value = { message: "Falha ao carregar os feeds." };
      } else
        value = id
          ? current
          : {
              feeds: state.feeds.map(
                ({
                  id,
                  name,
                  userId,
                  clientId,
                  platform,
                  revision,
                  pendingDeletion,
                }) => ({
                  id,
                  name,
                  userId,
                  clientId,
                  platform,
                  revision,
                  pendingDeletion,
                }),
              ),
            };
    } else if (method === "POST" && !id) {
      const created = feed(body.name, body.clientId);
      state.feeds.push(created);
      status = 201;
      value = created;
    } else if (method === "POST" && parts[3] === "media") {
      if (state.failUpload) {
        status = 503;
        value = { message: "Falha ao enviar a imagem. Tente novamente." };
      } else {
        const media = {
          id: randomUUID(),
          url: "",
          purpose: url.searchParams.get("purpose")!,
        };
        media.url =
          "https://assets.test/" +
          id +
          "/" +
          media.id +
          ".webp?token=test-only";
        current!.media.push(media);
        value = media;
        status = 201;
      }
    } else if (method === "PUT") {
      if (state.holdSave) {
        state.holdSave = false;
        await new Promise<void>((resolve) => {
          state.releaseSave = resolve;
        });
      }
      if (state.conflict || body.revision !== current!.revision) {
        status = 409;
        value = {
          message:
            "Este feed foi alterado em outra aba. Recarregue antes de editar novamente.",
        };
      } else if (state.failSave) {
        state.failSave = false;
        status = 503;
        value = { message: "Falha ao salvar o feed. Tente novamente." };
      } else {
        Object.assign(current!, body, { revision: current!.revision + 1 });
        value = { revision: current!.revision, cleanupPending: false };
      }
    } else if (method === "DELETE") {
      if (mediaId)
        current!.media = current!.media.filter((media) => media.id !== mediaId);
      else state.feeds = state.feeds.filter((item) => item.id !== id);
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  return { state, requests };
}
export async function png(page: Page, color = "#e47860") {
  const url = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = color;
    context.fillRect(0, 0, 300, 400);
    return canvas.toDataURL("image/png");
  }, color);
  return {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(url.split(",")[1], "base64"),
  };
}
