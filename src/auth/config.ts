const configuredApiUrl =
  import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:3001";
function developmentApiUrl(value: string) {
  if (!import.meta.env.DEV) return value;
  try {
    const url = new URL(value);
    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    if (
      localHosts.includes(url.hostname) &&
      !localHosts.includes(window.location.hostname)
    ) {
      url.hostname = window.location.hostname;
    }
    return url.href;
  } catch {
    return value;
  }
}
const apiUrl = developmentApiUrl(configuredApiUrl);
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
