import { CalendarDays, Check, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";

export function StudioBrand() {
  return (
    <a className="studio-brand" href="/" aria-label="Serga Studio — início">
      <img src="/logo.png" alt="Serga Studio" width={2000} height={333} />
    </a>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <StudioBrand />
        <div className="auth-story-copy">
          <span className="auth-eyebrow">PLANEJAMENTO PARA SOCIAL MEDIA</span>
          <h1>
            Seu trabalho
            <br />
            mais organizado.
          </h1>
          <p>
            Planeje publicações, acompanhe tarefas e apresente resultados aos
            seus clientes.
          </p>
        </div>
        <div className="auth-scene" aria-hidden="true">
          <div className="scene-card scene-calendar">
            <CalendarDays size={21} />
            <strong>Próximas tarefas</strong>
            <div className="scene-dates">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className={i === 8 ? "selected" : ""}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="scene-card scene-task">
            <span>
              <Check size={15} />
            </span>
            <div>
              <strong>Revisar publicações</strong>
              <small>Tarefa concluída</small>
            </div>
          </div>
          <div className="scene-card scene-feed">
            <LayoutGrid size={17} />
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <p className="auth-story-footer">
          Tarefas e publicações organizadas por cliente.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <StudioBrand />
        </div>
        <div className="auth-card">{children}</div>
        <p className="auth-footer">
          Ferramentas para o trabalho de social media.{" "}
          <a href="/privacidade">Privacidade</a>
        </p>
      </main>
    </div>
  );
}
