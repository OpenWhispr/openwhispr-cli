import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { userError } from "./errors.js";

const CONFIG_DIR = join(homedir(), ".openwhispr");
const CONFIG_PATH = join(CONFIG_DIR, "cli-config.json");
const BRIDGE_PATH = join(CONFIG_DIR, "cli-bridge.json");

const DEFAULT_API_BASE = "https://api.openwhispr.com";

export type BackendMode = "auto" | "local" | "remote";

export interface CliConfig {
  backend: BackendMode;
  apiBase: string;
  apiKey: string;
}

export interface BridgeFile {
  version: 1;
  port: number;
  token: string;
}

const DEFAULT_CONFIG: CliConfig = {
  backend: "auto",
  apiBase: DEFAULT_API_BASE,
  apiKey: "",
};

function isBackendMode(value: unknown): value is BackendMode {
  return value === "auto" || value === "local" || value === "remote";
}

function parseConfig(raw: unknown): CliConfig {
  if (raw === null || typeof raw !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  return {
    backend: isBackendMode(obj.backend) ? obj.backend : DEFAULT_CONFIG.backend,
    apiBase: typeof obj.apiBase === "string" && obj.apiBase ? obj.apiBase : DEFAULT_CONFIG.apiBase,
    apiKey: typeof obj.apiKey === "string" ? obj.apiKey : DEFAULT_CONFIG.apiKey,
  };
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const text = await fs.readFile(CONFIG_PATH, "utf8");
    return parseConfig(JSON.parse(text));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONFIG };
    }
    if (err instanceof SyntaxError) {
      throw userError(`Failed to parse ${CONFIG_PATH}: ${err.message}`);
    }
    throw err;
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const tmpPath = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  await fs.rename(tmpPath, CONFIG_PATH);
  if (process.platform !== "win32") {
    await fs.chmod(CONFIG_PATH, 0o600);
  }
}

export async function readBridgeFile(): Promise<BridgeFile | null> {
  try {
    const text = await fs.readFile(BRIDGE_PATH, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) return null;
    if (typeof obj.port !== "number" || typeof obj.token !== "string") return null;
    return { version: 1, port: obj.port, token: obj.token };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}
