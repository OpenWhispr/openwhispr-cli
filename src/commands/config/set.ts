import { Command } from "commander";
import { readConfig, writeConfig } from "../../lib/config.js";
import { userError } from "../../lib/errors.js";
import { printText } from "../../lib/output.js";

const VALID_KEYS = ["backend", "api-base"] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

function isConfigKey(value: string): value is ConfigKey {
  return (VALID_KEYS as readonly string[]).includes(value);
}

export function configSetCommand(): Command {
  return new Command("set")
    .description("Set a config value")
    .argument("<key>", `One of: ${VALID_KEYS.join(", ")}`)
    .argument("<value>", "New value")
    .action(async (key: string, value: string) => {
      if (!isConfigKey(key)) {
        throw userError(`Unknown config key: ${key}. Valid keys: ${VALID_KEYS.join(", ")}.`);
      }
      const config = await readConfig();
      if (key === "backend") {
        if (value !== "auto" && value !== "local" && value !== "remote") {
          throw userError("backend must be auto, local, or remote.");
        }
        await writeConfig({ ...config, backend: value });
      } else {
        if (!/^https?:\/\//.test(value)) {
          throw userError("api-base must start with http:// or https://.");
        }
        await writeConfig({ ...config, apiBase: value });
      }
      printText(`Set ${key} = ${value}.`);
    });
}
