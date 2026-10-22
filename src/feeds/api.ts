import { Upload } from "tus-js-client";
import type { PostMedia } from "../types";
import { storageChanged } from "../account/AccountContext";
import { apiRequest, ApiError } from "../auth/api";
import type { Feed, Post, Profile } from "../types";
import { readImage } from "../storage";
export interface FeedSummary {
  pendingDeletion?: boolean;
  id: string;
  name: string;
  clientId: string | null;
  platform: "instagram" | "linkedin" | "tiktok";
  revision: number;
}
interface RemoteMedia {
  id: string;
  url: string;
  mediaType?: "image" | "video";
  status?: PostMedia["status"];
  posterUrl?: string;
  duration?: number | null;
}
interface RemoteFeed extends FeedSummary {
  profile: Omit<Profile, "avatar"> & { avatarMediaId: string | null };
  posts: (Omit<Post, "images"> & { mediaIds: string[] })[];
  media: RemoteMedia[];
}
export async function listFeeds(signal?: AbortSignal) {
  const result = await apiRequest<{ feeds: FeedSummary[] }>("/feeds", {
    signal,
  });
  if (!Array.isArray(result.feeds)) throw new ApiError(502);
  return result.feeds;
}
export function toFeed(value: RemoteFeed): Feed {
  const urls = new Map(value.media.map((media) => [media.id, media.url]));
  return {
    id: value.id,
    title: value.name,
    platform: value.platform,
    clientId: value.clientId,
    revision: value.revision,
    profile: {
      ...value.profile,
      avatar: urls.get(value.profile.avatarMediaId ?? "") ?? "",
    },
    posts: value.posts.map((post) => ({
      ...post,
      images: post.mediaIds.map((id) => urls.get(id) ?? ""),
      media: post.mediaIds.map((id) => {
        const media = value.media.find((item) => item.id === id);
        return {
          ...media,
          id,
          url: media?.url ?? "",
          mediaType: media?.mediaType ?? "image",
        };
      }),
    })),
  };
}
export async function getFeed(id: string, signal?: AbortSignal) {
  return toFeed(await apiRequest<RemoteFeed>("/feeds/" + id, { signal }));
}
export function getFeedVideo(
  feedId: string,
  mediaId: string,
  signal?: AbortSignal,
): Promise<PostMedia> {
  return apiRequest<PostMedia>("/feeds/" + feedId + "/videos/" + mediaId, {
    signal,
  });
}

export async function createFeed(name: string, clientId: string | null = null) {
  return toFeed(
    await apiRequest<RemoteFeed>("/feeds", {
      method: "POST",
      body: { name, clientId, platform: "instagram" },
    }),
  );
}
export function saveFeed(feed: Feed, revision: number) {
  const { avatar: _avatar, ...profile } = feed.profile;
  return apiRequest<{ revision: number; cleanupPending: boolean }>(
    "/feeds/" + feed.id,
    {
      method: "PUT",
      timeoutMs: 60_000,
      body: {
        name: feed.title,
        clientId: feed.clientId ?? null,
        revision,
        profile: { ...profile, avatarMediaId: profile.avatarMediaId ?? null },
        posts: feed.posts.map(({ id, caption, location, likes, mediaIds }) => ({
          id,
          caption,
          location,
          likes,
          mediaIds: mediaIds ?? [],
        })),
      },
    },
  ).finally(storageChanged);
}
export function deleteFeed(id: string) {
  return apiRequest<void>("/feeds/" + id, {
    method: "DELETE",
    timeoutMs: 60_000,
  }).finally(storageChanged);
}
export async function uploadFeedImage(
  feedId: string,
  file: File,
  purpose: "post" | "avatar",
) {
  const url = await readImage(file, purpose === "avatar" ? 600 : 1600);
  const image = await fetch(url).then((response) => response.blob());
  const body = new FormData();
  body.append("file", image, "image.webp");
  return apiRequest<RemoteMedia>(
    "/feeds/" + feedId + "/media?purpose=" + purpose,
    { method: "POST", body, timeoutMs: 60_000 },
  ).finally(storageChanged);
}
export function deleteUnusedImage(feedId: string, mediaId: string) {
  return apiRequest<void>("/feeds/" + feedId + "/media/" + mediaId, {
    method: "DELETE",
    timeoutMs: 60_000,
  }).finally(storageChanged);
}

export function isVideoFile(file: File): boolean {
  return /\.(mp4|mov|avi|mkv|wmv)$/i.test(file.name);
}

export async function uploadFeedMedia(
  feedId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<PostMedia> {
  if (!isVideoFile(file)) {
    return {
      ...(await uploadFeedImage(feedId, file, "post")),
      mediaType: "image",
      status: "ready",
    };
  }
  if (file.size < 1 || file.size > 200_000_000) {
    throw new Error("Cada vídeo pode ter até 200 MB.");
  }
  const authorization = await apiRequest<{
    id: string;
    endpoint: string;
    token: string;
    bucket: string;
    path: string;
  }>("/feeds/" + feedId + "/videos", {
    method: "POST",
    body: { filename: file.name, size: file.size },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: authorization.endpoint,
        headers: { "x-signature": authorization.token },
        metadata: {
          bucketName: authorization.bucket,
          objectName: authorization.path,
          contentType: file.type || "application/octet-stream",
        },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: false,
        onProgress: (uploaded, total) =>
          onProgress?.(Math.round((uploaded / total) * 100)),
        onError: () =>
          reject(
            new Error(
              "Não foi possível concluir o upload do vídeo. Tente novamente.",
            ),
          ),
        onSuccess: () => resolve(),
      });
      upload.start();
    });
    return await apiRequest<PostMedia>(
      "/feeds/" + feedId + "/videos/" + authorization.id + "/complete",
      { method: "POST" },
    );
  } catch (error) {
    await deleteUnusedImage(feedId, authorization.id).catch(() => undefined);
    throw error;
  } finally {
    storageChanged();
  }
}
