# Padrão de movimento do frontend

Animações suaves fazem parte do padrão aprovado do Serga Studio. Reaplique esse padrão em novos menus, formulários, modais e transições quando ajudar a explicar a ação do usuário.

- Use o submenu dos clientes como referência: movimento curto e discreto, expansão de altura e opacidade, sem saltos.
- Reutilize `src/motion.css`, `MotionPresence` e `Expandable`. Durações: controles 120–160 ms, entrada/expansão 180–240 ms, saída 180 ms. Mantenha o tempo de retenção de `MotionPresence` alinhado à saída definida no CSS.
- Respeite `prefers-reduced-motion: reduce` no CSS e na retenção de saída. Conteúdo fechado ou saindo deve ficar fora do foco e da árvore de acessibilidade.
- Na navegação, anime só a área de conteúdo quando a rota mudar; mantenha cabeçalho e lateral estáveis. Não reanime páginas, gráficos ou listas por atualizações de dados.
- Cancelamento, envio e confirmação executam suas ações imediatamente. A retenção de conteúdo existe apenas para concluir a saída visual, nunca para atrasar requests ou ações.
- Preserve foco, teclado, bloqueios de operação, rascunhos e prevenção de alterações não salvas. Cubra regressões de interação ao alterar ciclos de montagem/desmontagem.
- Ao adicionar movimento, preserve cores, tipografia, layout, rotas e regras de negócio. Não adicione bibliotecas de animação para efeitos que CSS e os componentes existentes resolvem.

Modais renderizados condicionalmente devem usar `MotionPresence` para animar também a saída. Formulários e painéis expansíveis usam `Expandable`; conteúdo já visível ao carregar pode usar `animateInitial={false}` para evitar efeitos de entrada redundantes.
