import { Command } from "commander";
import { readConfig, writeConfig } from "../../lib/config.js";
import { printText } from "../../lib/output.js";

export function authLogoutCommand(): Command {
  return new Command("logout").description("Remove the stored API key").action(async () => {
    const config = await readConfig();
    if (!config.apiKey) {
      printText("No API key was configured.");
      return;
    }
    await writeConfig({ ...config, apiKey: "" });
    printText("Removed API key from ~/.openwhispr/cli-config.json.");
  });
}
