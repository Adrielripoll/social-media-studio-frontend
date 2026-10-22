import StudioMedia from "../components/StudioMedia";
import { useEffect, useState } from "react";
import { Copy, LayoutGrid, RefreshCw } from "lucide-react";
import { Avatar } from "../components/ProfilePreview";
import type { Feed } from "../types";
import { getFeed } from "./api";
import { isMediaPending } from "./media-refresh";

export default function FeedCardPreview({
  feedId,
  feedName,
}: {
  feedId: string;
  feedName: string;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void getFeed(feedId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setFeed(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [feedId, reload]);

  const pending = feed?.posts.some((post) => post.media?.some(isMediaPending));
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let refreshing = false;
    const timer = setInterval(() => {
      if (refreshing) return;
      refreshing = true;
      void getFeed(feedId, controller.signal)
        .then((fresh) => {
          if (!controller.signal.aborted) setFeed(fresh);
        })
        .catch(() => undefined)
        .finally(() => {
          refreshing = false;
        });
    }, 10000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [feedId, pending]);

  return (
    <section
      className="feed-card-preview"
      aria-label={"Prévia do feed " + feedName}
      aria-busy={loading}
    >
      {loading ? (
        <div
          className="feed-preview-content feed-preview-loading"
          role="status"
        >
          <span className="visually-hidden">Carregando prévia…</span>
          <div
            className="feed-preview-profile preview-skeleton-profile"
            aria-hidden="true"
          >
            <span className="preview-skeleton-avatar" />
            <div>
              <span className="preview-skeleton-line" />
              <span className="preview-skeleton-line" />
            </div>
          </div>
          <div className="feed-preview-grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <div className="preview-skeleton-tile" key={index} />
            ))}
          </div>
        </div>
      ) : failed || !feed ? (
        <div className="feed-preview-content feed-preview-empty" role="alert">
          <p>Não foi possível carregar a prévia.</p>
          <button
            className="text-button"
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="feed-preview-content">
          <div className="feed-preview-profile">
            <Avatar src={feed.profile.avatar} name={feed.profile.name} />
            <div>
              <strong>
                {feed.profile.username
                  ? "@" + feed.profile.username
                  : feed.profile.name}
              </strong>
              <span>{feed.profile.name}</span>
              <small>
                {feed.posts.length}{" "}
                {feed.posts.length === 1 ? "publicação" : "publicações"}
              </small>
            </div>
          </div>
          {feed.posts.length ? (
            <div className="feed-preview-grid">
              {feed.posts.slice(0, 9).map((post, index) => (
                <div className="feed-preview-post" key={post.id}>
                  <StudioMedia
                    media={post.media?.[0]}
                    src={post.images[0]}
                    alt={
                      "Publicação " +
                      (index + 1) +
                      (post.caption ? ": " + post.caption.slice(0, 100) : "")
                    }
                  />
                  {post.images.length > 1 && (
                    <span
                      className="feed-preview-carousel"
                      aria-label="Carrossel"
                    >
                      <Copy size={15} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="feed-preview-empty">
              <LayoutGrid size={26} />
              <p>Este feed ainda não tem publicações.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
