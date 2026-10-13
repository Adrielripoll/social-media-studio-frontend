# Social Media Studio — Frontend

Frontend React e TypeScript da plataforma. A autenticação usa a API NestJS, com sessão em cookies HttpOnly gerenciada pelo backend.

## Configurar e executar

O frontend precisa apenas de VITE_API_URL no arquivo de ambiente usado pelo Vite:

```dotenv
VITE_API_URL=http://127.0.0.1:3001
```

```powershell
npm.cmd install
npm.cmd run dev
```

Abra http://127.0.0.1:3003. No servidor de desenvolvimento, acessos por localhost são redirecionados para o hostname local configurado em VITE_API_URL, preservando a rota e a porta. Use o mesmo hostname na API e no frontend. Consulte o [guia de autenticação](../social-media-studio-backend/docs/autenticacao.md) para configurar o Supabase no backend, os emails e as URLs de retorno.

A API deve estar disponível antes de testar login. O frontend usa credentials=include e envia um token CSRF nas operações de escrita.

## Sessão

O SDK Supabase foi removido do frontend. JWT e refresh token são cookies HttpOnly; não são lidos pelo JavaScript nem persistidos no localStorage ou sessionStorage.

Login e cadastro são enviados ao NestJS. O backend integra com Supabase Auth, valida os tokens e cuida da renovação. O frontend consulta GET /auth/session e registra/recupera o perfil por POST /users/me antes de abrir a página inicial.

O perfil da plataforma e o token CSRF ficam em memória. As chaves legadas de sessão são removidas ao carregar a aplicação.

## Rotas

| Rota             | Função                                    |
| ---------------- | ----------------------------------------- |
| / ou /login      | Login ou página inicial                   |
| /cadastro        | Cadastro com nome, email, celular e senha |
| /auth/callback   | Retorno da confirmação pelo backend       |
| /recuperar-senha | Solicitar recuperação                     |
| /redefinir-senha | Definir senha com uma sessão válida       |
| /simulador       | Demonstração pública local do feed        |

O celular brasileiro é normalizado para +55DDDNÚMERO. O backend valida os dados novamente; o celular é contato sem confirmação por SMS.

Os emails apontam primeiro para a API. Abra os links no navegador em que solicitou o cadastro ou a recuperação. Os [templates](../social-media-studio-backend/docs/supabase/email-templates/README.md) devem ser publicados no painel do Supabase.

## Demonstração do feed

A demonstração mantém perfil editável, uploads, carrosséis, legendas, ordenação, visualização desktop/mobile e apresentação. Os projetos e imagens ficam no IndexedDB deste navegador e ainda não estão associados a uma conta.

As imagens são preparadas em WebP, limitadas a 1.600 pixels no maior lado ou 600 pixels para avatar. O limite de entrada é 20 MB por imagem e dez imagens por carrossel.

Calendário e tarefas pertencem à fase 3; a integração de projetos e Storage fica para a fase 5.

## Verificação

```powershell
npm.cmd run build
npm.cmd test
```

O Playwright usa Chrome, inicia seu Vite na porta 3103 e simula a API na porta 43001. Os testes verificam cookies HttpOnly, CSRF, ausência de tokens no armazenamento JavaScript, cadastro, recuperação, restauração da sessão e o simulador. Não enviam emails nem criam contas reais.
