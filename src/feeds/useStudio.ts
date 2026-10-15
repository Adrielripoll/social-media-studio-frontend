import { useCallback, useEffect, useRef, useState } from "react";
import type { Feed, FeedWorkspace } from "../types";
import { initialWorkspace, newFeed } from "../data";
import { loadWorkspace, saveWorkspace } from "../storage";
import { createFeed, deleteFeed, getFeed, listFeeds, saveFeed } from "./api";
import { ApiError } from "../auth/api";

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
function rememberFeed(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("feed", id);
  else url.searchParams.delete("feed");
  url.searchParams.delete("cliente");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
export function useStudio(demo: boolean) {
  const [workspace, setWorkspace] = useState<FeedWorkspace | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">(
    "saved",
  );
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const draft = useRef<FeedWorkspace | null>(null);
  const revision = useRef(0),
    generation = useRef(0),
    saved = useRef(0);
  const sending = useRef(false),
    blocked = useRef(false),
    mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<() => Promise<void>>(async () => {});
  const publish = useCallback((value: FeedWorkspace) => {
    draft.current = value;
    setWorkspace(value);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    async function load() {
      setLoadError("");
      setBusy(true);
      try {
        let value: FeedWorkspace;
        if (demo) {
          value = (await loadWorkspace()) ?? initialWorkspace();
          if (
            value.version !== 1 ||
            !Array.isArray(value.feeds) ||
            !value.feeds.length
          )
            throw new Error("Invalid demo");
          if (!value.feeds.some((feed) => feed.id === value.activeFeedId))
            value.activeFeedId = value.feeds[0].id;
        } else {
          const summaries = (await listFeeds(controller.signal)).filter(
            (feed) => !feed.pendingDeletion,
          );
          const preferred = new URLSearchParams(location.search).get("feed");
          const active =
            summaries.find((feed) => feed.id === preferred) ?? summaries[0];
          const loaded = active
            ? await getFeed(active.id, controller.signal)
            : undefined;
          value = {
            version: 1,
            activeFeedId: active?.id ?? "",
            feeds: summaries.map((summary) =>
              loaded?.id === summary.id
                ? loaded
                : {
                    ...newFeed(summary.name),
                    id: summary.id,
                    clientId: summary.clientId,
                    platform: summary.platform,
                    revision: summary.revision,
                  },
            ),
          };
        }
        if (controller.signal.aborted) return;
        revision.current =
          value.feeds.find((feed) => feed.id === value.activeFeedId)
            ?.revision ?? 0;
        generation.current = 0;
        saved.current = 0;
        blocked.current = false;
        publish(value);
        if (!demo) rememberFeed(value.activeFeedId);
        setSaveStatus("saved");
        setSaveError("");
        if (demo) await saveWorkspace(value);
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(
            demo
              ? "Não foi possível abrir a demonstração neste navegador."
              : message(
                  error,
                  "Não foi possível abrir seus feeds. Tente novamente.",
                ),
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [demo, publish, reload]);

  const persist = useCallback(async () => {
    if (
      sending.current ||
      blocked.current ||
      !draft.current ||
      generation.current === saved.current
    )
      return;
    sending.current = true;
    const snapshot = draft.current,
      currentGeneration = generation.current;
    const feed = snapshot.feeds.find(
      (item) => item.id === snapshot.activeFeedId,
    );
    try {
      if (demo) await saveWorkspace(snapshot);
      else if (feed) {
        const result = await saveFeed(feed, revision.current);
        revision.current = result.revision;
      }
      saved.current = currentGeneration;
      if (mounted.current && generation.current === currentGeneration) {
        setSaveStatus("saved");
        setSaveError("");
      }
    } catch (error) {
      blocked.current = true;
      if (mounted.current) {
        setSaveStatus("error");
        setSaveError(
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "O espaço deste navegador acabou. Remova imagens ou feeds e tente salvar novamente."
            : message(
                error,
                "Não foi possível salvar. Mantenha esta aba aberta e tente novamente.",
              ),
        );
      }
    } finally {
      sending.current = false;
      if (
        mounted.current &&
        !blocked.current &&
        generation.current !== saved.current
      )
        void persistRef.current();
    }
  }, [demo]);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  function updateFeed(update: (feed: Feed) => Feed) {
    const current = draft.current;
    if (!current) return;
    publish({
      ...current,
      feeds: current.feeds.map((feed) =>
        feed.id === current.activeFeedId ? update(feed) : feed,
      ),
    });
    generation.current++;
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persistRef.current(), 500);
    if (blocked.current) setSaveStatus("error");
  }
  function retrySave() {
    blocked.current = false;
    setSaveStatus("saving");
    void persistRef.current();
  }
  async function selectFeed(id: string) {
    if (busy || generation.current !== saved.current) return;
    const current = draft.current;
    if (!current) return;
    setBusy(true);
    setLoadError("");
    try {
      const feed = demo
        ? current.feeds.find((item) => item.id === id)!
        : await getFeed(id);
      revision.current = feed.revision ?? 0;
      const value = {
        ...current,
        activeFeedId: id,
        feeds: current.feeds.map((item) => (item.id === id ? feed : item)),
      };
      if (demo) await saveWorkspace(value);
      if (mounted.current) {
        publish(value);
        if (!demo) rememberFeed(value.activeFeedId);
      }
    } catch (error) {
      if (mounted.current)
        setLoadError(
          message(error, "Não foi possível abrir este feed. Tente novamente."),
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function addFeed(title: string) {
    if (busy || generation.current !== saved.current)
      throw new Error("Aguarde o salvamento do feed.");
    setBusy(true);
    try {
      const requestedClient = new URLSearchParams(location.search).get(
        "cliente",
      );
      const created = demo
        ? newFeed(title)
        : await createFeed(title, requestedClient);
      const current = draft.current ?? {
        version: 1 as const,
        activeFeedId: "",
        feeds: [],
      };
      const value = {
        ...current,
        activeFeedId: created.id,
        feeds: [...current.feeds, created],
      };
      if (demo) await saveWorkspace(value);
      revision.current = created.revision ?? 0;
      if (mounted.current) publish(value);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function removeFeed() {
    if (busy || generation.current !== saved.current)
      throw new Error("Aguarde o salvamento do feed.");
    const current = draft.current;
    if (!current) return;
    setBusy(true);
    try {
      if (!demo) await deleteFeed(current.activeFeedId);
      const remaining = current.feeds.filter(
        (item) => item.id !== current.activeFeedId,
      );
      if (demo && !remaining.length) remaining.push(newFeed());
      if (!demo && remaining.length)
        remaining[0] = await getFeed(remaining[0].id);
      const value = {
        ...current,
        feeds: remaining,
        activeFeedId: remaining[0]?.id ?? "",
      };
      if (demo) await saveWorkspace(value);
      revision.current = remaining[0]?.revision ?? 0;
      if (mounted.current) publish(value);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    const interval = setInterval(() => {
      const current = draft.current;
      if (!current?.activeFeedId || busy || sending.current) return;
      void getFeed(current.activeFeedId)
        .then((fresh) => {
          if (!mounted.current || draft.current?.activeFeedId !== fresh.id)
            return;
          const urls = new Map(
            fresh.posts.flatMap((post) =>
              post.mediaIds!.map(
                (id, index) => [id, post.images[index]] as const,
              ),
            ),
          );
          const value = draft.current;
          publish({
            ...value,
            feeds: value.feeds.map((feed) =>
              feed.id !== fresh.id
                ? feed
                : {
                    ...feed,
                    profile: {
                      ...feed.profile,
                      avatar:
                        feed.profile.avatarMediaId ===
                        fresh.profile.avatarMediaId
                          ? fresh.profile.avatar
                          : feed.profile.avatar,
                    },
                    posts: feed.posts.map((post) => ({
                      ...post,
                      images: post.images.map(
                        (url, index) =>
                          urls.get(post.mediaIds?.[index] ?? "") ?? url,
                      ),
                    })),
                  },
            ),
          });
        })
        .catch(() => undefined);
    }, 40 * 60_000);
    return () => clearInterval(interval);
  }, [demo, publish, busy]);
  return {
    workspace,
    loadError,
    saveStatus,
    saveError,
    busy,
    updateFeed,
    selectFeed,
    addFeed,
    removeFeed,
    retrySave,
    reload: () => setReload((value) => value + 1),
  };
}
