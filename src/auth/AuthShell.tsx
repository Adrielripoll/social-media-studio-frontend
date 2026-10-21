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
          <span className="auth-eyebrow">SEU TRABALHO, EM UM SÓ LUGAR</span>
          <h1>
            Mais espaço
            <br />
            para suas ideias.
          </h1>
          <p>Seu próximo capítulo como social media começa aqui.</p>
        </div>
        <div className="auth-scene" aria-hidden="true">
          <div className="scene-card scene-calendar">
            <CalendarDays size={21} />
            <strong>Uma ideia de cada vez.</strong>
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
              <strong>Dar forma às ideias</strong>
              <small>O primeiro passo já está dado.</small>
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
          Um espaço para organizar o que vem a seguir.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <StudioBrand />
        </div>
        <div className="auth-card">{children}</div>
        <p className="auth-footer">Planeje com calma. Crie com intenção.</p>
      </main>
    </div>
  );
}
