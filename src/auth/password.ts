export const PASSWORD_HELP =
  "Use entre 8 e 128 caracteres, com uma letra maiúscula, uma minúscula e um caractere especial.";

export function isValidPassword(value: string): boolean {
  return /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*[^\p{L}\p{N}\s]).{8,128}$/u.test(value);
}
