import { useEffect, useState } from "react";
import {
  ArrowRight,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  RefreshCw,
} from "lucide-react";
import TaskPlanner from "./tasks/TaskPlanner";
import Simulator from "./App";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { authConfiguration } from "./auth/config";
import AuthPages from "./auth/AuthPages";
import AuthShell, { StudioBrand } from "./auth/AuthShell";
import { authErrorMessage } from "./auth/errors";

function Home() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    window.history.replaceState(null, "", "/");
  }, []);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await auth.signOut();
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="platform-home">
      <header className="platform-header">
        <StudioBrand />
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={15} />
          Sair
        </button>
      </header>
      <main className="platform-content">
        <span className="auth-eyebrow">SEU ESPAÇO CRIATIVO</span>
        <h1>
          Bem-vindo
          {auth.identity?.name ? ", " + auth.identity.name.split(" ")[0] : ""}.
        </h1>
        <p className="platform-intro">
          Organize seu dia e dê espaço às próximas ideias.
        </p>
        <TaskPlanner />
        <section className="platform-demo">
          <div>
            <span className="demo-pill">DEMONSTRAÇÃO</span>
            <h2>Experimente o simulador de feed.</h2>
            <p>
              Monte um perfil fictício e explore suas ideias. A demonstração
              salva os projetos apenas neste navegador.
            </p>
          </div>
          <a className="button secondary" href="/simulador">
            <LayoutGrid size={16} />
            Abrir demonstração
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
            Acesso confirmado
          </span>
        </div>
        {error && (
          <p className="auth-message error" role="alert">
            {error}
          </p>
        )}
      </main>
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
  if (auth.sessionLoading)
    return (
      <AuthShell>
        <LoaderCircle className="spin" size={24} />
        <h2 className="auth-loading-title">Abrindo seu espaço…</h2>
      </AuthShell>
    );
  if (path === "/redefinir-senha") return <AuthPages mode="reset" />;
  if (auth.authenticated && !auth.identity) {
    return (
      <AuthShell>
        {accessError ? (
          <>
            <span className="auth-eyebrow">VAMOS TENTAR NOVAMENTE</span>
            <h2>Seu espaço aguarda você.</h2>
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
            <button
              className="auth-link-button"
              onClick={() => void backToLogin()}
            >
              Voltar ao login
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={24} />
            <h2 className="auth-loading-title">Preparando seu espaço…</h2>
          </>
        )}
      </AuthShell>
    );
  }
  if (auth.identity) return <Home />;
  if (path === "/cadastro") return <AuthPages mode="signup" />;
  if (path === "/recuperar-senha") return <AuthPages mode="forgot" />;
  if (path === "/auth/callback") return <AuthPages mode="callback" />;
  return <AuthPages mode="login" />;
}

export default function PlatformApp() {
  if (window.location.pathname === "/simulador") return <Simulator />;
  if (!authConfiguration.configured)
    return (
      <AuthShell>
        <span className="auth-eyebrow">SOCIAL STUDIO</span>
        <h2>Seu espaço está sendo preparado.</h2>
        <p className="auth-description">
          O acesso estará disponível em breve. Enquanto isso, você pode explorar
          a demonstração.
        </p>
        <a className="button primary auth-submit" href="/simulador">
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
