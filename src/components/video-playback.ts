export interface VideoPlaybackTarget {
  muted: boolean;
  play(): Promise<void>;
}

export type VideoPlaybackState = "playing" | "muted" | "blocked" | "cancelled";

export async function startVideoPlayback(
  video: VideoPlaybackTarget,
  signal: AbortSignal,
): Promise<VideoPlaybackState> {
  if (signal.aborted) return "cancelled";
  video.muted = false;
  try {
    await video.play();
    return signal.aborted ? "cancelled" : "playing";
  } catch (error) {
    if (signal.aborted) return "cancelled";
    if (!(error instanceof Error) || error.name !== "NotAllowedError") {
      return "blocked";
    }
  }
  video.muted = true;
  try {
    await video.play();
    return signal.aborted ? "cancelled" : "muted";
  } catch {
    return signal.aborted ? "cancelled" : "blocked";
  }
}
