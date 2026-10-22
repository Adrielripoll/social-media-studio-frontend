import StudioMedia from "./StudioMedia";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Bookmark,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Post, Profile } from "../types";
import { formatNumber } from "../storage";
import { Avatar } from "./ProfilePreview";
import Dialog from "./Dialog";

interface ImageSlide {
  index: number;
  previousIndex: number | null;
  direction: "next" | "previous";
}

export default function PostViewer({
  post,
  profile,
  mode,
  presentation,
  onClose,
  onEdit,
  onDelete,
}: {
  post: Post;
  profile: Profile;
  mode: "desktop" | "mobile";
  presentation: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [slide, setSlide] = useState<ImageSlide>({
    index: 0,
    previousIndex: null,
    direction: "next",
  });
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const { index } = slide;
  const singleVideo =
    post.images.length === 1 && post.media?.[0]?.mediaType === "video";
  const previousImage =
    slide.previousIndex === null
      ? undefined
      : post.media?.[slide.previousIndex]?.mediaType === "video"
        ? post.media[slide.previousIndex].posterUrl
        : post.images[slide.previousIndex];

  useEffect(() => {
    const adjacentImages = [index - 1, index + 1]
      .filter((position) => post.media?.[position]?.mediaType !== "video")
      .map((position) => post.images[position]);

    for (const source of adjacentImages) {
      if (source) {
        const image = new Image();
        image.src = source;
      }
    }
  }, [index, post.images, post.media]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updateMotion(event: MediaQueryListEvent): void {
      if (event.matches) {
        setSlide((current) => ({ ...current, previousIndex: null }));
      }
    }

    preference.addEventListener("change", updateMotion);
    return () => preference.removeEventListener("change", updateMotion);
  }, []);

  const navigateImage = useCallback(
    (destination: number | "next" | "previous"): void => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      setSlide((current) => {
        const offset = destination === "previous" ? -1 : 1;
        const requestedIndex =
          typeof destination === "number"
            ? destination
            : current.index + offset;
        const nextIndex = Math.max(
          0,
          Math.min(requestedIndex, post.images.length - 1),
        );

        if (nextIndex === current.index) {
          return current;
        }

        return {
          index: nextIndex,
          previousIndex: reduceMotion ? null : current.index,
          direction: nextIndex > current.index ? "next" : "previous",
        };
      });
    },
    [post.images.length],
  );

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest("video"))
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateImage("next");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateImage("previous");
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigateImage]);

  return (
    <Dialog
      title="Publicação"
      onClose={onClose}
      className={
        "viewer-dialog viewer-" +
        mode +
        (singleVideo ? " viewer-single-video" : "")
      }
    >
      <div className="viewer-body">
        <div
          className="viewer-media"
          role="region"
          aria-label="Mídias da publicação"
          aria-roledescription="carrossel"
          onPointerDown={(event) => {
            swipeStart.current = null;

            if (
              event.pointerType !== "touch" ||
              (event.target instanceof Element &&
                event.target.closest("button, video"))
            ) {
              return;
            }

            swipeStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;

            if (!start) {
              return;
            }

            const distanceX = event.clientX - start.x;
            const distanceY = event.clientY - start.y;

            if (
              Math.abs(distanceX) < 48 ||
              Math.abs(distanceX) <= Math.abs(distanceY)
            ) {
              return;
            }

            navigateImage(distanceX < 0 ? "next" : "previous");
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          {previousImage && (
            <div
              key={"previous-" + slide.previousIndex}
              className="viewer-slide-previous"
              data-direction={slide.direction}
              aria-hidden="true"
              style={{
                backgroundImage: `url(${JSON.stringify(previousImage)})`,
              }}
            />
          )}
          <div
            key={index}
            className="viewer-slide"
            data-direction={slide.direction}
            data-animating={slide.previousIndex !== null}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) {
                setSlide((current) => ({ ...current, previousIndex: null }));
              }
            }}
          >
            <StudioMedia
              media={post.media?.[index]}
              playback
              fallback={
                post.images.length
                  ? undefined
                  : "Arquivos removidos. O texto desta publicação foi preservado."
              }
              src={post.images[index]}
              alt={
                post.images.length
                  ? "Imagem " + (index + 1) + " de " + post.images.length
                  : "Arquivos removidos"
              }
            />
          </div>
          {index > 0 && (
            <button
              className="carousel-arrow prev"
              aria-label="Mídia anterior"
              onClick={() => navigateImage("previous")}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {index < post.images.length - 1 && (
            <button
              className="carousel-arrow next"
              aria-label="Próxima mídia"
              onClick={() => navigateImage("next")}
            >
              <ChevronRight size={22} />
            </button>
          )}
          {post.images.length > 1 && (
            <span
              className="carousel-count"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="visually-hidden">Imagem </span>
              {index + 1}
              <span aria-hidden="true">/</span>
              <span className="visually-hidden"> de </span>
              {post.images.length}
            </span>
          )}
        </div>
        <div className="viewer-detail">
          <div className="viewer-user">
            <Avatar src={profile.avatar} name={profile.name} />
            <div>
              <strong>{profile.username}</strong>
              {post.location && <span>{post.location}</span>}
            </div>
          </div>
          <div className="viewer-caption">
            <strong>{profile.username}</strong>
            <p>{post.caption || "Sem legenda."}</p>
          </div>
          <div className="viewer-reactions">
            <div>
              <button
                className={"icon-button " + (liked ? "is-liked" : "")}
                aria-label={
                  liked
                    ? "Remover curtida fictícia"
                    : "Curtir publicação fictícia"
                }
                aria-pressed={liked}
                onClick={() => setLiked(!liked)}
              >
                <Heart size={25} fill={liked ? "currentColor" : "none"} />
              </button>
              <button
                className="icon-button"
                aria-label="Salvar publicação fictícia"
                aria-pressed={bookmarked}
                onClick={() => setBookmarked(!bookmarked)}
              >
                <Bookmark
                  size={25}
                  fill={bookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
            {post.images.length > 1 && (
              <div className="carousel-dots">
                {post.images.map((_, imageIndex) => (
                  <button
                    key={imageIndex}
                    aria-label={"Ver mídia " + (imageIndex + 1)}
                    aria-current={imageIndex === index ? "true" : undefined}
                    className={imageIndex === index ? "active" : ""}
                    onClick={() => navigateImage(imageIndex)}
                  />
                ))}
              </div>
            )}
            <strong>
              {formatNumber(post.likes + (liked ? 1 : 0))} curtidas
            </strong>
          </div>
          {!presentation && (
            <div className="viewer-edit">
              <button className="button secondary" onClick={onEdit}>
                <Pencil size={15} />
                Editar
              </button>
              <button
                className="icon-button danger"
                onClick={onDelete}
                aria-label="Excluir publicação"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
