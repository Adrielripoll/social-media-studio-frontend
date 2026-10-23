# Revisão de interface e textos — 22/10/2026

## Direção

Aplicação das skills frontend-design, web-design-engineer e humanizer em modo de extensão: preservar identidade, fontes, cores e componentes existentes. Usar os tokens do design system; não introduzir uma segunda linguagem visual.

## Padrões adotados

- Rótulos descrevem a ação e o objeto afetado. “Excluir feed” sempre exclui o feed inteiro; “Gerenciar arquivos” abre o editor.
- O backend informa `pendingDeletion` em cada recurso do armazenamento. Limpeza de um arquivo não significa que o feed está excluído. Feeds já excluídos mostram andamento automático, sem botão para repetir a exclusão.
- O espaço só é liberado depois da confirmação da remoção física. Nenhuma mudança nas políticas ou na contabilidade da cota.
- O modal de publicação confirma o descarte quando texto, localização, curtidas ou mídias foram alterados. Escape, botão de fechar, cancelar e clique fora seguem a mesma regra.
- A confirmação começa em “Continuar editando”. Atualizar ou sair da página com alterações ou upload em andamento usa o aviso nativo do navegador. Isso não constitui salvamento automático do rascunho.
- Atualizações de status, poster e URLs de vídeos não contam como edição do rascunho. Descartar remove somente as mídias temporárias adicionadas naquela edição.
- Mensagens distinguem envio, fila, compressão, preparação e salvamento. Falhas de upload orientam a próxima ação, sem exibir mensagens brutas, tokens ou URLs assinadas.
- Falha ao consultar retenção aparece com “Consultar novamente”; não exibir um falso estado de sucesso.
- A lista de hoje começa com seis tarefas e mantém a prévia gradual, “Mostrar mais” e “Mostrar menos”.
- Foco de teclado em campos usa fundo e rótulo destacado, sem restaurar bordas de seleção. Botões e links mantêm seu indicador de foco.
- Textos auxiliares funcionais usam no mínimo o token `--text-xs`; ações de modal quebram linha em telas estreitas.
- O logo existente recebe uma superfície clara sobre o painel escuro da autenticação.
- Textos de entrada, estados vazios e instruções priorizam frases concretas. Não alterar fatos, limites, políticas ou mensagens financeiras para simplificar a redação.
- Transições continuam usando MotionPresence e respeitando redução de movimento. Testes aguardam o término real da saída, em vez de interagir com diálogos ainda na camada modal.

## Validação

- 81 cenários distintos de navegador aprovados nas áreas alteradas, incluindo os nove testes de `tests/ui-quality.spec.ts`. As divergências iniciais de seletores e transições foram corrigidas e retestadas.
- Chrome: 390 × 844, 768 × 1024, 1280 × 720 e 1440 × 900; suites existentes também cobrem 320 px. Sem overflow horizontal nos fluxos verificados.
- Escape, backdrop, atualização com rascunho, descarte de mídia nova, erro 413, repetição de consulta de retenção, expansão de tarefas e estados de vídeo cobertos.
- Preferência de movimento reduzido e fonte raiz em 200% verificadas. O teste de fonte não representa zoom nativo do navegador.
- 22 testes unitários do frontend e 22 testes HTTP/Postgres de armazenamento aprovados.
- Build frontend/backend, lint e formatação backend aprovados.

Os testes de interface usam respostas simuladas e contas fictícias. Não homologam integrações externas, entrega de email, pagamento real ou conversão real de vídeo. O teste de armazenamento usa Postgres descartável, sem modificar o banco do dev. Não foi necessária migration.

## Reexecução

Usar o frontend original em execução, com `VITE_API_URL=http://127.0.0.1:3001`:
`npm.cmd run test:ui-review`.
O comando não sobe cópias da aplicação e executa somente a revisão focada. Todas as chamadas externas são bloqueadas ou simuladas nessa revisão. Capturas explícitas sem credenciais ficam em pastas novas de `social-media-studio-qa/.qa-runtime/ui-quality-2026-10-22/`; traces, vídeos e screenshots automáticos permanecem desativados.

Evidências e escopo da rodada: [registro da revisão](../../../social-media-studio-qa/docs/qa/revisao-interface-2026-10-22.md).

## Progresso de múltiplos vídeos

Manter o indicador de upload no botão existente, sem introduzir outro painel: `Enviando vídeo: 20% · 1/3 vídeos`. O percentual pertence ao arquivo atual; o denominador conta apenas os vídeos da seleção corrente. Imagens não incrementam a posição e uma nova seleção reinicia o contador. O texto usa anúncio educado para tecnologias assistivas. Preservar bloqueio de confirmação durante envio e processamento assíncrono depois que o upload termina.
