import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { readConfig, writeConfig } from "../../lib/config.js";
import { userError } from "../../lib/errors.js";
import { printText } from "../../lib/output.js";

interface LoginOpts {
  apiKey?: string;
}

async function readKeyFromStdin(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  process.stderr.write("API key: ");
  const line = await rl.question("");
  rl.close();
  return line.trim();
}

export function authLoginCommand(): Command {
  return new Command("login")
    .description("Configure an OpenWhispr API key for remote access")
    .option("--api-key <key>", "API key (otherwise read from stdin)")
    .action(async (opts: LoginOpts) => {
      const key = opts.apiKey?.trim() ?? (await readKeyFromStdin());
      if (!key) throw userError("No API key provided.");
      const config = await readConfig();
      await writeConfig({ ...config, apiKey: key });
      printText("Saved API key to ~/.openwhispr/cli-config.json.");
    });
}
