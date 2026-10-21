# Perfil e segurança — ajuste de largura

## Leitura do design

Modo Extension: correção do layout existente para profissionais de social media. Papel: configuração, com leitura próxima no computador e no celular. Temperatura: discreta e acolhedora. Nenhuma exploração de marca é necessária.

Variação 2/10: coluna única alinhada à esquerda; movimento 3/10: conservar as transições de feedback; densidade 5/10: manter campos e conteúdo; dependência de ativos 1/10: usar os recursos existentes; fidelidade 10/10: preservar o design system atual.

## Sistema preservado

- Paleta atual do código: superfície branca #FFFFFF, fundo #F3EFE9, texto #1C1815 e ação bronze #7B5322. src/design-system.css prevalece sobre propostas antigas de outras paletas.
- Manrope no texto e controles; Space Grotesk nos títulos, ambas locais.
- Espaçamento de 24 px entre painéis; padding existente de 28/22/20 px por breakpoint.
- Raios de 20 px nos painéis e 11 px nos controles; sombras e movimento existentes.
- Logo real public/logo.png e ícones lucide-react; inventário em brand-spec.md.

## Diagnóstico e correção

Os cartões preenchiam toda a coluna, enquanto os formulários tinham limite de 650 px, deixando uma faixa vazia à direita. Privacidade estava fora da pilha com espaçamento padronizado.

Agrupar perfil, segurança e privacidade em coluna de até 44rem (704 px no tamanho padrão), gap de 24 px e alinhamento à esquerda. No celular, ocupar 100% do espaço disponível. minmax(0, 1fr) e min-width: 0 permitem contração sem esconder conteúdo.

Desktop: navegação lateral existente + coluna compacta de configuração.
Mobile: navegação existente acima + três painéis na mesma largura fluida.

## Contratos e verificação

Preservar campos, ordem, textos legais, rotas, API, estados, tooltip, foco e modais. Assinatura e armazenamento mantêm seu layout. Sem conteúdo, bibliotecas, cores ou interações novas.

Inspecionar seletores e breakpoints, formatar e compilar. Não declarar aceitação no navegador sem execução solicitada; o ajuste é visual e reversível e não requer testes que apenas reproduzam o CSS.
