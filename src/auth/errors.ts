import { ApiError } from "./api";
export function authErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  switch (code) {
    case "invalid_credentials":
      return "Email ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu email antes de entrar.";
    case "weak_password":
      return "Escolha uma senha mais forte.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
    case "otp_expired":
      return "Este link expirou. Solicite um novo link.";
    case "same_password":
      return "Escolha uma senha diferente da anterior.";
    case "session_not_found":
      return "Sua sessão expirou. Solicite um novo link.";
    default:
      return "Não foi possível concluir. Confira seus dados e tente novamente.";
  }
}
