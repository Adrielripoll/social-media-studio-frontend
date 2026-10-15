export type WorkspaceView =
  { kind: "home" | "clients" | "feeds" } | { kind: "client"; id: string };

export function workspaceView(search = window.location.search): WorkspaceView {
  const params = new URLSearchParams(search);
  const client = params.get("client");
  if (client) return { kind: "client", id: client };
  const view = params.get("view");
  return { kind: view === "clients" || view === "feeds" ? view : "home" };
}
export function workspaceUrl(view: WorkspaceView) {
  if (view.kind === "client") return "/?" + new URLSearchParams({ client: view.id });
  return view.kind === "home" ? "/" : "/?view=" + view.kind;
}
export function feedEditorUrl(id: string, view: WorkspaceView) {
  return "/simulador?" + new URLSearchParams({ feed: id, returnTo: workspaceUrl(view) });
}
export function workspaceReturnUrl() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value) return "/?view=feeds";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/")
      return "/?view=feeds";
    return workspaceUrl(workspaceView(url.search));
  } catch {
    return "/?view=feeds";
  }
}
