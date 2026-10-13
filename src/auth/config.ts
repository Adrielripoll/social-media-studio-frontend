const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const apiUrl = import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isPrivateKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  try {
    const payload = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export const authConfiguration = {
  projectUrl: projectUrl.replace(/\/$/, ""),
  publicKey,
  apiUrl: apiUrl.replace(/\/$/, ""),
  configured:
    isHttpUrl(projectUrl) &&
    Boolean(publicKey) &&
    !isPrivateKey(publicKey) &&
    isHttpUrl(apiUrl),
};
