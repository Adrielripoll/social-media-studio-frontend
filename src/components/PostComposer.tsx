import StudioMedia from "./StudioMedia";
import MotionPresence from "./MotionPresence";
import { hasPostDraftChanges } from "./post-draft";
import { useEffect, useState, useRef } from "react";
import { getFeedVideo, isVideoFile } from "../feeds/api";
import { ApiError } from "../auth/api";
import { isMediaProcessing, refreshPendingMedia } from "../feeds/media-refresh";
import { useMotionExiting } from "./MotionPresence";
import {
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
} from "lucide-react";
import type { Post, PostMedia } from "../types";
import { uid } from "../data";
import { readImage } from "../storage";
import Dialog from "./Dialog";

export default function PostComposer({
  post,
  feedId,
  onClose,
  onSave,
  prepareImage,
  discardMedia,
}: {
  prepareImage?: (
    file: File,
    onProgress?: (percent: number) => void,
  ) => Promise<PostMedia>;
  discardMedia?: (ids: string[]) => Promise<void>;
  post?: Post;
  feedId?: string;
  onClose: () => void;
  onSave: (post: Post) => void;
}) {
  const [media, setMedia] = useState<PostMedia[]>(
    post?.media ??
      post?.images.map((url, index) => ({
        id: post.mediaIds?.[index],
        url,
        mediaType: "image" as const,
        status: "ready" as const,
      })) ??
      [],
  );
  const addedMedia = useRef(new Set<string>());
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [location, setLocation] = useState(post?.location ?? "");
  const [likes, setLikes] = useState(post?.likes ?? 128);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    percent: number;
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const initialDraft = useRef({ caption, location, likes, media });
  const submitted = useRef(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = hasPostDraftChanges(initialDraft.current, {
    caption,
    location,
    likes,
    media,
  });
  const [previewError, setPreviewError] = useState("");
  const exiting = useMotionExiting();
  const pendingMediaIds = media
    .filter(isMediaProcessing)
    .flatMap((item) => (item.id ? [item.id] : []))
    .sort()
    .join(",");

  useEffect(() => {
    if (!feedId || !pendingMediaIds || exiting) return;
    const currentFeedId = feedId;
    const controller = new AbortController();
    const ids = pendingMediaIds.split(",");
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refreshPreviews() {
      const updates = new Map<string, PostMedia>();
      let unavailable = false;
      await Promise.all(
        ids.map(async (id) => {
          try {
            const updated = await getFeedVideo(
              currentFeedId,
              id,
              controller.signal,
            );
            updates.set(id, updated);
          } catch (reason) {
            if (controller.signal.aborted) return;
            if (reason instanceof ApiError && reason.status === 404) {
              updates.set(id, {
                id,
                url: "",
                mediaType: "video",
                status: "failed",
              });
            } else {
              unavailable = true;
            }
          }
        }),
      );
      if (controller.signal.aborted) return;
      setMedia((current) => refreshPendingMedia(current, updates));
      setPreviewError(
        unavailable
          ? "Não foi possível atualizar a prévia. Tentando novamente."
          : "",
      );
      const stillPending = ids.some((id) => {
        const updated = updates.get(id);
        return !updated || isMediaProcessing(updated);
      });
      if (stillPending) timer = setTimeout(() => void refreshPreviews(), 5000);
    }

    void refreshPreviews();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [feedId, pendingMediaIds, exiting]);

  useEffect(() => {
    if ((!dirty && !busy) || exiting) return;
    function warn(event: BeforeUnloadEvent) {
      if (!submitted.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, exiting]);

  function discardAndClose() {
    if (busy) return;
    if (discardMedia)
      void discardMedia([...addedMedia.current]).catch(() => undefined);
    onClose();
  }

  function close() {
    if (busy) return;
    if (dirty) {
      setDiscardOpen(true);
    } else {
      discardAndClose();
    }
  }

  async function addFiles(files: File[]) {
    if (busy || !files.length) return;
    if (files.length + media.length > 10) {
      setError("Um carrossel pode ter até 10 imagens ou vídeos.");
      return;
    }
    setBusy(true);
    setError("");
    const added: PostMedia[] = [];
    const videoTotal = files.filter(isVideoFile).length;
    let videoNumber = 0;
    try {
      for (const file of files) {
        const videoProgress = isVideoFile(file)
          ? { percent: 0, current: ++videoNumber, total: videoTotal }
          : null;
        setProgress(videoProgress);
        const item = prepareImage
          ? await prepareImage(file, (percent) => {
              if (videoProgress) setProgress({ ...videoProgress, percent });
            })
          : { url: await readImage(file), mediaType: "image" as const };
        added.push(item);
        if (item.id) addedMedia.current.add(item.id);
      }
      setMedia((current) => [...current, ...added]);
    } catch (reason) {
      if (discardMedia) {
        const ids = added.flatMap((item) => (item.id ? [item.id] : []));
        await discardMedia(ids);
        for (const id of ids) addedMedia.current.delete(id);
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar os arquivos.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  function move(index: number, offset: number) {
    setMedia((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  return (
    <>
      <Dialog
        title={post ? "Editar publicação" : "Nova publicação"}
        onClose={busy ? () => {} : close}
        className="composer-dialog"
        busy={busy}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!media.length || busy) return;
            submitted.current = true;
            onSave({
              id: post?.id ?? uid(),
              images: media.map((item) => item.url),
              media,
              caption,
              location,
              likes,
              ...(prepareImage
                ? {
                    mediaIds: media.flatMap((item) =>
                      item.id ? [item.id] : [],
                    ),
                  }
                : {}),
            });
          }}
        >
          <p className="dialog-intro">
            Organize até 10 mídias. Após o envio, os vídeos são processados em
            segundo plano.
          </p>
          <input
            ref={input}
            className="visually-hidden"
            type="file"
            multiple
            accept={
              prepareImage
                ? "image/jpeg,image/png,image/webp,.mp4,.mov,.avi,.mkv,.wmv"
                : "image/jpeg,image/png,image/webp"
            }
            aria-label="Selecionar arquivos da publicação"
            onChange={(event) =>
              void addFiles(Array.from(event.target.files ?? []))
            }
            disabled={busy}
          />
          <button
            className={
              "upload-area " +
              (dropActive ? "is-dragging " : "") +
              (busy ? "is-uploading" : "")
            }
            type="button"
            disabled={busy || media.length >= 10}
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropActive(false);
              void addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            {busy ? (
              <LoaderCircle className="spin" size={30} />
            ) : (
              <ImagePlus size={30} />
            )}
            <strong role="status" aria-live="polite" aria-atomic="true">
              {busy
                ? progress === null
                  ? "Enviando arquivos…"
                  : "Enviando vídeo: " +
                    progress.percent +
                    "% · " +
                    progress.current +
                    "/" +
                    progress.total +
                    (progress.total === 1 ? " vídeo" : " vídeos")
                : media.length
                  ? "Adicionar mais arquivos"
                  : "Arraste seus arquivos para cá"}
            </strong>
            <span>
              {busy
                ? "Aguarde o envio dos arquivos selecionados."
                : media.length
                  ? media.length + " de 10 mídias · a primeira será a capa"
                  : "ou clique para escolher"}
            </span>
            <small>
              {prepareImage
                ? "Imagens: JPG, PNG e WebP até 20 MB. Vídeos: MP4, MOV, AVI, MKV e WMV até 200 MB e 3 minutos."
                : "Até 10 imagens, com até 20 MB cada"}
            </small>
          </button>
          {media.length > 0 && (
            <div className="image-strip">
              {media.map((item, index) => (
                <div className="image-thumb" key={item.id ?? index}>
                  <StudioMedia
                    media={item}
                    alt={"Mídia " + (index + 1) + " do carrossel"}
                  />
                  <span className="thumb-order">
                    {index === 0 ? "Capa" : index + 1}
                  </span>
                  <button
                    type="button"
                    className="thumb-remove"
                    aria-label={"Remover mídia " + (index + 1)}
                    disabled={busy}
                    onClick={() => {
                      if (item.id && addedMedia.current.has(item.id)) {
                        addedMedia.current.delete(item.id);
                        if (discardMedia) void discardMedia([item.id]);
                      }
                      setMedia((current) =>
                        current.filter((_, position) => position !== index),
                      );
                    }}
                  >
                    <X size={13} />
                  </button>
                  <div className="thumb-arrows">
                    <button
                      type="button"
                      aria-label={
                        "Mover mídia " + (index + 1) + " para a esquerda"
                      }
                      disabled={index === 0 || busy}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        "Mover mídia " + (index + 1) + " para a direita"
                      }
                      disabled={index === media.length - 1 || busy}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {media.some(isMediaProcessing) && (
            <p className="video-upload-note" role="status">
              Upload concluído. Você pode adicionar a publicação e continuar
              usando o Studio enquanto o vídeo é processado.
            </p>
          )}
          {!media.some(isMediaProcessing) &&
            media.some((item) => item.status === "processed") && (
              <p className="video-upload-note" role="status">
                Vídeo preparado. Ele será armazenado ao adicionar a publicação
                ao feed.
              </p>
            )}
          {previewError && pendingMediaIds && (
            <p className="video-upload-note" role="status">
              {previewError}
            </p>
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
              placeholder="Escreva a legenda da publicação"
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
              disabled={!media.length || busy}
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
      <MotionPresence>
        {discardOpen && (
          <Dialog
            title="Descartar alterações?"
            onClose={() => setDiscardOpen(false)}
          >
            <p>As alterações desta publicação ainda não foram salvas.</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                data-initial-focus
                onClick={() => setDiscardOpen(false)}
              >
                Continuar editando
              </button>
              <button
                type="button"
                className="button danger-button"
                onClick={discardAndClose}
              >
                Descartar alterações
              </button>
            </div>
          </Dialog>
        )}
      </MotionPresence>
    </>
  );
}
