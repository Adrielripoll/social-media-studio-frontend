import type { PostMedia } from "../types";

export interface PostDraft {
  caption: string;
  location: string;
  likes: number;
  media: PostMedia[];
}

/** URLs and processing status can change without editing the publication. */
export function hasPostDraftChanges(
  initial: PostDraft,
  current: PostDraft,
): boolean {
  return (
    initial.caption !== current.caption ||
    initial.location !== current.location ||
    initial.likes !== current.likes ||
    initial.media.length !== current.media.length ||
    initial.media.some((item, index) => {
      const next = current.media[index];
      return (item.id ?? item.url) !== (next.id ?? next.url);
    })
  );
}
