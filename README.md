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
| /simulador       | Simulador autenticado, salvo na conta     |
| /demonstracao     | Demonstração pública local separada       |

O celular brasileiro é normalizado para +55DDDNÚMERO. O backend valida os dados novamente; o celular é contato sem confirmação por SMS.

Os emails apontam primeiro para a API. Abra os links no navegador em que solicitou o cadastro ou a recuperação. Os [templates](../social-media-studio-backend/docs/supabase/email-templates/README.md) devem ser publicados no painel do Supabase.

## Demonstração do feed

A demonstração mantém perfil editável, uploads, carrosséis, legendas, ordenação, visualização desktop/mobile e apresentação. Os dados da demonstração ficam no IndexedDB, separados dos feeds da conta. O simulador autenticado persiste pela API e pelo Storage.

As imagens são preparadas em WebP, limitadas a 1.600 pixels no maior lado ou 600 pixels para avatar. O limite de entrada é 20 MB por imagem e dez imagens por carrossel.

A fase 3 está implementada: a página inicial mostra hoje e um calendário mensal. O menu da data permite criar tarefas, editar apenas o título, concluir/reabrir e excluir com confirmação. A lista principal permanece em hoje. As tarefas persistem no backend, com fuso America/Sao_Paulo e criação apenas para hoje/futuro.

Consulte [Calendário e tarefas](../social-media-studio-backend/docs/calendario-e-tarefas.md). A integração de feeds e Storage fica para a fase 5; a cobrança permanece independente desta entrega.

## Verificação

```powershell
npm.cmd run build
npm.cmd test
```

O Playwright usa Chrome, inicia seu Vite na porta 3103 e simula a API na porta 43001. Os testes verificam cookies HttpOnly, CSRF, ausência de tokens no armazenamento JavaScript, cadastro, recuperação, restauração da sessão, calendário/tarefas e o simulador. Não enviam emails nem criam contas reais.

A fase 4 mantém clientes e calendário ativos. Projetos da conta estão desativados. No simulador, cada perfil é apresentado como um feed independente; a demonstração local é separada e não importa dados antigos. A fase 5 integra feeds da conta com cliente opcional; dashboards e agrupamento por campanha ficam para o futuro. Consulte [Clientes e recursos independentes](../social-media-studio-backend/docs/clientes-e-projetos.md).

## Feeds da conta — fase 5

/simulador agora exige autenticação e salva na API. A biblioteca de feeds está na navegação inicial e no contexto de cada cliente. /demonstracao continua sendo um exemplo local separado, sem importar dados antigos para a conta. Use VITE_API_URL; não configure chaves Supabase no frontend. Consulte o backend em docs/feeds-e-storage.md para aplicar a migration e preparar o bucket privado.

## Testar em outro dispositivo da rede

O servidor de desenvolvimento escuta em 0.0.0.0 na porta 3003. Abra http://IP-DO-COMPUTADOR:3003 no outro dispositivo. Se VITE_API_URL aponta para localhost/127.0.0.1, o frontend de desenvolvimento usa automaticamente o IP acessado, mantendo a porta da API. Em produção, VITE_API_URL é usado como configurado.

No backend, inclua http://IP-DO-COMPUTADOR:3003 em CORS_ORIGINS e reinicie os dois processos. Frontend e API devem usar o mesmo hostname para os cookies. Se houver bloqueio no Windows, permita as portas 3003 e 3001 para a rede privada/local.

Confirmação de cadastro e recuperação por email também dependem de FRONTEND_URL e API_PUBLIC_URL: para testar esses links no dispositivo remoto, use o IP da rede nos dois valores e cadastre o callback correspondente no Supabase. Os links devem ser abertos no navegador que iniciou a operação.
