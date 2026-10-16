export function normalizeMobilePhone(value: string): string | null {
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
