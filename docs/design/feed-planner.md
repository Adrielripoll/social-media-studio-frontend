# Planejador de feed — identidade independente

Modo: Extension. Ajuste autorizado de textos e elementos decorativos, sem redesenhar a aplicação.

## Direção

Prévia de publicações para profissionais de social media, com a marca Serga Studio em destaque. Variação 2/10, movimento 2/10, densidade 6/10, dependência de imagens 6/10 e fidelidade à marca 10/10. O conteúdo do usuário permanece como foco no desktop e no celular.

Mantidos os tokens existentes: branco, canvas #f3efe9, texto #1c1815 e bronze #7b5322; fontes Manrope e Space Grotesk, ritmo de 4 px, cartões e transições atuais. A prévia usa a tipografia do produto em vez de imitar a fonte de outra plataforma. Logo real e ativos: consultar [brand-spec.md](brand-spec.md).

## Aplicação

- Nome da ferramenta: Planejador de feed. Instagram é mencionado de forma descritiva como destino das publicações.
- Removidos a navegação decorativa lateral, os menus decorativos do mobile e o botão Seguir nos dois modos.
- Aviso de independência legível na edição e na apresentação, inclusive na demonstração pública.
- Preservados grade, carrosséis, perfil, números informados pelo usuário, edição, reordenação, salvamento, rotas e dados existentes.

Essas medidas não representam uma avaliação jurídica nem garantem conformidade por si só.

## Vídeos e carrosséis mistos

Upload bloqueia o fechamento somente durante o envio. Depois, o editor aceita mídias pendentes e o feed apresenta o processamento persistido. A atualização periódica substitui apenas URLs e metadados das mídias, preservando rascunhos, ordem e textos. A grade usa capas; o player com controles é carregado ao abrir a publicação, com tentativa explícita de reprodução com som no slide ativo, após a abertura do modal. Se o navegador bloquear o áudio automático, tenta reproduzir sem som e exibe “Ativar som”; se bloquear toda reprodução, exibe “Reproduzir vídeo”. Cada troca de slide desmonta e pausa o player anterior. Posts com um único vídeo usam uma área 9:16 na publicação aberta, limitada pela altura disponível, sem cortar ou deformar o conteúdo; grade e carrosséis preservam o layout atual. A reprodução automática depende das preferências do navegador. Mantidos tokens, componentes de modal, expansão e movimento reduzido existentes.

A prévia de vídeo no modal acompanha o status pelo endpoint autenticado da mídia, inclusive antes de a publicação ser adicionada ao feed. Consulta somente mídias pendentes, sem sobrepor requisições, e cancela ao remover a mídia ou fechar o modal. A chegada da capa preserva legenda, localização, curtidas e ordem; falhas temporárias informam a tentativa de atualização sem bloquear a edição, e falhas definitivas encerram o carregamento.

Vídeos preparados antes de adicionar ao feed exibem a capa temporária no modal e a mensagem “Vídeo preparado. Ele será armazenado ao adicionar a publicação ao feed.” O modal encerra a consulta ao atingir processed; a grade continua acompanhando até ready, após a persistência definitiva. Cancelar descarta a preparação e libera as reservas. A alteração preserva layout, tokens e movimento existentes.

Feeds excluídos saem da biblioteca imediatamente, inclusive na página do cliente. A limpeza continua em background; não há cartão nem botão para concluir exclusão manualmente.
