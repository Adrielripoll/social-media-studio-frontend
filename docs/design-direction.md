# Direção visual do Serga Studio

## Redesign de 21/10/2026

Modo: nova linguagem visual com os fluxos existentes. Público: profissionais de social media que organizam trabalho e apresentam resultados a clientes. Papel da tela: instrumento de análise no computador, com leitura e apresentação também no celular. Temperatura: tranquila e precisa; densidade moderada, animação mínima.

Antes: predominância de bronze, fundos creme, banners escuros grandes, degradês e caixas coloridas em todos os indicadores. Texto secundário pequeno e excesso de elementos decorativos reduziam o foco nos resultados.

Direção: relatório claro, hierarquia pelo conteúdo e cor usada para identificar ações e métricas. Não usar o banner como anúncio. Indicadores compartilham uma superfície com divisórias; gráficos ficam em superfícies independentes. A navegação recebe o mesmo tratamento discreto.

## Sistema

- Base: neblina `#F3F6FB`, superfície branca `#FFFFFF`, texto azul tinta `#182B49`, texto secundário `#62718A`, ação azul `#315BD6`, apoio verde petróleo `#168B82`.
- Gráficos usam cores estáveis por métrica: azul para alcance, azul acinzentado para visualizações, rosa fechado para interações, verde para novos seguidores, âmbar para visitas e lilás para cliques. Essas cores não indicam sucesso/fracasso.
- Manrope local para títulos e texto, com hierarquia de peso/tamanho. Algarismos tabulares nos resultados; gráficos com rótulos legíveis. Nenhuma fonte externa ou nova dependência.
- Espaçamento em múltiplos de 4/8; superfícies de 14/16 px, controles de 10/11 px, modais de 18 px. Elevação reservada a modais e feedback de interação.
- Layout alinhado à esquerda. Cabeçalhos compactos, filtros agrupados e resultados imediatamente abaixo. Indicadores em seis colunas em telas largas, três em telas médias e dois no celular.
- Feedback de hover/foco curto, sem animação automática decorativa. Preferência por movimento reduzido preservada.

## Contratos preservados

Logo em `/public/logo.png`, navegação, rotas, nomes de ações, formulários, consentimentos, cálculos, dados reais, persistência, apresentação, foco de teclado e textos de erro. As miniaturas de biblioteca são ilustrações decorativas de relatórios, sem números e sem representar dados reais.

Arquivos centrais: `src/design-system.css`, `src/workspace/sidebar.css`, `src/dashboards/dashboards.css`, `src/dashboards/dashboard-theme.css` e `src/dashboards/chart-runtime.ts`. O simulador de rede social conserva seus componentes e sua própria estrutura.
