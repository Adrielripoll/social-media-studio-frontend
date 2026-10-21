import { useEffect, useId, useState } from "react";
import { apiRequest } from "../auth/api";
export interface ExitFeedbackValue {
  reasonId?: string;
  details?: string;
}
export default function ExitFeedback({
  context,
  value,
  onChange,
  disabled = false,
}: {
  context: "subscription_cancellation" | "account_deletion";
  value: ExitFeedbackValue;
  onChange: (value: ExitFeedbackValue) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ reasons: { id: string; label: string }[] }>(
      "/account/exit-reasons?context=" + context,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setReasons(result.reasons);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [context]);
  return (
    <div className="privacy-feedback">
      <label className="field" htmlFor={id + "-reason"}>
        <span>Qual o motivo? (opcional)</span>
        <select
          id={id + "-reason"}
          value={value.reasonId ?? ""}
          disabled={disabled || status !== "ready"}
          onChange={(event) =>
            onChange({ ...value, reasonId: event.target.value || undefined })
          }
        >
          <option value="">
            {status === "loading"
              ? "Carregando motivos…"
              : "Prefiro não informar"}
          </option>
          {reasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      {status === "error" && (
        <p role="status">
          Não foi possível carregar os motivos. Você pode continuar sem escolher
          um.
        </p>
      )}
      <label className="field" htmlFor={id + "-details"}>
        <span>Quer contar mais? (opcional)</span>
        <textarea
          id={id + "-details"}
          rows={3}
          maxLength={2000}
          value={value.details ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, details: event.target.value })
          }
          aria-describedby={id + "-help"}
        />
      </label>
      <p id={id + "-help"} className="account-field-help">
        Sua opinião ajuda a melhorar o Serga Studio. Não inclua senhas, dados de
        cartão ou informações sensíveis.
        {context === "subscription_cancellation"
          ? " Podemos entrar em contato para ajudar com o problema informado enquanto sua conta existir."
          : " Seu relato será normalizado e desvinculado da conta; detalhes identificáveis serão removidos."}
      </p>
    </div>
  );
}
