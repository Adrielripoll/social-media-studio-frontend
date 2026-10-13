# Social Media Studio — Frontend

Frontend React e TypeScript da plataforma. A fase 1 inclui cadastro, login, confirmação de email e recuperação de senha. Na fase 2, o primeiro acesso registra o perfil na API NestJS antes de abrir a página inicial.

## Configurar

Preencha `.env.local` usando `.env.example`:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
VITE_API_URL=http://localhost:3001
```

Use uma chave publishable ou anon, nunca secret ou service_role. Os valores do Supabase devem corresponder ao projeto configurado no backend.

Consulte o [guia de autenticação](../social-media-studio-backend/docs/autenticacao.md) para configurar confirmação de email, chaves de assinatura e redirects.

## Executar

```powershell
npm.cmd install
npm.cmd run dev
```

Abra **http://127.0.0.1:3003**. O backend deve estar disponível em `VITE_API_URL`. No PowerShell, `npm.cmd` evita bloqueios de execução do script `npm.ps1`.

Sem configuração de autenticação, a tela permite explorar a demonstração. Reinicie o Vite depois de preencher o ambiente.

## Rotas

| Rota               | Finalidade                                        |
| ------------------ | ------------------------------------------------- |
| `/` ou `/login`    | Login ou página inicial após validação da sessão  |
| `/cadastro`        | Cadastro e reenvio da confirmação de email        |
| `/auth/callback`   | Retorno da confirmação com PKCE                   |
| `/recuperar-senha` | Solicitar link de recuperação                     |
| `/redefinir-senha` | Definir nova senha com sessão válida              |
| `/simulador`       | Demonstração pública local do simulador existente |

O SDK Supabase gerencia e renova a sessão. O frontend envia o JWT em POST /users/me, sem dados de perfil no corpo, e apresenta a página inicial com o usuário persistido devolvido pelo backend. A operação é idempotente e também acontece ao restaurar ou renovar a sessão. Falhas temporárias da API oferecem uma nova tentativa e preservam a sessão. Consulte [Banco e usuários](../social-media-studio-backend/docs/banco-e-usuarios.md) para configurar o Postgres e executar as migrations.

A página inicial ainda não inclui calendário e tarefas; essa ferramenta pertence à fase 3.

## Cadastro com celular

O cadastro solicita nome, email, celular brasileiro com DDD e senha. Aceita números como `(11) 99999-9999` e `+55 (11) 99999-9999`, normaliza para `+5511999999999` e envia o valor em `options.data.phone` ao Supabase.

O celular é um dado de contato sem verificação por SMS. O login continua por email e senha e contas antigas sem celular seguem funcionando. A validação confere o formato, não a existência do número.

Os [templates de email](../social-media-studio-backend/docs/supabase/email-templates/README.md) estão preparados para aplicar no painel do Supabase. Os refinos gerais de UX/UI ficaram registrados para o futuro.

## Simulador preservado

A demonstração em `/simulador` mantém perfil editável, uploads, carrosséis, legendas, ordenação do feed, prévias desktop e mobile e modo apresentação.

Os projetos e imagens dessa demonstração ficam no IndexedDB deste navegador e desta origem. Ainda não estão vinculados a uma conta. Limpar os dados do site remove os projetos. A integração com projetos e Supabase Storage será feita na fase 5.

As imagens são preparadas em WebP, com o maior lado limitado a 1.600 pixels (600 pixels para avatar). O limite de entrada continua em 20 MB por imagem e dez imagens por carrossel.

## Verificar

```powershell
npm.cmd run build
npm.cmd test
```

Os testes usam o Chrome instalado e iniciam uma instância própria do Vite na porta **3103**, com configuração exclusiva de teste. Usam o SDK real com respostas locais para os serviços, sem cadastrar usuários nem enviar emails reais. Também verificam os fluxos do simulador.

O envio real de emails e a configuração do Supabase precisam ser validados depois de preencher o ambiente.
