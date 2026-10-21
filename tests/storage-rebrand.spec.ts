import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/rebrand-storage-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html></html>",
    }),
  );
  await page.goto("/rebrand-storage-check");
});

for (const preserveCurrent of [false, true]) {
  test(
    preserveCurrent
      ? "preserva dados já salvos no novo banco"
      : "migra a demonstração sem perder os dados legados",
    async ({ page }) => {
      const result = await page.evaluate(
        async ({ modulePath, preserveCurrent }) => {
          const legacy = { version: 1, activeFeedId: "legacy", feeds: [] };
          const current = { version: 1, activeFeedId: "current", feeds: [] };
          async function seed(name: string, workspace: object) {
            await new Promise<void>((resolve, reject) => {
              const request = indexedDB.open(name, 1);
              request.onupgradeneeded = () =>
                request.result.createObjectStore("workspace");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(
                  "workspace",
                  "readwrite",
                );
                transaction.objectStore("workspace").put(workspace, "current");
                transaction.oncomplete = () => {
                  database.close();
                  resolve();
                };
                transaction.onerror = () => reject(transaction.error);
              };
            });
          }
          await seed("social-studio-demo", legacy);
          if (preserveCurrent) {
            await seed("serga-studio-demo", current);
          }
          const storage = await import(modulePath);
          const workspace = await storage.loadWorkspace();
          const reloaded = await storage.loadWorkspace();
          const databases = await indexedDB.databases();
          return {
            workspace,
            reloaded,
            databases: databases.map((item) => item.name),
          };
        },
        { modulePath: "/src/storage.ts", preserveCurrent },
      );
      expect(result.workspace.activeFeedId).toBe(
        preserveCurrent ? "current" : "legacy",
      );
      expect(result.reloaded).toEqual(result.workspace);
      expect(result.databases).toContain("serga-studio-demo");
      expect(result.databases).toContain("social-studio-demo");
    },
  );
}
