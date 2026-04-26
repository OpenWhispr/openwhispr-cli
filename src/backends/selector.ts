import { readBridgeFile, readConfig, type BackendMode, type CliConfig } from "../lib/config.js";
import { backendUnreachable, userError } from "../lib/errors.js";
import { LocalBackend } from "./local.js";
import { RemoteBackend } from "./remote.js";
import type { Backend } from "./types.js";

export interface SelectorOptions {
  local?: boolean;
  remote?: boolean;
}

function resolveMode(opts: SelectorOptions, config: CliConfig): BackendMode {
  if (opts.local && opts.remote) {
    throw userError("Cannot use --local and --remote together.");
  }
  if (opts.local) return "local";
  if (opts.remote) return "remote";

  const envMode = process.env.OPENWHISPR_BACKEND;
  if (envMode === "auto" || envMode === "local" || envMode === "remote") return envMode;
  if (envMode !== undefined && envMode !== "") {
    throw userError(
      `Invalid OPENWHISPR_BACKEND value: ${envMode}. Expected auto, local, or remote.`
    );
  }

  return config.backend;
}

function resolveApiBase(config: CliConfig): string {
  return process.env.OPENWHISPR_API_BASE || config.apiBase;
}

async function buildLocal(): Promise<LocalBackend> {
  const bridge = await readBridgeFile();
  if (!bridge) {
    throw backendUnreachable(
      "Desktop app bridge not found. Start OpenWhispr or use --remote / `openwhispr auth login`."
    );
  }
  return new LocalBackend(bridge);
}

function buildRemote(config: CliConfig): RemoteBackend {
  return new RemoteBackend(resolveApiBase(config), config.apiKey);
}

export async function selectBackend(opts: SelectorOptions = {}): Promise<Backend> {
  const config = await readConfig();
  const mode = resolveMode(opts, config);

  if (mode === "local") return buildLocal();
  if (mode === "remote") return buildRemote(config);

  // auto: try local, then remote
  const bridge = await readBridgeFile();
  if (bridge) {
    const local = new LocalBackend(bridge);
    if (await local.ping()) return local;
  }

  if (config.apiKey) {
    return buildRemote(config);
  }

  throw backendUnreachable(
    "No backend available. Start the OpenWhispr desktop app, or run `openwhispr auth login` to configure remote access."
  );
}

export async function probeBackends(): Promise<{
  local: { configured: boolean; reachable: boolean; description: string; error?: string };
  remote: { configured: boolean; reachable: boolean; description: string; error?: string };
}> {
  const config = await readConfig();
  const apiBase = resolveApiBase(config);

  const localResult = {
    configured: false,
    reachable: false,
    description: "local desktop bridge",
    error: undefined as string | undefined,
  };
  const bridge = await readBridgeFile();
  if (bridge) {
    localResult.configured = true;
    localResult.description = `local desktop bridge (127.0.0.1:${bridge.port})`;
    const local = new LocalBackend(bridge);
    localResult.reachable = await local.ping();
    if (!localResult.reachable) {
      localResult.error = "Bridge file present but server is not responding.";
    }
  } else {
    localResult.error = "No ~/.openwhispr/cli-bridge.json found (desktop app not running?).";
  }

  const remoteResult = {
    configured: !!config.apiKey,
    reachable: false,
    description: `remote API (${apiBase})`,
    error: undefined as string | undefined,
  };
  if (config.apiKey) {
    const remote = new RemoteBackend(apiBase, config.apiKey);
    remoteResult.reachable = await remote.ping();
    if (!remoteResult.reachable) {
      remoteResult.error = "API unreachable or auth invalid.";
    }
  } else {
    remoteResult.error = "No API key configured. Run `openwhispr auth login`.";
  }

  return { local: localResult, remote: remoteResult };
}
