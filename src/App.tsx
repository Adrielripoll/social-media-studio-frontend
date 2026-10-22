import MotionPresence from "./components/MotionPresence";
import { useAccount } from "./account/AccountContext";
import { workspaceReturnUrl } from "./workspace/navigation";
import StudioMedia from "./components/StudioMedia";
import PlatformHeader from "./components/PlatformHeader";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Plus,
  Monitor,
  Smartphone,
  Play,
  ArrowLeft,
  Check,
  CloudOff,
  LoaderCircle,
  SlidersHorizontal,
  Images,
  ImagePlus,
  Upload,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Eye,
  Sparkles,
} from "lucide-react";
import type { Post, Profile, Feed } from "./types";
import { reorderPosts } from "./data";
import { useStudio } from "./feeds/useStudio";
import {
  uploadFeedImage,
  uploadFeedMedia,
  deleteUnusedImage,
} from "./feeds/api";
import { listClients } from "./workspace/api";
import type { Client } from "./workspace/api";
import { readImage } from "./storage";
import ProfilePreview, { Avatar } from "./components/ProfilePreview";
import PostComposer from "./components/PostComposer";
import PostViewer from "./components/PostViewer";
import Dialog from "./components/Dialog";

export default function App({
  demo = false,
  onSignOut,
}: {
  demo?: boolean;
  onSignOut?: () => Promise<void>;
}) {
  const account = useAccount();
  const {
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
    reload,
  } = useStudio(demo);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientError, setClientError] = useState("");
  const [operationError, setOperationError] = useState("");
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    void listClients(controller.signal)
      .then((value) => setClients(value.clients))
      .catch(() => {
        if (!controller.signal.aborted)
          setClientError("Não foi possível carregar os clientes.");
      });
    return () => controller.abort();
  }, [demo]);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [presentation, setPresentation] = useState(false);
  const [section, setSection] = useState<"profile" | "posts">("profile");
  const [dialog, setDialog] = useState<
    "newFeed" | "composer" | "deleteFeed" | null
  >(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingPost, setEditingPost] = useState<Post | undefined>();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (workspace && saveStatus !== "saved") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus, workspace]);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        setPresentation(false);
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  function updateCurrentFeed(update: (project: Feed) => Feed) {
    updateFeed(update);
  }
  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    updateCurrentFeed((project) => ({
      ...project,
      profile: { ...project.profile, [key]: value },
    }));
  }
  function openComposer(post?: Post) {
    setViewerId(null);
    setEditingPost(post);
    setDialog("composer");
  }
  function reorder(from: string, to: string) {
    updateCurrentFeed((project) => ({
      ...project,
      posts: reorderPosts(project.posts, from, to),
    }));
  }
  async function changeAvatar(file?: File) {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      if (demo) updateProfile("avatar", await readImage(file, 600));
      else {
        const uploaded = await uploadFeedImage(
          workspace!.activeFeedId,
          file,
          "avatar",
        );
        updateCurrentFeed((feed) => ({
          ...feed,
          profile: {
            ...feed.profile,
            avatar: uploaded.url,
            avatarMediaId: uploaded.id,
          },
        }));
      }
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a foto.",
      );
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  if (!workspace)
    return (
      <>
        <PlatformHeader onSignOut={onSignOut} disabled={busy} />

        <div className="loading-screen feed-loading-screen">
          <div className="brand-icon">
            <Camera size={24} />
          </div>
          {loadError ? (
            <>
              <h1>Vamos recuperar seu estúdio</h1>
              <p role="alert">{loadError}</p>
              <button className="button primary" onClick={() => reload()}>
                Tentar novamente
              </button>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={24} />
              <p>Abrindo seu estúdio…</p>
            </>
          )}
        </div>
      </>
    );

  if (!workspace.feeds.length)
    return (
      <>
        <PlatformHeader onSignOut={onSignOut} disabled={busy} />

        <div className="loading-screen feed-loading-screen">
          <div className="brand-icon">
            <Camera size={24} />
          </div>
          <h1>Seu primeiro feed começa aqui.</h1>
          <p>Crie um perfil fictício para explorar suas ideias.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setOperationError("");
              void addFeed(newTitle.trim() || "Novo feed").catch((error) =>
                setOperationError(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível criar o feed.",
                ),
              );
            }}
          >
            <label className="field">
              <span>Nome do feed</span>
              <input
                required
                maxLength={60}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Ex.: Studio Flora"
                disabled={busy}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !newTitle.trim()}
            >
              <Plus size={16} />
              Criar feed
            </button>
          </form>
          {operationError && <p role="alert">{operationError}</p>}
          <a className="text-button" href={workspaceReturnUrl()}>
            Voltar ao início
          </a>
        </div>
      </>
    );
  const project = workspace.feeds.find(
    (item) => item.id === workspace.activeFeedId,
  )!;
  const switchingDisabled = busy || avatarBusy || saveStatus !== "saved";
  const { profile, posts } = project;
  const viewedPost = posts.find((post) => post.id === viewerId);
  const status = (
    <div
      className={"save-status " + saveStatus}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {saveStatus === "saved" ? (
        <Check size={14} />
      ) : saveStatus === "saving" ? (
        <LoaderCircle className="spin" size={14} />
      ) : (
        <CloudOff size={15} />
      )}
      <span>
        {saveStatus === "saved"
          ? demo
            ? "Salvo neste navegador"
            : "Salvo na sua conta"
          : saveStatus === "saving"
            ? "Salvando…"
            : "Falha ao salvar"}
      </span>
    </div>
  );

  return (
    <div
      className={
        "app feed-studio mobile-view-" +
        mobileView +
        " " +
        (presentation ? "is-presenting" : "")
      }
    >
      <PlatformHeader
        className="feed-header"
        onSignOut={onSignOut}
        disabled={switchingDisabled}
      >
        <div className="header-right">
          {status}
          {presentation && (
            <button
              className="button secondary"
              onClick={() => setPresentation(false)}
            >
              <ArrowLeft size={16} />
              Voltar à edição
            </button>
          )}
        </div>
      </PlatformHeader>
      {!demo &&
        !presentation &&
        account?.account?.retention?.policy &&
        !account.account.retention.acceptedAt && (
          <div className="save-warning" role="status">
            <span>
              Antes de enviar arquivos, leia a política de retenção do
              armazenamento.
            </span>
            <a href="/minha-conta?secao=armazenamento">
              Ler e aceitar política
            </a>
          </div>
        )}

      {saveStatus === "error" && (
        <div className="save-warning" role="alert">
          <CloudOff size={18} />
          <span>{saveError}</span>
          <button onClick={() => retrySave()}>Tentar salvar</button>
          <button onClick={() => window.location.reload()}>
            Recarregar feed
          </button>
        </div>
      )}

      <main className="main">
        {(loadError || clientError) && (
          <p className="form-error" role="alert">
            {loadError || clientError}
          </p>
        )}
        {!demo && !presentation && (
          <a className="text-button" href={workspaceReturnUrl()}>
            ← Voltar ao espaço de trabalho
          </a>
        )}
        {!presentation && (
          <div className="page-heading feed-intro">
            <div>
              <div className="eyebrow">
                <span />
                SERGA STUDIO
              </div>
              <h1>Planejador de feed</h1>
              <p>
                Planeje e visualize como suas publicações podem aparecer no
                Instagram.
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => setPresentation(true)}
              >
                <Play size={15} />
                Apresentar
              </button>
              <button className="button primary" onClick={() => openComposer()}>
                <Plus size={18} />
                Nova publicação
              </button>
            </div>
          </div>
        )}

        {!presentation && (
          <div
            className="studio-mobile-switch"
            role="group"
            aria-label="Modo do editor"
          >
            <button
              className={mobileView === "edit" ? "active" : ""}
              aria-pressed={mobileView === "edit"}
              onClick={() => setMobileView("edit")}
            >
              <Pencil size={16} />
              Editar feed
            </button>
            <button
              className={mobileView === "preview" ? "active" : ""}
              aria-pressed={mobileView === "preview"}
              onClick={() => setMobileView("preview")}
            >
              <Eye size={16} />
              Ver prévia
            </button>
          </div>
        )}
        <div className="studio-layout">
          <section className="preview-panel" aria-label="Prévia do feed">
            <div className="preview-toolbar">
              <div className="preview-label">
                <span className="live-dot" />
                <strong>
                  {presentation ? project.title : "Prévia do seu feed"}
                </strong>
              </div>
              <div
                className="mode-toggle"
                role="group"
                aria-label="Visualização"
              >
                <button
                  aria-pressed={mode === "desktop"}
                  className={mode === "desktop" ? "active" : ""}
                  onClick={() => setMode("desktop")}
                >
                  <Monitor size={15} />
                  <span>Desktop</span>
                </button>
                <button
                  aria-pressed={mode === "mobile"}
                  className={mode === "mobile" ? "active" : ""}
                  onClick={() => setMode("mobile")}
                >
                  <Smartphone size={15} />
                  <span>Mobile</span>
                </button>
              </div>
            </div>
            <div className={"preview-canvas mode-" + mode}>
              <div className="preview-artboard" key={mode}>
                {mode === "mobile" ? (
                  <div className="phone-frame">
                    <div className="phone-status">
                      <b>9:41</b>
                      <div className="phone-island" />
                      <span>▮▮▮ ▰</span>
                    </div>
                    <ProfilePreview
                      key={project.id}
                      project={project}
                      mode={mode}
                      presentation={presentation}
                      onOpenPost={setViewerId}
                      onAddPost={() => openComposer()}
                      onReorder={reorder}
                    />
                    <div className="phone-home" />
                  </div>
                ) : (
                  <ProfilePreview
                    key={project.id}
                    project={project}
                    mode={mode}
                    presentation={presentation}
                    onOpenPost={setViewerId}
                    onAddPost={() => openComposer()}
                    onReorder={reorder}
                  />
                )}
              </div>
            </div>
            {!presentation && (
              <div className="preview-footer">
                <GripVertical size={14} />
                <span>
                  Arraste os posts para experimentar novas combinações.
                </span>
                <span className="preview-count">
                  {posts.length}{" "}
                  {posts.length === 1 ? "publicação" : "publicações"}
                </span>
              </div>
            )}
            {presentation && (
              <p className="presentation-hint">
                Clique nas publicações para explorar · Esc para voltar à edição
              </p>
            )}
            <p className="feed-independence-notice">
              Ferramenta independente, sem afiliação ou endosso do Instagram ou
              da Meta.
            </p>
          </section>
          {!presentation && (
            <aside className="editor-panel">
              <fieldset disabled={busy} className="editor-fieldset">
                <div className="editor-heading">
                  <div className="editor-feed-identity">
                    <span className="eyebrow">PERSONALIZE SEU FEED</span>
                    <h2 aria-label={project.title}>
                      <select
                        className="editor-feed-picker"
                        aria-label="Feed atual"
                        title={project.title}
                        value={project.id}
                        disabled={switchingDisabled}
                        onChange={(event) => {
                          void selectFeed(event.target.value);
                          setViewerId(null);
                          setAvatarError("");
                        }}
                      >
                        {workspace.feeds.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </h2>
                  </div>
                  <button
                    className="icon-button editor-create-feed"
                    aria-label="Criar feed"
                    title="Criar feed"
                    disabled={switchingDisabled}
                    onClick={() => {
                      setNewTitle("");
                      setOperationError("");
                      setDialog("newFeed");
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div
                  className="editor-tabs"
                  role="tablist"
                  aria-label="Editor"
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? "profile"
                        : event.key === "End"
                          ? "posts"
                          : section === "profile"
                            ? "posts"
                            : "profile";
                    setSection(next);
                    document
                      .getElementById(
                        next === "profile" ? "profile-tab" : "posts-tab",
                      )
                      ?.focus();
                  }}
                >
                  <button
                    role="tab"
                    id="profile-tab"
                    aria-controls="profile-editor"
                    aria-selected={section === "profile"}
                    tabIndex={section === "profile" ? 0 : -1}
                    className={section === "profile" ? "active" : ""}
                    onClick={() => setSection("profile")}
                  >
                    <SlidersHorizontal size={15} />
                    Perfil
                  </button>
                  <button
                    role="tab"
                    id="posts-tab"
                    aria-controls="posts-editor"
                    aria-selected={section === "posts"}
                    tabIndex={section === "posts" ? 0 : -1}
                    className={section === "posts" ? "active" : ""}
                    onClick={() => setSection("posts")}
                  >
                    <Images size={15} />
                    Conteúdo<span className="tab-count">{posts.length}</span>
                  </button>
                </div>
                {section === "profile" ? (
                  <div
                    className="editor-content"
                    id="profile-editor"
                    role="tabpanel"
                    tabIndex={0}
                    aria-labelledby="profile-tab"
                  >
                    <div className="avatar-editor">
                      <Avatar src={profile.avatar} name={profile.name} />
                      <div>
                        <button
                          className="text-button"
                          disabled={avatarBusy}
                          onClick={() => avatarInput.current?.click()}
                        >
                          {avatarBusy ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <Upload size={14} />
                          )}
                          Trocar foto
                        </button>
                        <span>JPG, PNG ou WebP</span>
                        {profile.avatar && (
                          <button
                            className="remove-avatar"
                            disabled={avatarBusy}
                            onClick={() =>
                              updateCurrentFeed((feed) => ({
                                ...feed,
                                profile: {
                                  ...feed.profile,
                                  avatar: "",
                                  avatarMediaId: null,
                                },
                              }))
                            }
                          >
                            Remover foto
                          </button>
                        )}
                      </div>
                      <input
                        ref={avatarInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="visually-hidden"
                        aria-label="Selecionar foto do perfil"
                        disabled={avatarBusy}
                        onChange={(event) =>
                          void changeAvatar(event.target.files?.[0])
                        }
                      />
                    </div>
                    {avatarError && (
                      <p className="form-error" role="alert">
                        {avatarError}
                      </p>
                    )}
                    <label className="field">
                      <span>Nome do feed</span>
                      <input
                        value={project.title}
                        maxLength={60}
                        onChange={(event) =>
                          updateCurrentFeed((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Ex.: Cliente · Campanha de outubro"
                      />
                    </label>
                    {!demo && (
                      <label className="field">
                        <span>Cliente associado</span>
                        <select
                          value={project.clientId ?? ""}
                          disabled={busy || !!clientError}
                          onChange={(event) =>
                            updateCurrentFeed((feed) => ({
                              ...feed,
                              clientId: event.target.value || null,
                            }))
                          }
                        >
                          <option value="">Sem cliente</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      <span id="username-label">Nome de usuário</span>
                      <div className="input-with-prefix">
                        <span aria-hidden="true">@</span>
                        <input
                          aria-labelledby="username-label"
                          value={profile.username}
                          maxLength={30}
                          onChange={(event) =>
                            updateProfile(
                              "username",
                              event.target.value
                                .replace(/[^a-zA-Z0-9._]/g, "")
                                .toLowerCase(),
                            )
                          }
                          placeholder="sua.marca"
                        />
                      </div>
                    </label>
                    <label className="field">
                      <span>Nome do perfil</span>
                      <input
                        value={profile.name}
                        maxLength={64}
                        onChange={(event) =>
                          updateProfile("name", event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Categoria</span>
                      <input
                        value={profile.category}
                        maxLength={60}
                        onChange={(event) =>
                          updateProfile("category", event.target.value)
                        }
                        placeholder="Ex.: Cafeteria"
                      />
                    </label>
                    <label className="field">
                      <span>
                        Bio <small>{profile.bio.length}/150</small>
                      </span>
                      <textarea
                        rows={4}
                        value={profile.bio}
                        maxLength={150}
                        onChange={(event) =>
                          updateProfile("bio", event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Site</span>
                      <input
                        value={profile.website}
                        maxLength={200}
                        onChange={(event) =>
                          updateProfile("website", event.target.value)
                        }
                        placeholder="suamarca.com.br"
                      />
                    </label>
                    <div className="form-row">
                      <label className="field">
                        <span>Seguidores</span>
                        <input
                          type="number"
                          min="0"
                          max="999999999"
                          value={profile.followers}
                          onChange={(event) =>
                            updateProfile(
                              "followers",
                              Math.min(
                                999999999,
                                Math.max(
                                  0,
                                  Math.trunc(Number(event.target.value)),
                                ),
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Seguindo</span>
                        <input
                          type="number"
                          min="0"
                          max="999999999"
                          value={profile.following}
                          onChange={(event) =>
                            updateProfile(
                              "following",
                              Math.min(
                                999999999,
                                Math.max(
                                  0,
                                  Math.trunc(Number(event.target.value)),
                                ),
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="delete-project"
                      disabled={switchingDisabled}
                      onClick={() => {
                        setOperationError("");
                        setDialog("deleteFeed");
                      }}
                    >
                      <Trash2 size={14} />
                      Excluir feed
                    </button>
                  </div>
                ) : (
                  <div
                    className="editor-content content-editor"
                    id="posts-editor"
                    role="tabpanel"
                    aria-labelledby="posts-tab"
                  >
                    <p className="section-intro">
                      A ordem aqui é a ordem do feed. Arraste ou use as setas
                      para organizar.
                    </p>
                    <button
                      className="add-content"
                      onClick={() => openComposer()}
                    >
                      <ImagePlus size={19} />
                      Adicionar publicação
                      <Plus size={16} />
                    </button>
                    {posts.length ? (
                      <div className="post-list">
                        {posts.map((post, index) => (
                          <div
                            className="post-list-item"
                            key={post.id}
                            draggable
                            onDragStart={(event) => {
                              dragId.current = post.id;
                              event.dataTransfer.setData("text/plain", post.id);
                            }}
                            onDragOver={(event) => {
                              if (dragId.current && dragId.current !== post.id)
                                event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (dragId.current)
                                reorder(dragId.current, post.id);
                              dragId.current = null;
                            }}
                            onDragEnd={() => {
                              dragId.current = null;
                            }}
                          >
                            <GripVertical className="drag-handle" size={14} />
                            <button
                              className="post-list-thumb"
                              onClick={() => setViewerId(post.id)}
                              aria-label={
                                "Visualizar publicação " + (index + 1)
                              }
                            >
                              <StudioMedia
                                media={post.media?.[0]}
                                src={post.images[0]}
                                alt=""
                              />
                            </button>
                            <div className="post-list-copy">
                              <strong>
                                {String(index + 1).padStart(2, "0")} ·{" "}
                                {post.images.length === 0
                                  ? "Arquivos removidos"
                                  : post.images.length > 1
                                    ? "Carrossel"
                                    : "Imagem"}
                              </strong>
                              <p>{post.caption || "Sem legenda"}</p>
                              <div className="post-list-actions">
                                <button
                                  className="icon-button"
                                  aria-label={
                                    "Editar publicação " + (index + 1)
                                  }
                                  onClick={() => openComposer(post)}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={
                                    "Mover publicação " +
                                    (index + 1) +
                                    " para cima"
                                  }
                                  disabled={index === 0}
                                  onClick={() =>
                                    reorder(post.id, posts[index - 1].id)
                                  }
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={
                                    "Mover publicação " +
                                    (index + 1) +
                                    " para baixo"
                                  }
                                  disabled={index === posts.length - 1}
                                  onClick={() =>
                                    reorder(post.id, posts[index + 1].id)
                                  }
                                >
                                  <ArrowDown size={13} />
                                </button>
                                <button
                                  className="icon-button danger"
                                  aria-label={
                                    "Excluir publicação " + (index + 1)
                                  }
                                  onClick={() => setDeletePostId(post.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-content">
                        <Images size={28} />
                        <p>Seu próximo post está a um clique daqui.</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="editor-note">
                  <Sparkles size={16} />
                  <p>
                    Experimente à vontade.
                    <br />
                    Seu planejamento, suas ideias.
                  </p>
                </div>
              </fieldset>
            </aside>
          )}
        </div>
        {!presentation && (
          <footer className="app-footer">
            <span>Feito para dar forma às suas ideias.</span>
            <span>
              Planejamento independente ·{" "}
              {demo
                ? "Dados salvos apenas neste navegador"
                : "Feeds salvos na sua conta"}
            </span>
          </footer>
        )}
      </main>

      <MotionPresence>
        {dialog === "newFeed" && (
          <Dialog
            title="Um novo feed, novas ideias"
            onClose={() => {
              if (!busy) setDialog(null);
            }}
            className="small-dialog"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!newTitle.trim()) return;
                setOperationError("");
                void addFeed(newTitle.trim())
                  .then(() => {
                    setSection("profile");
                    setAvatarError("");
                    setDialog(null);
                  })
                  .catch((error) =>
                    setOperationError(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível criar o feed.",
                    ),
                  );
              }}
            >
              <p className="dialog-intro">
                Crie um perfil fictício para uma marca ou campanha.
              </p>
              <label className="field">
                <span>Nome do feed</span>
                <input
                  autoFocus
                  required
                  maxLength={60}
                  value={newTitle}
                  placeholder="Ex.: Studio Flora"
                  onChange={(event) => setNewTitle(event.target.value)}
                />
              </label>
              {operationError && (
                <p className="form-error" role="alert">
                  {operationError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy || !newTitle.trim()}
                >
                  <Plus size={16} />
                  Criar feed
                </button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      <MotionPresence>
        {dialog === "composer" && (
          <PostComposer
            post={editingPost}
            feedId={demo ? undefined : project.id}
            prepareImage={
              demo
                ? undefined
                : (file, progress) =>
                    uploadFeedMedia(project.id, file, progress)
            }
            discardMedia={
              demo
                ? undefined
                : (ids) =>
                    Promise.allSettled(
                      ids.map((id) => deleteUnusedImage(project.id, id)),
                    ).then(() => {})
            }
            onClose={() => setDialog(null)}
            onSave={(post) => {
              updateCurrentFeed((current) => ({
                ...current,
                posts: editingPost
                  ? current.posts.map((item) =>
                      item.id === post.id ? post : item,
                    )
                  : [post, ...current.posts],
              }));
              setDialog(null);
              setSection("posts");
            }}
          />
        )}
      </MotionPresence>

      <MotionPresence>
        {viewedPost && (
          <PostViewer
            key={viewedPost.id}
            post={viewedPost}
            profile={profile}
            mode={mode}
            presentation={presentation}
            onClose={() => setViewerId(null)}
            onEdit={() => openComposer(viewedPost)}
            onDelete={() => {
              setViewerId(null);
              setDeletePostId(viewedPost.id);
            }}
          />
        )}
      </MotionPresence>

      <MotionPresence>
        {deletePostId && (
          <Dialog
            title="Excluir esta publicação?"
            onClose={() => setDeletePostId(null)}
            className="small-dialog"
          >
            <p className="dialog-intro">
              A publicação e suas imagens serão removidas deste feed.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setDeletePostId(null)}
              >
                Cancelar
              </button>
              <button
                className="button danger-button"
                onClick={() => {
                  updateCurrentFeed((current) => ({
                    ...current,
                    posts: current.posts.filter(
                      (post) => post.id !== deletePostId,
                    ),
                  }));
                  setDeletePostId(null);
                }}
              >
                Excluir publicação
              </button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      <MotionPresence>
        {dialog === "deleteFeed" && (
          <Dialog
            title="Excluir este feed?"
            onClose={() => {
              if (!busy) setDialog(null);
            }}
            className="small-dialog"
          >
            <p className="dialog-intro">
              O feed <strong>{project.title}</strong> e todas as suas
              publicações serão removidos{" "}
              {demo ? "deste navegador" : "da sua conta"}.
            </p>
            {operationError && (
              <p className="form-error" role="alert">
                {operationError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button
                className="button danger-button"
                disabled={busy}
                onClick={() => {
                  setOperationError("");
                  void removeFeed()
                    .then(() => {
                      setAvatarError("");
                      setDialog(null);
                    })
                    .catch((error) =>
                      setOperationError(
                        error instanceof Error
                          ? error.message
                          : "Não foi possível excluir o feed.",
                      ),
                    );
                }}
              >
                Excluir feed
              </button>
            </div>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
