import PrivacyPage, { DeletionReceipt } from "./privacy/PrivacyPage";
import { AccountAccessBoundary } from "./account/AccountAccessBoundary";
import { AccountProvider } from "./account/AccountContext";
import PlatformHeader from "./components/PlatformHeader";
import Workspace from "./workspace/Workspace";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutGrid, LoaderCircle, RefreshCw } from "lucide-react";
import TaskPlanner from "./tasks/TaskPlanner";
import Simulator from "./App";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { authConfiguration } from "./auth/config";
import AuthPages from "./auth/AuthPages";
import AuthShell from "./auth/AuthShell";
import { authErrorMessage } from "./auth/errors";

function Home() {
  const auth = useAuth();
  useEffect(() => {
    if (
      ["/login", "/cadastro", "/auth/callback"].includes(
        window.location.pathname,
      )
    )
      window.history.replaceState(null, "", "/");
  }, []);
  return (
    <div className="platform-home">
      <PlatformHeader onSignOut={auth.signOut} />

      <Workspace>
        <header className="studio-hero studio-page-heading">
          <div>
            <span className="auth-eyebrow">INÍCIO</span>
            <h1>
              Bem-vindo
              {auth.identity?.name
                ? ", " + auth.identity.name.split(" ")[0]
                : ""}
              .
            </h1>
            <p className="platform-intro">
              Veja as tarefas de hoje e planeje os próximos dias.
            </p>
          </div>
        </header>
        <TaskPlanner />
        <section className="platform-demo">
          <div>
            <span className="demo-pill">PLANEJADOR DE FEED</span>
            <h2>Planeje suas publicações</h2>
            <p>
              Planeje e visualize como suas publicações podem aparecer no
              Instagram. Seus feeds ficam salvos na sua conta.
            </p>
          </div>
          <a className="button secondary" href="/simulador">
            <LayoutGrid size={16} />
            Abrir meus feeds
            <ArrowRight size={16} />
          </a>
        </section>
        <div className="platform-account">
          <span>
            Conectado como{" "}
            <strong>
              {auth.identity?.email || auth.identity?.name || "usuário"}
            </strong>
          </span>
          <span className="platform-connected">
            <i />
            Sessão ativa
          </span>
        </div>
      </Workspace>
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="session-loading" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
      <span>Carregando seu espaço…</span>
    </div>
  );
}

function AuthContent() {
  const auth = useAuth();
  const [exitError, setExitError] = useState("");
  const path = window.location.pathname;
  const accessError = exitError || auth.error;
  async function backToLogin() {
    setExitError("");
    try {
      await auth.signOut();
    } catch (reason) {
      setExitError(authErrorMessage(reason));
    }
  }
  if (auth.sessionLoading) return <SessionLoading />;
  if (path === "/redefinir-senha") return <AuthPages mode="reset" />;
  if (auth.authenticated !== false && !auth.identity) {
    if (!accessError) return <SessionLoading />;
    return (
      <AuthShell>
        <span className="auth-eyebrow">VAMOS TENTAR NOVAMENTE</span>
        <h2>Não foi possível carregar sua conta.</h2>
        <p className="auth-message error" role="alert">
          {accessError}
        </p>
        <button
          className="button primary auth-submit"
          onClick={auth.retry}
          disabled={auth.verifying}
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
        <button className="auth-link-button" onClick={() => void backToLogin()}>
          Voltar ao login
        </button>
      </AuthShell>
    );
  }
  if (auth.identity)
    return (
      <AccountProvider key={auth.identity.id}>
        <AccountAccessBoundary>
          {path === "/simulador" ? (
            <Simulator onSignOut={auth.signOut} />
          ) : (
            <Home />
          )}
        </AccountAccessBoundary>
      </AccountProvider>
    );
  if (path === "/cadastro") return <AuthPages mode="signup" />;
  if (path === "/recuperar-senha") return <AuthPages mode="forgot" />;
  if (path === "/auth/callback") return <AuthPages mode="callback" />;
  return <AuthPages mode="login" />;
}

export default function PlatformApp() {
  if (window.location.pathname === "/privacidade") return <PrivacyPage />;
  if (window.location.pathname === "/conta-excluida")
    return <DeletionReceipt />;
  if (window.location.pathname === "/demonstracao") return <Simulator demo />;
  if (!authConfiguration.configured)
    return (
      <AuthShell>
        <span className="auth-eyebrow">SERGA STUDIO</span>
        <h2>Configuração necessária</h2>
        <p className="auth-description">
          O acesso estará disponível em breve. Enquanto isso, você pode explorar
          a demonstração.
        </p>
        <a className="button primary auth-submit" href="/demonstracao">
          Explorar demonstração
          <ArrowRight size={17} />
        </a>
      </AuthShell>
    );
  return (
    <AuthProvider>
      <AuthContent />
    </AuthProvider>
  );
}
