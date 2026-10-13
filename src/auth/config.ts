const apiUrl = import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:3001";
function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
export const authConfiguration = {
  apiUrl: apiUrl.replace(/\/$/, ""),
  configured: isHttpUrl(apiUrl),
};
