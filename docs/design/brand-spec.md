# Serga Studio — direção da barra lateral

Estado: direção aprovada pelo usuário em 20/10/2026, com autorização para implementar e concluir sem novas confirmações. Aplicada somente à navegação lateral.

## Leitura do design

Redesign com preservação da identidade, para profissionais de social media que alternam entre ferramentas e clientes. Linguagem: ferramenta editorial com tons quentes, contraste claro e densidade moderada.

Variação 3/10, movimento 2/10, densidade 6/10, dependência de imagens 2/10, fidelidade à marca 9/10. Isso mantém navegação e quantidade de informação; a mudança se concentra no contraste, agrupamento e ritmo vertical.

Papel: orientar navegação, com o conteúdo como foco da página. Distância: desktop e celular. Temperatura: sóbria e acolhedora. Capacidade: três destinos principais e uma lista real de clientes com rolagem própria quando necessário.

## Ativos existentes

- Logo real: `public/logo.png`, utilizado pelo cabeçalho em `src/auth/AuthShell.tsx`.
- Favicon: `public/favicon.svg`.
- Fontes locais: Manrope Variable e Space Grotesk Variable, declaradas em `src/design-system.css`.
- Referências da interface anterior ao redesign: capturas revisadas de Clientes em `../serga-studio-qa/.qa-runtime/serga-rebrand-2026-10-20/playwright-results/clients-logo-logos-nos-car-1ebc6-alternativa-e-layout-mobile/`.
- Ícones existentes: lucide-react. Nenhuma nova biblioteca ou asset necessário.

## Sistema aplicado

- Fundo claro original de `--surface: #fff`, restaurado a pedido do usuário. Texto em `--text-primary`, textos secundários em `--text-secondary` e ícones/foco em bronze `--accent`.
- Bronze de `--hero-accent: #ecc38a` para o item ativo; rótulos secundários em tons quentes com contraste suficiente.
- Tipografia existente: Manrope nos controles; Space Grotesk nos pequenos títulos de seção.
- Ritmo de 4 px: espaçamentos de 8, 12, 16 e 24 px; controles com alvo mínimo de 44 px.
- Cantos discretos de 11–14 px; relevo sutil no item ativo e sem linhas separando cada cliente.
- Estados: hover sutil, ativo claro, foco visível, desabilitado legível; transições de 160–180 ms e respeito a movimento reduzido.
- Desktop: ferramentas agrupadas, separação clara para clientes, iniciais compactas e nomes legíveis.
- Mobile: três destinos na horizontal e clientes expansíveis, preservando os controles atuais.

## Contratos preservados

Início, Feeds e Dashboards compõem o menu principal. Clientes são acessados pela lista abaixo; a página de listagem permanece disponível na rota existente. Mantidos o botão Novo cliente, estados de loading/erro/vazio, identificação por aria-current e expansão mobile por aria-expanded/aria-controls. O logo e o cabeçalho existentes permanecem em uso. Sem chamadas extras à API, campos novos, publicidade ou conteúdo fictício.

## Verificações realizadas

Build e formatação aprovados. Inspecionados seletores, ordem de estilos, callbacks, foco e regras responsivas. Contrastes calculados: texto principal 16,22:1, texto do item ativo 10,70:1 e texto secundário aproximadamente 8,00:1. Os estilos da barra foram centralizados em `src/workspace/sidebar.css`, preservando as demais alterações locais do produto. A skill reserva uma rodada automatizada de aceitação no navegador para quando o usuário a solicitar explicitamente; não foi executada nesta entrega.

## Acabamento da lateral

Fundo com variação tonal discreta e filete bronze na borda. Ícones em bases contornadas, seta contextual no item ativo/hover e superfície própria para agrupar clientes. Os efeitos usam a paleta existente; não foram adicionados recursos, destinos nem consultas. Preservada a lateral em toda a altura do conteúdo, com o menu sticky independente e a navegação mobile horizontal.


Fundo branco original restaurado em toda a lateral e no mobile. Foram preservados o relevo do item ativo, os ícones contornados, o agrupamento dos clientes e a correção da altura durante a rolagem.
