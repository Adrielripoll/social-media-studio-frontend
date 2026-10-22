import { useEffect, useRef, useState } from "react";
import { useMotionExiting } from "./MotionPresence";
import { startVideoPlayback } from "./video-playback";
import type { VideoPlaybackState } from "./video-playback";
import type { ReactNode } from "react";
import { Film, LoaderCircle, Play, AlertCircle, Volume2 } from "lucide-react";
import type { PostMedia } from "../types";
import StudioImage from "./StudioImage";

export default function StudioMedia({
  media,
  src,
  alt = "Mídia da publicação",
  playback = false,
  draggable = false,
  fallback,
}: {
  media?: PostMedia;
  src?: string;
  alt?: string;
  playback?: boolean;
  draggable?: boolean;
  fallback?: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackState, setPlaybackState] =
    useState<VideoPlaybackState>("playing");
  const exiting = useMotionExiting();
  const playableSource =
    playback &&
    !exiting &&
    media?.mediaType === "video" &&
    (!media.status || media.status === "ready") &&
    failedSource !== media.url
      ? media.url
      : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playableSource) return;
    const controller = new AbortController();
    // Passive effects run after Dialog.showModal(), while the player is visible.
    void startVideoPlayback(video, controller.signal).then((state) => {
      if (!controller.signal.aborted) setPlaybackState(state);
    });
    return () => {
      controller.abort();
      video.pause();
    };
  }, [playableSource]);

  function playWithSound(): void {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video
      .play()
      .then(() => setPlaybackState("playing"))
      .catch(() => setPlaybackState("blocked"));
  }

  if (media?.mediaType !== "video") {
    return (
      <StudioImage
        src={src ?? media?.url}
        alt={alt}
        draggable={draggable}
        fallback={fallback}
      />
    );
  }
  const pending =
    media.status &&
    media.status !== "ready" &&
    media.status !== "failed" &&
    (media.status !== "processed" || playback);
  if (pending || media.status === "failed") {
    return (
      <span className="video-placeholder" role="status">
        {pending ? (
          <LoaderCircle size={24} className="spin" aria-hidden="true" />
        ) : (
          <AlertCircle size={24} aria-hidden="true" />
        )}
        <span>
          {media.status === "failed"
            ? "Falha no processamento. Remova e envie novamente."
            : "Vídeo em processamento"}
        </span>
      </span>
    );
  }
  if (playback && failedSource === media.url) {
    return (
      <p className="video-placeholder" role="alert">
        Não foi possível reproduzir o vídeo. Atualize a página ou tente um
        navegador compatível com WebM.
      </p>
    );
  }
  if (playback) {
    return (
      <div className="studio-video-player">
        <video
          ref={videoRef}
          className="studio-video"
          src={media.url}
          poster={media.posterUrl}
          controls
          autoPlay={!exiting}
          onError={() => setFailedSource(media.url)}
          onVolumeChange={(event) => {
            if (!event.currentTarget.muted) setPlaybackState("playing");
          }}
          playsInline
          preload="auto"
          aria-label={alt}
        />
        {(playbackState === "muted" || playbackState === "blocked") && (
          <button
            className="video-playback-action"
            type="button"
            onClick={playWithSound}
          >
            {playbackState === "muted" ? (
              <Volume2 size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {playbackState === "muted" ? "Ativar som" : "Reproduzir vídeo"}
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {media.posterUrl ? (
        <StudioImage src={media.posterUrl} alt={alt} draggable={draggable} />
      ) : (
        <span className="video-placeholder">
          <Film size={24} />
          <span>Vídeo</span>
        </span>
      )}
      <span className="video-play-marker" aria-label="Vídeo">
        <Play size={18} fill="currentColor" />
      </span>
    </>
  );
}
