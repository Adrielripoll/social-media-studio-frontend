# Insta Studio

MVP de um simulador visual de perfis do Instagram para apresentar ideias de conteúdo. Interface em português, construída com React, TypeScript e Vite.

## Rodar localmente

Requer Node.js 22.12+ ou 24+. Dentro desta pasta:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra http://127.0.0.1:5174. No Windows, use `npm.cmd` se a política do PowerShell bloquear `npm.ps1`.

## O que você pode testar

- Perfil de demonstração Café Aurora com seis posts e dois carrosséis.
- Criar, alternar, renomear e excluir projetos.
- Editar foto, nome de usuário, nome do perfil, categoria, bio, site e números fictícios.
- Criar posts com imagens JPG, PNG ou WebP, legendas, localização e curtidas fictícias.
- Montar carrosséis de até dez imagens e escolher a capa pela ordem das imagens.
- Editar ou excluir posts com confirmação.
- Reorganizar o feed por arraste e pelas setas na aba Conteúdo.
- Alternar entre desktop e uma prévia em moldura de celular.
- Apresentar com os controles de edição ocultos; voltar pelo botão ou pela tecla Esc.
- Abrir posts e navegar pelos carrosséis com botões, indicadores ou setas do teclado.

## Salvamento

Projetos, textos e imagens são salvos automaticamente em IndexedDB, neste navegador e nesta origem (endereço e porta). Espere aparecer **Salvo neste navegador** antes de fechar a aba.

As imagens enviadas são convertidas para WebP, com o maior lado limitado a 1.600 pixels. Fotos de perfil têm limite de 600 pixels. Cada arquivo de entrada pode ter até 20 MB. Os materiais de demonstração são SVGs locais criados para este projeto.

Limpar os dados do site remove os projetos. Outro navegador, outra porta ou outro computador têm armazenamento separado. Use uma aba de edição por vez: sincronização entre abas e backup ainda não fazem parte do MVP. Em modo privado, o navegador pode descartar os dados ao encerrar a sessão.

## Validação

```powershell
npm.cmd run build
npm.cmd test
```

Os testes usam o Google Chrome instalado no computador. Para usar Chromium do Playwright, remova `channel: 'chrome'` de `playwright.config.ts` e execute `npx.cmd playwright install chromium`. Em outros sistemas, ajuste o comando do servidor de testes para `npm run dev`.

Os testes verificam persistência de projetos e imagens, upload e validações, edição, carrosséis, ordenação, exclusão, prévia mobile, apresentação e recuperação de uma falha de salvamento.

## Escopo

Esta fase funciona inteiramente no navegador. Login, assinatura, pagamento e armazenamento em nuvem ficam para a segunda fase. Não há integração de publicação com o Instagram.

Os projetos têm identificadores próprios e a persistência está isolada em `src/storage.ts`, permitindo evoluir para contas e uma API sem alterar a experiência de montagem.
