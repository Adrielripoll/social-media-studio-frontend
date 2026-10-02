import type { Project, Workspace } from './types';

export const uid = () => crypto.randomUUID();

export function newProject(title = 'Novo projeto'): Project {
  return {
    id: uid(), title,
    profile: { username: 'sua.marca', name: 'Sua marca', category: 'Marca',
      bio: 'Uma nova história começa por aqui. ✨', website: '',
      followers: 1200, following: 180, avatar: '' },
    posts: [],
  };
}

export function demoProject(): Project {
  return {
    id: uid(), title: 'Café Aurora',
    profile: {
      username: 'cafe.aurora', name: 'Aurora · café & boas conversas',
      category: 'Cafeteria', bio: 'Um respiro no meio do dia. ☕\nCafé especial, pão quentinho e tempo pra você.\nSeg a sáb · 8h às 19h',
      website: 'cafeaurora.com.br', followers: 8420, following: 324,
      avatar: '/demo/avatar.svg',
    },
    posts: [
      { id: uid(), images: ['/demo/01.svg'], caption: 'Tem dias que tudo o que a gente precisa é de uma pausa. E de um café feito com carinho. ☕\n\nTe esperamos por aqui.\n\n#CaféAurora #SuaPausaDoDia', location: 'Café Aurora', likes: 128 },
      { id: uid(), images: ['/demo/02.svg', '/demo/07.svg'], caption: 'Um bom dia começa nos pequenos detalhes. Deslize e descubra o seu próximo favorito. 🤎', location: 'Café Aurora', likes: 246 },
      { id: uid(), images: ['/demo/03.svg'], caption: 'Sem pressa. Sem roteiro. Só você, seu café e o momento presente. ✨', location: '', likes: 95 },
      { id: uid(), images: ['/demo/04.svg'], caption: 'O nosso cantinho favorito também pode ser o seu. Pode chegar! 🌿', location: 'Café Aurora', likes: 183 },
      { id: uid(), images: ['/demo/05.svg', '/demo/08.svg'], caption: 'Da origem à sua xícara: cada grão tem uma história. Conheça nosso café especial. ☕', location: 'Café Aurora', likes: 312 },
      { id: uid(), images: ['/demo/06.svg'], caption: 'Uma mesa, duas xícaras e uma boa conversa. Marca aquele encontro que está faltando. 🤎', location: 'Café Aurora', likes: 167 },
    ],
  };
}

export function initialWorkspace(): Workspace {
  const project = demoProject();
  return { version: 1, activeProjectId: project.id, projects: [project] };
}

export function reorderPosts<T extends { id: string }>(posts: T[], fromId: string, toId: string): T[] {
  const from = posts.findIndex(p => p.id === fromId);
  const to = posts.findIndex(p => p.id === toId);
  if (from < 0 || to < 0 || from === to) return posts;
  const next = [...posts];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
