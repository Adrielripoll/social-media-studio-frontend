import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { authErrorMessage } from "./errors";
import { apiRequest } from "./api";
import AuthShell from "./AuthShell";

type Mode = "login" | "signup" | "forgot" | "reset" | "callback";

const titles = {
  login: [
    "BEM-VINDO DE VOLTA",
    "Entre no seu espaço.",
    "Suas ideias estão esperando por você.",
  ],
  signup: [
    "UM NOVO COMEÇO",
    "Vamos criar sua conta?",
    "Um espaço seu para organizar e apresentar ideias.",
  ],
  forgot: [
    "RECUPERAR ACESSO",
    "Esqueceu sua senha?",
    "Informe seu email para receber um link de recuperação.",
  ],
  reset: [
    "RECUPERAR ACESSO",
    "Escolha uma nova senha.",
    "Use uma senha que você ainda não utiliza.",
  ],
  callback: [
    "CONFIRMAÇÃO DE EMAIL",
    "Vamos continuar?",
    "Faça login para acessar seu espaço.",
  ],
};

function normalizeMobilePhone(value: string): string | null {
  const input = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  const hasCountryCode = digits.length === 13 && digits.startsWith("55");
  if (input.startsWith("+") && !hasCountryCode) return null;
  const nationalNumber = hasCountryCode ? digits.slice(2) : digits;
  return /^[1-9]{2}9\d{8}$/.test(nationalNumber)
    ? "+55" + nationalNumber
    : null;
}

export default function AuthPages({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "signup" && name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    const mobilePhone = mode === "signup" ? normalizeMobilePhone(phone) : null;
    if (mode === "signup" && !mobilePhone) {
      setError(
        "Informe um celular brasileiro com DDD e 9 dígitos. Exemplo: (11) 99999-9999.",
      );
      return;
    }
    if (mode === "reset" && password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await apiRequest<{ requiresEmailConfirmation: boolean }>(
          "/auth/signup",
          {
            method: "POST",
            body: {
              email: email.trim(),
              password,
              name: name.trim(),
              phone: mobilePhone,
            },
          },
        );
        if (!result.requiresEmailConfirmation) {
          await auth.refreshSession();
          return;
        }
        setSuccess(true);
      } else if (mode === "forgot") {
        await apiRequest("/auth/recover", {
          method: "POST",
          body: { email: email.trim() },
        });
        setSuccess(true);
      } else if (mode === "reset") {
        await auth.updatePassword(password);
        setSuccess(true);
      } else {
        await auth.signIn(email.trim(), password);
      }
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/auth/resend", {
        method: "POST",
        body: { email: email.trim() },
      });
      setResent(true);
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  const callbackFailed = mode === "callback" && !auth.authenticated;
  const resetUnavailable = mode === "reset" && !auth.authenticated && !success;
  const loginUpdated =
    new URLSearchParams(window.location.search).get("password_updated") === "1";
  const [eyebrow, title, description] = titles[mode];
  return (
    <AuthShell>
      {(mode === "forgot" || mode === "reset") && (
        <a href="/login" className="auth-back">
          <ArrowLeft size={14} />
          Voltar ao login
        </a>
      )}
      <span className="auth-eyebrow">{eyebrow}</span>
      <h2>
        {success
          ? mode === "reset"
            ? "Senha atualizada."
            : "Confira seu email."
          : title}
      </h2>
      {success ? (
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            {mode === "reset" ? <Check size={24} /> : <Mail size={24} />}
          </span>
          <p>
            {mode === "signup"
              ? "Enviamos as instruções para confirmar seu cadastro. Depois, entre com seu email e senha."
              : mode === "forgot"
                ? "Se existir uma conta com esse email, você receberá um link para escolher uma nova senha."
                : "Sua nova senha está pronta. Entre novamente para continuar."}
          </p>
          <a className="button primary auth-submit" href="/login">
            Voltar ao login
            <ArrowRight size={16} />
          </a>
          {mode === "signup" && (
            <button
              className="auth-link-button"
              disabled={busy}
              onClick={() => void resend()}
            >
              {resent
                ? "Instruções reenviadas"
                : "Reenviar email de confirmação"}
            </button>
          )}
        </div>
      ) : resetUnavailable ? (
        <div className="auth-notice">
          <p>
            Abra o link enviado ao seu email para escolher uma nova senha. Se
            ele expirou, solicite outro.
          </p>
          <a className="button primary auth-submit" href="/recuperar-senha">
            Solicitar novo link
          </a>
        </div>
      ) : callbackFailed ? (
        <div className="auth-notice">
          <p>
            Você pode entrar se já confirmou o email. Abra o link no navegador
            em que iniciou o cadastro. Caso ele tenha expirado, solicite outro
            na tela de cadastro.
          </p>
          <a className="button primary auth-submit" href="/login">
            Ir para o login
            <ArrowRight size={16} />
          </a>
        </div>
      ) : (
        <>
          <p className="auth-description">{description}</p>
          {loginUpdated && (
            <p className="auth-message success" role="status">
              Senha atualizada. Entre novamente.
            </p>
          )}
          <form onSubmit={(event) => void submit(event)} className="auth-form">
            {mode === "signup" && (
              <label className="field">
                <span>Seu nome</span>
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como podemos te chamar?"
                  disabled={busy}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  disabled={busy}
                />
              </label>
            )}
            {mode === "signup" && (
              <label className="field">
                <span>Celular (com DDD)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={25}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(11) 99999-9999"
                  disabled={busy}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label className="field">
                <span>
                  Senha
                  {mode === "login" && (
                    <a href="/recuperar-senha" className="auth-inline-link">
                      Esqueci minha senha
                    </a>
                  )}
                </span>
                <div className="auth-password">
                  <input
                    aria-label="Senha"
                    type={visible ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? 1 : 8}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === "login" ? "Sua senha" : "Pelo menos 8 caracteres"
                    }
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setVisible(!visible)}
                    aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "reset" && (
              <label className="field">
                <span>Confirme a nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={busy}
                />
              </label>
            )}
            {(error || auth.error) && (
              <p className="auth-message error" role="alert">
                {error || auth.error}
              </p>
            )}
            <button
              className="button primary auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Aguarde…
                </>
              ) : (
                <>
                  {mode === "signup"
                    ? "Criar minha conta"
                    : mode === "forgot"
                      ? "Enviar link de recuperação"
                      : mode === "reset"
                        ? "Salvar nova senha"
                        : "Entrar"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          {mode === "login" && (
            <p className="auth-switch">
              Ainda não tem uma conta? <a href="/cadastro">Criar conta</a>
            </p>
          )}
          {mode === "signup" && (
            <p className="auth-switch">
              Já tem uma conta? <a href="/login">Entrar</a>
            </p>
          )}
        </>
      )}
      {success && error && (
        <p className="auth-message error" role="alert">
          {error}
        </p>
      )}
    </AuthShell>
  );
}
