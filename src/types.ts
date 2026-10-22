export interface Profile {
  username: string;
  name: string;
  category: string;
  bio: string;
  website: string;
  followers: number;
  following: number;
  avatar: string;
  avatarMediaId?: string | null;
}
export interface PostMedia {
  id?: string;
  url: string;
  mediaType: "image" | "video";
  status?:
    "uploading" | "queued" | "processing" | "processed" | "ready" | "failed";
  posterUrl?: string;
  duration?: number | null;
}
export interface Post {
  media?: PostMedia[];
  id: string;
  images: string[];
  mediaIds?: string[];
  caption: string;
  location: string;
  likes: number;
}
export interface Feed {
  id: string;
  title: string;
  clientId?: string | null;
  platform?: "instagram" | "linkedin" | "tiktok";
  revision?: number;
  profile: Profile;
  posts: Post[];
}
export interface FeedWorkspace {
  version: 1;
  activeFeedId: string;
  feeds: Feed[];
}
