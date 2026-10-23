import { useEffect, useState } from "react";
import {
  UserRound,
  CreditCard,
  HardDrive,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import PlatformHeader from "../components/PlatformHeader";
import { useAuth } from "../auth/AuthContext";
import { useAccount } from "./AccountContext";
import PrivacyPanel from "../privacy/PrivacyPanel";
import ProfilePanel from "./ProfilePanel";
import StoragePanel from "./StoragePanel";
import BillingPanel from "../billing/BillingPanel";
import "./my-account.css";
type Section = "profile" | "subscription" | "storage";
const sections = [
  {
    id: "profile" as const,
    slug: "perfil",
    label: "Perfil e segurança",
    description: "Seus dados e senha",
    icon: UserRound,
  },
  {
    id: "subscription" as const,
    slug: "assinatura",
    label: "Assinatura",
    description: "Plano e pagamentos",
    icon: CreditCard,
  },
  {
    id: "storage" as const,
    slug: "armazenamento",
    label: "Armazenamento",
    description: "Consumo e arquivos",
    icon: HardDrive,
  },
];
function fromLocation(fallback: Section) {
  const slug = new URLSearchParams(window.location.search).get("secao");
  return sections.find((item) => item.slug === slug)?.id ?? fallback;
}
const accessLabels: Record<string, string> = {
  trialing: "Teste gratuito",
  active: "Assinatura ativa",
  canceled: "Renovação cancelada",
  overdue: "Pagamento em atraso",
  trial_expired: "Teste encerrado",
  subscription_expired: "Acesso encerrado",
};
export default function MyAccountPage({
  initialSection = "profile",
  blocked = false,
}: {
  initialSection?: Section;
  blocked?: boolean;
}) {
  const auth = useAuth(),
    account = useAccount();
  const [section, setSection] = useState<Section>(() =>
    fromLocation(initialSection),
  );
  useEffect(() => {
    const change = () => setSection(fromLocation(initialSection));
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, [initialSection]);
  const name = auth.identity?.name ?? "",
    initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  function navigate(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: Section,
    slug: string,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    window.history.pushState(null, "", "/minha-conta?secao=" + slug);
    setSection(id);
  }
  return (
    <div className="platform-home account-experience">
      <PlatformHeader onSignOut={auth.signOut} showAccountLink={false}>
        {account?.account?.access.allowed && (
          <a className="button secondary" href="/">
            <ArrowLeft size={16} />
            Voltar às ferramentas
          </a>
        )}
      </PlatformHeader>
      <main className="my-account">
        <div className="my-account-hero">
          <div>
            <span className="account-eyebrow">CONTA E PREFERÊNCIAS</span>
            <h1>Minha conta</h1>
            <p>
              Atualize seus dados, acompanhe sua assinatura e gerencie seus
              arquivos.
            </p>
          </div>
          <span
            className={
              "account-status-pill " +
              (account?.account?.access.allowed ? "is-active" : "is-blocked")
            }
          >
            {account?.loading
              ? "Consultando acesso…"
              : (accessLabels[account?.account?.access.status ?? ""] ??
                "Verificando acesso")}
          </span>
        </div>
        <div className="my-account-layout">
          <aside className="account-sidebar">
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">
                {initials}
              </span>
              <strong>{name}</strong>
              <span>{auth.identity?.email}</span>
            </div>
            <nav aria-label="Configurações da conta">
              {sections.map((item) => (
                <a
                  key={item.id}
                  href={"/minha-conta?secao=" + item.slug}
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={(event) => navigate(event, item.id, item.slug)}
                >
                  <item.icon size={19} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ChevronRight size={15} />
                </a>
              ))}
            </nav>
            <p className="account-sidebar-note">
              Gerencie seus dados, sua assinatura e seus arquivos.
            </p>
          </aside>
          <div className="account-main">
            {account?.error && (
              <div className="account-feedback error" role="alert">
                <p>{account.error}</p>
                <button className="button secondary" onClick={account.refresh}>
                  Tentar novamente
                </button>
              </div>
            )}
            {section === "profile" && (
              <div className="account-profile-content">
                <ProfilePanel />
                <PrivacyPanel />
              </div>
            )}
            {section === "subscription" && (
              <>
                <BillingPanel blocked={blocked} />
              </>
            )}
            {section === "storage" && <StoragePanel />}
          </div>
        </div>
      </main>
    </div>
  );
}
