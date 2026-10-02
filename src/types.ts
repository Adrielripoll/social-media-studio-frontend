export interface Profile {
  username: string;
  name: string;
  category: string;
  bio: string;
  website: string;
  followers: number;
  following: number;
  avatar: string;
}
export interface Post {
  id: string;
  images: string[];
  caption: string;
  location: string;
  likes: number;
}
export interface Project {
  id: string;
  title: string;
  profile: Profile;
  posts: Post[];
}
export interface Workspace {
  version: 1;
  activeProjectId: string;
  projects: Project[];
}
