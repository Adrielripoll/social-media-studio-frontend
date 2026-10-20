import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { UserRound, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../auth/api";
import { authErrorMessage } from "../auth/errors";
import { formatMobilePhone, normalizeMobilePhone } from "../auth/phone";
import { isValidPassword, PASSWORD_HELP } from "../auth/password";
export default function ProfilePanel() {
  const auth = useAuth(),
    identity = auth.identity!;
  const [name, setName] = useState(identity.name),
    [phone, setPhone] = useState(formatMobilePhone(identity.phone ?? ""));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [field, setField] = useState<"name" | "phone" | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (field && !busy)
      (
        form.current?.elements.namedItem(field) as HTMLInputElement | null
      )?.focus();
  }, [field, busy]);
  function reject(target: "name" | "phone", message: string) {
    setField(target);
    setError(message);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setField(null);
    setSaved(false);
    if (
      name.trim().length < 2 ||
      name.trim().length > 60 ||
      /\p{Cc}/u.test(name)
    ) {
      reject("name", "Informe um nome entre 2 e 60 caracteres.");
      return;
    }
    const normalized = normalizeMobilePhone(phone);
    if (!normalized && (!!phone.trim() || !!identity.phone)) {
      reject("phone", "Informe um celular brasileiro válido com DDD.");
      return;
    }
    setBusy(true);
    try {
      await auth.updateProfile({
        name: name.trim(),
        ...(normalized ? { phone: normalized } : {}),
      });
      setPhone(formatMobilePhone(normalized ?? ""));
      setName(name.trim().replace(/\s+/g, " "));
      setSaved(true);
    } catch (reason) {
      const message = authErrorMessage(reason);
      if (reason instanceof ApiError && reason.code === "phone_already_in_use")
        reject("phone", message);
      else if (/celular|telefone/i.test(message)) reject("phone", message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-section-stack">
      <section className="account-card" aria-labelledby="profile-title">
        <div className="account-card-heading">
          <span className="account-card-icon">
            <UserRound size={22} />
          </span>
          <div>
            <h2 id="profile-title">Seu perfil</h2>
            <p>Seus dados de identificação e contato.</p>
          </div>
        </div>
        <form
          ref={form}
          className="account-form"
          onSubmit={(event) => void save(event)}
          noValidate
        >
          <label className="field">
            <span>Nome completo</span>
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
                if (field === "name") {
                  setError("");
                  setField(null);
                }
              }}
              aria-invalid={field === "name" || undefined}
              aria-describedby={field === "name" ? "profile-error" : undefined}
            />
          </label>
          <label className="field">
            <span>Email de acesso</span>
            <input
              type="email"
              value={identity.email ?? ""}
              readOnly
              autoComplete="email"
              aria-describedby="profile-email-help"
            />
          </label>
          <p className="account-field-help" id="profile-email-help">
            O email é sua identificação de acesso e não pode ser alterado nesta
            tela.
          </p>
          <label className="field">
            <span>Celular (com DDD)</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={19}
              value={phone}
              disabled={busy}
              placeholder="(11) 99999-9999"
              onChange={(event) => {
                setPhone(formatMobilePhone(event.target.value));
                setSaved(false);
                if (field === "phone") {
                  setError("");
                  setField(null);
                }
              }}
              aria-invalid={field === "phone" || undefined}
              aria-describedby={
                field === "phone" ? "profile-error" : "profile-phone-help"
              }
            />
          </label>
          <p className="account-field-help" id="profile-phone-help">
            Um celular pode pertencer a apenas uma conta.
          </p>
          {error && (
            <p
              className="account-feedback error"
              id="profile-error"
              role="alert"
            >
              {error}
            </p>
          )}
          {saved && (
            <p className="account-feedback success" role="status">
              Perfil atualizado com sucesso.
            </p>
          )}
          <div className="account-form-actions">
            <button className="button primary" disabled={busy} type="submit">
              {busy ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      </section>
      <PasswordPanel />
    </div>
  );
}
function PasswordPanel() {
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const currentPasswordInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [passwordField, setPasswordField] = useState<
    "currentPassword" | "password" | "confirmation" | null
  >(null);
  const confirmationInput = useRef<HTMLInputElement>(null),
    passwordInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (passwordField === "currentPassword" && !busy)
      currentPasswordInput.current?.focus();
  }, [passwordField, busy]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setPasswordField(null);
    if (!currentPassword) {
      setPasswordField("currentPassword");
      setError("Informe sua senha atual.");
      currentPasswordInput.current?.focus();
      return;
    }
    if (!isValidPassword(password)) {
      setPasswordField("password");
      setError(PASSWORD_HELP);
      passwordInput.current?.focus();
      return;
    }
    if (password !== confirmation) {
      setPasswordField("confirmation");
      setError("As senhas precisam ser iguais.");
      confirmationInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(password, {
        returnToLogin: true,
        currentPassword,
      });
    } catch (reason) {
      setError(authErrorMessage(reason));
      if (
        reason instanceof ApiError &&
        ["current_password_invalid", "current_password_required"].includes(
          reason.code,
        )
      ) {
        setPasswordField("currentPassword");
        currentPasswordInput.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-card" aria-labelledby="password-title">
      <div className="account-card-heading">
        <span className="account-card-icon blue">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h2 id="password-title">Segurança</h2>
          <p>Altere sua senha de acesso.</p>
        </div>
      </div>
      <form
        className="account-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <label className="field">
          <span>Senha atual</span>
          <input
            ref={currentPasswordInput}
            name="current-password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setError("");
              setPasswordField(null);
            }}
            disabled={busy}
            aria-invalid={passwordField === "currentPassword" || undefined}
            aria-describedby={
              passwordField === "currentPassword" ? "password-error" : undefined
            }
          />
        </label>
        <label className="field">
          <span>Nova senha</span>
          <input
            ref={passwordInput}
            name="new-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
              setPasswordField(null);
            }}
            disabled={busy}
            aria-invalid={passwordField === "password" || undefined}
            aria-describedby={
              passwordField === "password" ? "password-error" : "password-help"
            }
          />
        </label>
        <label className="field">
          <span>Confirme a nova senha</span>
          <input
            ref={confirmationInput}
            name="confirm-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError("");
              setPasswordField(null);
            }}
            disabled={busy}
            aria-describedby={
              passwordField === "confirmation" ? "password-error" : undefined
            }
            aria-invalid={passwordField === "confirmation" || undefined}
          />
        </label>
        <button
          type="button"
          className="account-text-button"
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          disabled={busy}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {visible ? "Ocultar senhas" : "Mostrar senhas"}
        </button>
        <p className="account-field-help" id="password-help">
          {PASSWORD_HELP} Após salvar, você deverá entrar novamente.
        </p>
        {error && (
          <p
            id="password-error"
            className="account-feedback error"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="account-form-actions">
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Alterando…" : "Alterar senha"}
          </button>
        </div>
      </form>
    </section>
  );
}
