import StudioImage from "./StudioImage";
import { useEffect, useState } from "react";
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
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight")
        setIndex((current) =>
          Math.max(0, Math.min(current + 1, post.images.length - 1)),
        );
      if (event.key === "ArrowLeft")
        setIndex((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [post.images.length]);
  return (
    <Dialog
      title="Publicação"
      onClose={onClose}
      className={"viewer-dialog viewer-" + mode}
    >
      <div className="viewer-body">
        <div className="viewer-media">
          <StudioImage
            src={post.images[index]}
            alt={
              post.images.length
                ? "Imagem " + (index + 1) + " de " + post.images.length
                : "Arquivos removidos"
            }
            fallback={
              post.images.length
                ? undefined
                : "Arquivos removidos. O texto desta publicação foi preservado."
            }
          />
          {index > 0 && (
            <button
              className="carousel-arrow prev"
              aria-label="Imagem anterior"
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {index < post.images.length - 1 && (
            <button
              className="carousel-arrow next"
              aria-label="Próxima imagem"
              onClick={() => setIndex(index + 1)}
            >
              <ChevronRight size={22} />
            </button>
          )}
          {post.images.length > 1 && (
            <span className="carousel-count">
              {index + 1}/{post.images.length}
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
                {post.images.map((_, i) => (
                  <button
                    key={i}
                    aria-label={"Ver imagem " + (i + 1)}
                    aria-current={i === index ? "true" : undefined}
                    className={i === index ? "active" : ""}
                    onClick={() => setIndex(i)}
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
