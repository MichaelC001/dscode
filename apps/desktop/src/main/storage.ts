import os from "node:os";
import path from "node:path";

/** Run before initializing Core; AgentHost inherits this environment for RPC. */
export function configureDesktopStorage(
  isPackaged: boolean,
  appData: string,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
): { userDataPath: string; migrateLegacyData: boolean } {
  env.DSCODE_HOME ??= path.join(home, isPackaged ? ".dscode" : ".dscode-dev");
  // Desktop authentication must never open an OS keyring authorization dialog.
  env.DSCODE_CREDENTIALS_STORE = "file";

  const override = env.DSCODE_DESKTOP_USER_DATA;
  return {
    userDataPath: override
      ? path.resolve(override)
      : path.join(appData, isPackaged ? "DSCode" : "DSCode Dev"),
    migrateLegacyData: isPackaged && !override,
  };
}
