import { useState, useRef } from "react";
import {
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
} from "lucide-react";
import type { Post } from "../types";
import { uid } from "../data";
import { readImage } from "../storage";
import Dialog from "./Dialog";

export default function PostComposer({
  post,
  onClose,
  onSave,
  prepareImage,
  discardMedia,
}: {
  prepareImage?: (file: File) => Promise<{ id: string; url: string }>;
  discardMedia?: (ids: string[]) => Promise<void>;
  post?: Post;
  onClose: () => void;
  onSave: (post: Post) => void;
}) {
  const [images, setImages] = useState<string[]>(post?.images ?? []);
  const [mediaIds, setMediaIds] = useState<string[]>(post?.mediaIds ?? []);
  const addedMedia = useRef(new Set<string>());
  function close() {
    if (discardMedia) void discardMedia([...addedMedia.current]);
    onClose();
  }
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [location, setLocation] = useState(post?.location ?? "");
  const [likes, setLikes] = useState(post?.likes ?? 128);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function addImages(files: File[]) {
    if (busy || !files.length) return;
    if (files.length + images.length > 10) {
      setError("Um carrossel pode ter até 10 imagens.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const added: { url: string; id?: string }[] = [];
      try {
        for (const file of files)
          added.push(
            prepareImage
              ? await prepareImage(file)
              : { url: await readImage(file) },
          );
      } catch (reason) {
        if (discardMedia)
          await discardMedia(
            added.flatMap((item) => (item.id ? [item.id] : [])),
          );
        throw reason;
      }
      for (const item of added) if (item.id) addedMedia.current.add(item.id);
      setImages((current) => [...current, ...added.map((item) => item.url)]);
      setMediaIds((current) => [
        ...current,
        ...added.flatMap((item) => (item.id ? [item.id] : [])),
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as imagens.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function move(index: number, offset: number) {
    setMediaIds((current) => {
      if (!current.length) return current;
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
    setImages((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  return (
    <Dialog
      title={post ? "Editar publicação" : "Nova publicação"}
      onClose={busy ? () => {} : close}
      className="composer-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!images.length || busy) return;
          onSave({
            id: post?.id ?? uid(),
            images,
            caption,
            location,
            likes,
            ...(prepareImage ? { mediaIds } : {}),
          });
        }}
      >
        <p className="dialog-intro">
          Uma imagem conta uma história. Um carrossel conta o resto.
        </p>
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar imagens da publicação"
          onChange={(event) =>
            void addImages(Array.from(event.target.files ?? []))
          }
          disabled={busy}
        />
        <button
          className={"upload-area " + (dropActive ? "is-dragging" : "")}
          type="button"
          disabled={busy || images.length >= 10}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropActive(false);
            void addImages(Array.from(event.dataTransfer.files));
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={30} />
          ) : (
            <ImagePlus size={30} />
          )}
          <strong>
            {busy
              ? "Preparando imagens…"
              : images.length
                ? "Adicionar mais imagens"
                : "Arraste suas imagens para cá"}
          </strong>
          <span>
            {images.length
              ? images.length + " de 10 imagens · a primeira será a capa"
              : "ou clique para escolher · JPG, PNG ou WebP"}
          </span>
          <small>Até 10 imagens, com até 20 MB cada</small>
        </button>
        {images.length > 0 && (
          <div className="image-strip">
            {images.map((image, index) => (
              <div className="image-thumb" key={index}>
                <img
                  src={image}
                  alt={"Imagem " + (index + 1) + " do carrossel"}
                />
                <span className="thumb-order">
                  {index === 0 ? "Capa" : index + 1}
                </span>
                <button
                  type="button"
                  className="thumb-remove"
                  aria-label={"Remover imagem " + (index + 1)}
                  disabled={busy}
                  onClick={() => {
                    const id = mediaIds[index];
                    if (id && addedMedia.current.has(id)) {
                      addedMedia.current.delete(id);
                      if (discardMedia) void discardMedia([id]);
                    }
                    setMediaIds((current) =>
                      current.filter((_, i) => i !== index),
                    );
                    setImages((current) =>
                      current.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <X size={13} />
                </button>
                <div className="thumb-arrows">
                  <button
                    type="button"
                    aria-label={
                      "Mover imagem " + (index + 1) + " para a esquerda"
                    }
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      "Mover imagem " + (index + 1) + " para a direita"
                    }
                    disabled={index === images.length - 1 || busy}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="field">
          <span>
            Legenda <small>{caption.length}/2.200</small>
          </span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={2200}
            rows={4}
            placeholder="O que essa publicação tem para contar?"
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Localização</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ex.: São Paulo, Brasil"
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>Curtidas fictícias</span>
            <input
              type="number"
              min="0"
              max="999999999"
              value={likes}
              onChange={(event) =>
                setLikes(
                  Math.min(
                    999999999,
                    Math.max(0, Math.trunc(Number(event.target.value))),
                  ),
                )
              }
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={!images.length || busy}
          >
            {post ? (
              "Salvar publicação"
            ) : (
              <>
                <Plus size={16} />
                Adicionar ao feed
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
