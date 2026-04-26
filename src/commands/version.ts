import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { printJson, printText, shouldPrintJson } from "../lib/output.js";

interface VersionOpts {
  format?: string;
}

interface PackageJsonShape {
  name?: string;
  version?: string;
}

function readPackageJson(): PackageJsonShape {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "..", "package.json");
  const text = readFileSync(pkgPath, "utf8");
  return JSON.parse(text) as PackageJsonShape;
}

export function versionCommand(): Command {
  return new Command("version")
    .description("Print CLI version")
    .option("--format <fmt>", "Output format: json|table")
    .action((opts: VersionOpts) => {
      const pkg = readPackageJson();
      const result = { name: pkg.name ?? "@openwhispr/cli", version: pkg.version ?? "0.0.0" };
      if (shouldPrintJson(opts.format)) {
        printJson(result);
      } else {
        printText(`${result.name} ${result.version}`);
      }
    });
}

export function getCliVersion(): string {
  return readPackageJson().version ?? "0.0.0";
}
