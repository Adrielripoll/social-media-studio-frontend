export type WorkspaceView =
  | { kind: "home" | "clients" }
  | { kind: "feeds" | "dashboards"; clientId?: string }
  | { kind: "client"; id: string }
  | { kind: "dashboard"; id: string; clientId?: string };

export function workspaceView(search = window.location.search): WorkspaceView {
  const params = new URLSearchParams(search);
  const client = params.get("client");
  const dashboard = params.get("dashboard");
  if (dashboard)
    return {
      kind: "dashboard",
      id: dashboard,
      ...(client ? { clientId: client } : {}),
    };
  const view = params.get("view");
  if (client && (view === "feeds" || view === "dashboards")) {
    return { kind: view, clientId: client };
  }
  if (client) return { kind: "client", id: client };
  return {
    kind:
      view === "clients" || view === "feeds" || view === "dashboards"
        ? view
        : "home",
  };
}
export function workspaceUrl(view: WorkspaceView) {
  if (view.kind === "dashboard")
    return (
      "/?" +
      new URLSearchParams({
        view: "dashboards",
        dashboard: view.id,
        ...(view.clientId ? { client: view.clientId } : {}),
      })
    );
  if (view.kind === "client")
    return "/?" + new URLSearchParams({ client: view.id });
  if ((view.kind === "feeds" || view.kind === "dashboards") && view.clientId) {
    return (
      "/?" + new URLSearchParams({ view: view.kind, client: view.clientId })
    );
  }
  return view.kind === "home" ? "/" : "/?view=" + view.kind;
}
export function feedEditorUrl(id: string, view: WorkspaceView) {
  return (
    "/simulador?" +
    new URLSearchParams({ feed: id, returnTo: workspaceUrl(view) })
  );
}
export function workspaceReturnUrl() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value) return "/?view=feeds";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/?view=feeds";
    if (
      url.pathname === "/minha-conta" &&
      url.searchParams.get("secao") === "armazenamento"
    )
      return "/minha-conta?secao=armazenamento";
    if (url.pathname !== "/") return "/?view=feeds";
    return workspaceUrl(workspaceView(url.search));
  } catch {
    return "/?view=feeds";
  }
}
