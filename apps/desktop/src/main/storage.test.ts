import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDSCodeCredentialStore, getDSCodeHome } from "@thinkany/dscode-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureDesktopStorage } from "./storage";

describe("desktop storage isolation", () => {
  const roots: string[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("isolates development sessions and credentials from the packaged app without accessing the keyring", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dscode-desktop-storage-"));
    roots.push(root);
    const stores = [];
    const homes = [];
    const userDataPaths = [];
    for (const isPackaged of [true, false]) {
      const env: NodeJS.ProcessEnv = { DSCODE_CREDENTIALS_STORE: "keyring" };
      const storage = configureDesktopStorage(isPackaged, path.join(root, "appData"), env, root);
      vi.stubEnv("DSCODE_HOME", env.DSCODE_HOME!);
      vi.stubEnv("DSCODE_CREDENTIALS_STORE", env.DSCODE_CREDENTIALS_STORE!);
      vi.stubEnv("DSCODE_CONFIG_PATH", path.join(getDSCodeHome(), "config.json"));
      vi.stubEnv("DSCODE_SESSIONS_DIR", undefined);
      // A conflicting config must not restore keyring access in either build.
      await fs.mkdir(getDSCodeHome(), { recursive: true });
      await fs.writeFile(path.join(getDSCodeHome(), "config.json"), JSON.stringify({ cli_auth_credentials_store: "keyring" }));
      const store = await createDSCodeCredentialStore({
        keyringFactory: { create: () => { throw new Error("Desktop accessed the OS keyring"); } },
      });
      await store.modify("deepseek", async () => ({ type: "api_key", key: isPackaged ? "release-key" : "dev-key" }));
      stores.push(store);
      homes.push(getDSCodeHome());
      userDataPaths.push(storage.userDataPath);
      expect(storage.migrateLegacyData).toBe(isPackaged);
    }
    expect(homes).toEqual([path.join(root, ".dscode"), path.join(root, ".dscode-dev")]);
    expect(userDataPaths).toEqual([path.join(root, "appData", "DSCode"), path.join(root, "appData", "DSCode Dev")]);
    await expect(stores[0]!.read("deepseek")).resolves.toEqual({ type: "api_key", key: "release-key" });
    await expect(stores[1]!.read("deepseek")).resolves.toEqual({ type: "api_key", key: "dev-key" });
    await stores[1]!.delete("deepseek");
    await expect(stores[1]!.list()).resolves.toEqual([]);
    await expect(stores[0]!.read("deepseek")).resolves.toEqual({ type: "api_key", key: "release-key" });
    if (process.platform !== "win32") {
      expect((await fs.stat(path.join(homes[0]!, "auth.json"))).mode & 0o777).toBe(0o600);
    }
  });

  it("respects explicit test paths without importing legacy desktop data", () => {
    const env = { DSCODE_HOME: "/custom/core", DSCODE_DESKTOP_USER_DATA: "/custom/desktop" };
    expect(configureDesktopStorage(true, "/appData", env)).toEqual({
      userDataPath: path.resolve("/custom/desktop"),
      migrateLegacyData: false,
    });
    expect(env.DSCODE_HOME).toBe("/custom/core");
  });
});
