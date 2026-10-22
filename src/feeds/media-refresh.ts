import type { Post, PostMedia } from "../types";

export function isMediaProcessing(media: PostMedia): boolean {
  return isMediaPending(media) && media.status !== "processed";
}

export function isMediaPending(media: PostMedia): boolean {
  return (
    media.mediaType === "video" &&
    media.status !== "ready" &&
    media.status !== "failed"
  );
}

export function refreshPendingMedia(
  media: PostMedia[],
  fresh: Map<string, PostMedia>,
): PostMedia[] {
  return media.map((item) => {
    if (!isMediaPending(item)) return item;
    return fresh.get(item.id ?? "") ?? item;
  });
}

export function refreshPostMedia(
  post: Post,
  fresh: Map<string, PostMedia>,
  refreshUrls: boolean,
): Post {
  return {
    ...post,
    media: post.media?.map((media) => {
      if (!refreshUrls && !isMediaPending(media)) return media;
      const replacement = fresh.get(media.id ?? "");
      if (replacement) return replacement;
      if (isMediaPending(media)) return { ...media, status: "failed" as const };
      return media;
    }),
    images: post.images.map((url, index) => {
      const current = post.media?.[index];
      const replacement = fresh.get(
        post.mediaIds?.[index] ?? current?.id ?? "",
      );
      return refreshUrls || (current && isMediaPending(current))
        ? (replacement?.url ?? url)
        : url;
    }),
  };
}
