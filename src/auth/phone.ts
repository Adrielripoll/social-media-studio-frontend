export function formatMobilePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasCountryCode =
    value.trim().startsWith("+55") ||
    (digits.length === 13 && digits.startsWith("55"));
  const national = (hasCountryCode ? digits.slice(2) : digits).slice(0, 11);
  if (!national) return "";
  if (national.length <= 2) return "(" + national;
  const prefix = "(" + national.slice(0, 2) + ") ";
  const number = national.slice(2);
  return (
    prefix +
    (number.length > 5 ? number.slice(0, 5) + "-" + number.slice(5) : number)
  );
}

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
