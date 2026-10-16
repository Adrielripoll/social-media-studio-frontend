import type { ReactNode } from "react";
import { useAccount } from "./AccountContext";
import { useAuth } from "../auth/AuthContext";
import PlatformHeader from "../components/PlatformHeader";
import MyAccountPage from "./MyAccountPage";
export function AccountAccessBoundary({ children }: { children: ReactNode }) {
  const state = useAccount(),
    auth = useAuth();
  const path = window.location.pathname;
  if (path === "/minha-conta" || path === "/assinatura")
    return (
      <MyAccountPage
        initialSection={path === "/assinatura" ? "subscription" : "profile"}
        blocked={!!state?.account && !state.account.access.allowed}
      />
    );
  if (state?.error)
    return (
      <div className="platform-home">
        <PlatformHeader onSignOut={auth.signOut} />
        <section className="account-storage" aria-label="Armazenamento">
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={state.refresh}>
            Tentar novamente
          </button>
          <a className="button secondary" href="/minha-conta?secao=assinatura">
            Gerenciar assinatura
          </a>
        </section>
      </div>
    );
  if (!state?.account)
    return (
      <div className="session-loading" role="status">
        Consultando acesso…
      </div>
    );
  if (!state.account.access.allowed)
    return <MyAccountPage initialSection="subscription" blocked />;
  return children;
}
