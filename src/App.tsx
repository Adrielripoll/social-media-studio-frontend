import { useEffect, useRef, useState } from 'react';
import { Camera, Plus, Monitor, Smartphone, Play, ArrowLeft, Check, CloudOff, LoaderCircle, SlidersHorizontal, Images, ImagePlus, Upload, Trash2, GripVertical, ArrowUp, ArrowDown, Pencil, Sparkles, FolderOpen } from 'lucide-react';
import type { Post, Profile, Project, Workspace } from './types';
import { initialWorkspace, newProject, reorderPosts } from './data';
import { loadWorkspace, readImage, saveWorkspace } from './storage';
import ProfilePreview, { Avatar } from './components/ProfilePreview';
import PostComposer from './components/PostComposer';
import PostViewer from './components/PostViewer';
import Dialog from './components/Dialog';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [saveError, setSaveError] = useState('');
  const saveGeneration = useRef(0);
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [presentation, setPresentation] = useState(false);
  const [section, setSection] = useState<'profile' | 'posts'>('profile');
  const [dialog, setDialog] = useState<'newProject' | 'composer' | 'deleteProject' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingPost, setEditingPost] = useState<Post | undefined>();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    loadWorkspace().then(stored => {
      if (cancelled) return;
      if (stored && (stored.version !== 1 || !Array.isArray(stored.projects) || !stored.projects.length)) {
        setLoadError('Não foi possível reconhecer os projetos salvos. Os dados foram preservados.');
        return;
      }
      const loaded = stored ?? initialWorkspace();
      if (!loaded.projects.some(project => project.id === loaded.activeProjectId)) loaded.activeProjectId = loaded.projects[0].id;
      setWorkspace(loaded);
    }).catch(() => {
      if (!cancelled) setLoadError('Não foi possível abrir o armazenamento do navegador. Permita o armazenamento local e tente novamente.');
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (!workspace) return;
    const generation = ++saveGeneration.current;
    setSaveStatus('saving');
    saveWorkspace(workspace).then(() => {
      if (generation === saveGeneration.current) { setSaveStatus('saved'); setSaveError(''); }
    }).catch(error => {
      if (generation === saveGeneration.current) {
        setSaveStatus('error');
        setSaveError(error instanceof DOMException && error.name === 'QuotaExceededError'
          ? 'O espaço deste navegador acabou. Remova imagens ou projetos e tente salvar novamente.'
          : 'Não foi possível salvar. Mantenha esta aba aberta e tente novamente.');
      }
    });
  }, [workspace, saveAttempt]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (workspace && saveStatus !== 'saved') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus, workspace]);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setPresentation(false);
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  function updateProject(update: (project: Project) => Project) {
    setSaveStatus('saving');
    setWorkspace(current => current ? { ...current, projects: current.projects.map(project => project.id === current.activeProjectId ? update(project) : project) } : current);
  }
  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    updateProject(project => ({ ...project, profile: { ...project.profile, [key]: value } }));
  }
  function openComposer(post?: Post) {
    setViewerId(null); setEditingPost(post); setDialog('composer');
  }
  function reorder(from: string, to: string) {
    updateProject(project => ({ ...project, posts: reorderPosts(project.posts, from, to) }));
  }
  async function changeAvatar(file?: File) {
    if (!file) return;
    setAvatarBusy(true); setAvatarError('');
    try { updateProfile('avatar', await readImage(file, 600)); }
    catch (error) { setAvatarError(error instanceof Error ? error.message : 'Não foi possível carregar a foto.'); }
    finally { setAvatarBusy(false); if (avatarInput.current) avatarInput.current.value = ''; }
  }

  if (!workspace) return <div className="loading-screen"><div className="brand-icon"><Camera size={24} /></div>
    {loadError ? <><h1>Vamos recuperar seu estúdio</h1><p role="alert">{loadError}</p><button className="button primary" onClick={() => setLoadAttempt(value => value + 1)}>Tentar novamente</button></> : <><LoaderCircle className="spin" size={24} /><p>Abrindo seu estúdio…</p></>}
  </div>;

  const project = workspace.projects.find(item => item.id === workspace.activeProjectId)!;
  const { profile, posts } = project;
  const viewedPost = posts.find(post => post.id === viewerId);
  const status = <div className={'save-status ' + saveStatus} role="status">
    {saveStatus === 'saved' ? <Check size={14} /> : saveStatus === 'saving' ? <LoaderCircle className="spin" size={14} /> : <CloudOff size={15} />}
    <span>{saveStatus === 'saved' ? 'Salvo neste navegador' : saveStatus === 'saving' ? 'Salvando…' : 'Falha ao salvar'}</span>
  </div>;

  return (
    <div className={'app ' + (presentation ? 'is-presenting' : '')}>
      <header className="app-header">
        <a href="/" className="brand" aria-label="Insta Studio"><span className="brand-icon"><Camera size={22} /></span><span>insta<span className="brand-light">studio</span></span><span className="beta-badge">BETA</span></a>
        {!presentation && <div className="project-switcher"><FolderOpen size={16} /><select aria-label="Projeto atual" value={project.id} disabled={avatarBusy} onChange={event => {
          const id = event.target.value; setWorkspace(current => current ? { ...current, activeProjectId: id } : current);
          setViewerId(null); setAvatarError('');
        }}>{workspace.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <button className="icon-button" aria-label="Criar projeto" disabled={avatarBusy} onClick={() => { setNewTitle(''); setDialog('newProject'); }}><Plus size={18} /></button></div>}
        <div className="header-right">{status}{presentation && <button className="button secondary" onClick={() => setPresentation(false)}><ArrowLeft size={16} />Voltar à edição</button>}</div>
      </header>

      {saveStatus === 'error' && <div className="save-warning" role="alert"><CloudOff size={18} /><span>{saveError}</span><button onClick={() => setSaveAttempt(value => value + 1)}>Tentar salvar</button></div>}

      <main className="main">
        {!presentation && <div className="page-heading"><div><div className="eyebrow"><span />SEU ESTÚDIO CRIATIVO</div><h1>Ideias que ganham um feed.</h1><p>Monte, experimente e apresente sua próxima ideia.</p></div>
          <div className="heading-actions"><button className="button secondary" onClick={() => setPresentation(true)}><Play size={15} />Apresentar</button><button className="button primary" onClick={() => openComposer()}><Plus size={18} />Nova publicação</button></div></div>}

        <div className="studio-layout">
          {!presentation && <aside className="editor-panel">
            <div className="editor-heading"><div><span className="eyebrow">PROJETO</span><h2>{project.title}</h2></div><SlidersHorizontal size={18} /></div>
            <div className="editor-tabs" role="tablist" aria-label="Editor">
              <button role="tab" id="profile-tab" aria-controls="profile-editor" aria-selected={section === 'profile'} className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}><SlidersHorizontal size={15} />Perfil</button>
              <button role="tab" id="posts-tab" aria-controls="posts-editor" aria-selected={section === 'posts'} className={section === 'posts' ? 'active' : ''} onClick={() => setSection('posts')}><Images size={15} />Conteúdo<span className="tab-count">{posts.length}</span></button>
            </div>
            {section === 'profile' ? <div className="editor-content" id="profile-editor" role="tabpanel" aria-labelledby="profile-tab">
              <div className="avatar-editor"><Avatar src={profile.avatar} name={profile.name} /><div><button className="text-button" disabled={avatarBusy} onClick={() => avatarInput.current?.click()}>{avatarBusy ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}Trocar foto</button><span>JPG, PNG ou WebP</span>{profile.avatar && <button className="remove-avatar" disabled={avatarBusy} onClick={() => updateProfile('avatar', '')}>Remover foto</button>}</div>
                <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label="Selecionar foto do perfil" disabled={avatarBusy} onChange={event => void changeAvatar(event.target.files?.[0])} /></div>
              {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
              <label className="field"><span>Nome do projeto</span><input value={project.title} maxLength={60} onChange={event => updateProject(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Cliente · Campanha de outubro" /></label>
              <label className="field"><span id="username-label">Nome de usuário</span><div className="input-with-prefix"><span aria-hidden="true">@</span><input aria-labelledby="username-label" value={profile.username} maxLength={30} onChange={event => updateProfile('username', event.target.value.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase())} placeholder="sua.marca" /></div></label>
              <label className="field"><span>Nome do perfil</span><input value={profile.name} maxLength={64} onChange={event => updateProfile('name', event.target.value)} /></label>
              <label className="field"><span>Categoria</span><input value={profile.category} maxLength={60} onChange={event => updateProfile('category', event.target.value)} placeholder="Ex.: Cafeteria" /></label>
              <label className="field"><span>Bio <small>{profile.bio.length}/150</small></span><textarea rows={4} value={profile.bio} maxLength={150} onChange={event => updateProfile('bio', event.target.value)} /></label>
              <label className="field"><span>Site</span><input value={profile.website} maxLength={200} onChange={event => updateProfile('website', event.target.value)} placeholder="suamarca.com.br" /></label>
              <div className="form-row"><label className="field"><span>Seguidores</span><input type="number" min="0" max="999999999" value={profile.followers} onChange={event => updateProfile('followers', Math.min(999999999, Math.max(0, Math.trunc(Number(event.target.value)))))} /></label>
                <label className="field"><span>Seguindo</span><input type="number" min="0" max="999999999" value={profile.following} onChange={event => updateProfile('following', Math.min(999999999, Math.max(0, Math.trunc(Number(event.target.value)))))} /></label></div>
              <button className="delete-project" disabled={avatarBusy} onClick={() => setDialog('deleteProject')}><Trash2 size={14} />Excluir projeto</button>
            </div> : <div className="editor-content content-editor" id="posts-editor" role="tabpanel" aria-labelledby="posts-tab">
              <p className="section-intro">A ordem aqui é a ordem do feed. Arraste ou use as setas para organizar.</p>
              <button className="add-content" onClick={() => openComposer()}><ImagePlus size={19} />Adicionar publicação<Plus size={16} /></button>
              {posts.length ? <div className="post-list">{posts.map((post, index) => <div className="post-list-item" key={post.id} draggable
                onDragStart={event => { dragId.current = post.id; event.dataTransfer.setData('text/plain', post.id); }}
                onDragOver={event => { if (dragId.current && dragId.current !== post.id) event.preventDefault(); }}
                onDrop={event => { event.preventDefault(); if (dragId.current) reorder(dragId.current, post.id); dragId.current = null; }}
                onDragEnd={() => { dragId.current = null; }}>
                <GripVertical className="drag-handle" size={14} /><button className="post-list-thumb" onClick={() => setViewerId(post.id)} aria-label={'Visualizar publicação ' + (index + 1)}><img src={post.images[0]} alt="" /></button>
                <div className="post-list-copy"><strong>{String(index + 1).padStart(2, '0')} · {post.images.length > 1 ? 'Carrossel' : 'Imagem'}</strong><p>{post.caption || 'Sem legenda'}</p><div className="post-list-actions">
                  <button className="icon-button" aria-label={'Editar publicação ' + (index + 1)} onClick={() => openComposer(post)}><Pencil size={13} /></button>
                  <button className="icon-button" aria-label={'Mover publicação ' + (index + 1) + ' para cima'} disabled={index === 0} onClick={() => reorder(post.id, posts[index - 1].id)}><ArrowUp size={13} /></button>
                  <button className="icon-button" aria-label={'Mover publicação ' + (index + 1) + ' para baixo'} disabled={index === posts.length - 1} onClick={() => reorder(post.id, posts[index + 1].id)}><ArrowDown size={13} /></button>
                  <button className="icon-button danger" aria-label={'Excluir publicação ' + (index + 1)} onClick={() => setDeletePostId(post.id)}><Trash2 size={13} /></button>
                </div></div>
              </div>)}</div> : <div className="empty-content"><Images size={28} /><p>Seu próximo post está a um clique daqui.</p></div>}
            </div>}
            <div className="editor-note"><Sparkles size={16} /><p>Experimente à vontade.<br />Seu Instagram fictício, suas ideias.</p></div>
          </aside>}

          <section className="preview-panel" aria-label="Prévia do Instagram">
            <div className="preview-toolbar"><div className="preview-label"><span className="live-dot" /><strong>{presentation ? project.title : 'Prévia do perfil'}</strong>{!presentation && <span className="preview-subtitle">Instagram</span>}</div>
              <div className="mode-toggle" role="group" aria-label="Visualização"><button aria-pressed={mode === 'desktop'} className={mode === 'desktop' ? 'active' : ''} onClick={() => setMode('desktop')}><Monitor size={15} /><span>Desktop</span></button><button aria-pressed={mode === 'mobile'} className={mode === 'mobile' ? 'active' : ''} onClick={() => setMode('mobile')}><Smartphone size={15} /><span>Mobile</span></button></div></div>
            <div className={'preview-canvas mode-' + mode}>
              {mode === 'mobile' ? <div className="phone-frame"><div className="phone-status"><b>9:41</b><div className="phone-island" /><span>▮▮▮ ▰</span></div><ProfilePreview key={project.id} project={project} mode={mode} presentation={presentation} onOpenPost={setViewerId} onAddPost={() => openComposer()} onReorder={reorder} /><div className="phone-home" /></div>
              : <ProfilePreview key={project.id} project={project} mode={mode} presentation={presentation} onOpenPost={setViewerId} onAddPost={() => openComposer()} onReorder={reorder} />}
            </div>
            {!presentation && <div className="preview-footer"><GripVertical size={14} /><span>Arraste os posts para experimentar novas combinações.</span><span className="preview-count">{posts.length} {posts.length === 1 ? 'publicação' : 'publicações'}</span></div>}
            {presentation && <p className="presentation-hint">Clique nas publicações para explorar · Esc para voltar à edição</p>}
          </section>
        </div>
        {!presentation && <footer className="app-footer"><span>Feito para dar forma às suas ideias.</span><span>Simulação independente · Dados salvos apenas neste navegador</span></footer>}
      </main>

      {dialog === 'newProject' && <Dialog title="Um novo projeto, novas ideias" onClose={() => setDialog(null)} className="small-dialog"><form onSubmit={event => {
        event.preventDefault();
        if (!newTitle.trim()) return;
        const created = newProject(newTitle.trim());
        setWorkspace(current => current ? { ...current, activeProjectId: created.id, projects: [...current.projects, created] } : current);
        setSection('profile'); setAvatarError(''); setDialog(null);
      }}><p className="dialog-intro">Crie um perfil fictício para uma marca ou campanha.</p><label className="field"><span>Nome do projeto</span><input autoFocus required maxLength={60} value={newTitle} placeholder="Ex.: Studio Flora" onChange={event => setNewTitle(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setDialog(null)}>Cancelar</button><button type="submit" className="button primary" disabled={!newTitle.trim()}><Plus size={16} />Criar projeto</button></div></form></Dialog>}

      {dialog === 'composer' && <PostComposer post={editingPost} onClose={() => setDialog(null)} onSave={post => {
        updateProject(current => ({ ...current, posts: editingPost ? current.posts.map(item => item.id === post.id ? post : item) : [post, ...current.posts] }));
        setDialog(null); setSection('posts');
      }} />}

      {viewedPost && <PostViewer key={viewedPost.id} post={viewedPost} profile={profile} mode={mode} presentation={presentation} onClose={() => setViewerId(null)} onEdit={() => openComposer(viewedPost)} onDelete={() => { setViewerId(null); setDeletePostId(viewedPost.id); }} />}

      {deletePostId && <Dialog title="Excluir esta publicação?" onClose={() => setDeletePostId(null)} className="small-dialog"><p className="dialog-intro">A publicação e suas imagens serão removidas deste projeto.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setDeletePostId(null)}>Cancelar</button><button className="button danger-button" onClick={() => {
        updateProject(current => ({ ...current, posts: current.posts.filter(post => post.id !== deletePostId) })); setDeletePostId(null);
      }}>Excluir publicação</button></div></Dialog>}

      {dialog === 'deleteProject' && <Dialog title="Excluir este projeto?" onClose={() => setDialog(null)} className="small-dialog"><p className="dialog-intro">O projeto <strong>{project.title}</strong> e todas as suas publicações serão removidos deste navegador.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setDialog(null)}>Cancelar</button><button className="button danger-button" onClick={() => {
        setWorkspace(current => {
          if (!current) return current;
          const remaining = current.projects.filter(item => item.id !== current.activeProjectId);
          if (!remaining.length) remaining.push(newProject());
          return { ...current, projects: remaining, activeProjectId: remaining[0].id };
        });
        setAvatarError(''); setDialog(null);
      }}>Excluir projeto</button></div></Dialog>}
    </div>
  );
}
