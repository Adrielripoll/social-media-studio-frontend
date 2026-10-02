import { useState } from 'react';
import { Camera, Home, Search, Compass, Heart, Menu, Grid3X3, Copy, Plus, ArrowUpRight } from 'lucide-react';
import type { Project } from '../types';
import { formatNumber, normalizeWebsite } from '../storage';

export function Avatar({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <div className={'avatar ' + className}>{src ? <img src={src} alt={'Foto de ' + name} /> : <span>{(name.trim()[0] || 'M').toUpperCase()}</span>}</div>;
}

export default function ProfilePreview({ project, mode, presentation, onOpenPost, onAddPost, onReorder }: {
  project: Project; mode: 'desktop' | 'mobile'; presentation: boolean;
  onOpenPost: (id: string) => void; onAddPost: () => void; onReorder: (from: string, to: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const { profile, posts } = project;
  const website = normalizeWebsite(profile.website);
  return (
    <div className={'instagram-shell ' + mode}>
      {mode === 'desktop' && <aside className="instagram-nav" aria-label="Interface simulada">
        <Camera size={26} className="instagram-logo" /><span title="Página inicial"><Home /></span>
        <span title="Pesquisar"><Search /></span><span title="Explorar"><Compass /></span>
        <span title="Curtidas"><Heart /></span><Avatar src={profile.avatar} name={profile.name} />
        <span className="ig-nav-menu"><Menu /></span>
      </aside>}
      <div className="instagram-page">
        {mode === 'mobile' && <div className="mobile-top"><strong>{profile.username || 'sua.marca'}</strong><Menu size={21} /></div>}
        <header className="profile-header">
          <div className="profile-avatar-wrap"><Avatar src={profile.avatar} name={profile.name} className="profile-avatar" /></div>
          <div className="profile-info">
            <div className="profile-title"><h2>{profile.username || 'sua.marca'}</h2>
              {mode === 'desktop' && <button className={'follow-button ' + (following ? 'following' : '')} onClick={() => setFollowing(!following)}>{following ? 'Seguindo' : 'Seguir'}</button>}
            </div>
            <div className="profile-stats">
              <span><b>{formatNumber(posts.length)}</b> <span>publicações</span></span>
              <span><b>{formatNumber(profile.followers)}</b> <span>seguidores</span></span>
              <span><b>{formatNumber(profile.following)}</b> <span>seguindo</span></span>
            </div>
            <div className="profile-bio"><strong>{profile.name || 'Sua marca'}</strong>
              {profile.category && <span className="profile-category">{profile.category}</span>}
              <p>{profile.bio}</p>
              {profile.website && (website ? <a href={website} target="_blank" rel="noreferrer">{profile.website.replace(/^https?:\/\//, '')}<ArrowUpRight size={13} /></a> : <span>{profile.website}</span>)}
            </div>
          </div>
          {mode === 'mobile' && <button className={'follow-button mobile-follow ' + (following ? 'following' : '')} onClick={() => setFollowing(!following)}>{following ? 'Seguindo' : 'Seguir'}</button>}
        </header>
        <div className="profile-grid-tab"><Grid3X3 size={15} /><span>PUBLICAÇÕES</span></div>
        {posts.length ? <div className="post-grid">
          {posts.map((post, index) => <button key={post.id} className={'grid-post ' + (dropId === post.id ? 'drop-target' : '')}
            aria-label={'Abrir publicação ' + (index + 1)} draggable={!presentation} data-post-id={post.id}
            onClick={() => onOpenPost(post.id)}
            onDragStart={event => { event.dataTransfer.setData('text/plain', post.id); event.dataTransfer.effectAllowed = 'move'; setDraggedId(post.id); }}
            onDragOver={event => { if (!presentation && draggedId && draggedId !== post.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropId(post.id); } }}
            onDragLeave={() => setDropId(null)}
            onDrop={event => { event.preventDefault(); const from = event.dataTransfer.getData('text/plain'); if (draggedId && from === draggedId) onReorder(from, post.id); setDraggedId(null); setDropId(null); }}
            onDragEnd={() => { setDraggedId(null); setDropId(null); }}>
            <img src={post.images[0]} alt={post.caption ? post.caption.slice(0, 100) : 'Imagem da publicação ' + (index + 1)} draggable={false} />
            {post.images.length > 1 && <span className="carousel-marker"><Copy size={18} fill="white" /></span>}
            {!presentation && <span className="grid-position">{String(index + 1).padStart(2, '0')}</span>}
          </button>)}
        </div> : <div className="empty-feed"><div className="empty-feed-icon"><Camera size={30} /></div><h3>Seu feed começa aqui</h3><p>Adicione a primeira publicação e dê vida à sua marca.</p>{!presentation && <button className="text-button" onClick={onAddPost}><Plus size={16} />Adicionar publicação</button>}</div>}
        {mode === 'mobile' && <div className="mobile-bottom" aria-hidden="true"><Home size={22} /><Search size={22} /><Plus size={22} /><Heart size={22} /><Avatar src={profile.avatar} name={profile.name} /></div>}
      </div>
    </div>
  );
}
