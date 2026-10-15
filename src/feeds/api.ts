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
    })),
  };
}
export async function getFeed(id: string, signal?: AbortSignal) {
  return toFeed(await apiRequest<RemoteFeed>("/feeds/" + id, { signal }));
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
  );
}
export function deleteFeed(id: string) {
  return apiRequest<void>("/feeds/" + id, {
    method: "DELETE",
    timeoutMs: 60_000,
  });
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
  );
}
export function deleteUnusedImage(feedId: string, mediaId: string) {
  return apiRequest<void>("/feeds/" + feedId + "/media/" + mediaId, {
    method: "DELETE",
    timeoutMs: 60_000,
  });
}
