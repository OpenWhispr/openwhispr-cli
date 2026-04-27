import { Command } from "commander";
import { selectBackend } from "../../backends/selector.js";
import { userError } from "../../lib/errors.js";
import { getGlobalSelectorOpts } from "../../lib/global-opts.js";
import { printJson } from "../../lib/output.js";

interface CreateOpts {
  name?: string;
  sortOrder?: string;
}

export function foldersCreateCommand(): Command {
  return new Command("create")
    .description("Create a new folder")
    .requiredOption("--name <name>", "Folder name")
    .option("--sort-order <n>", "Sort order")
    .action(async (opts: CreateOpts, cmd: Command) => {
      let sortOrder: number | undefined;
      if (opts.sortOrder !== undefined) {
        sortOrder = Number(opts.sortOrder);
        if (!Number.isFinite(sortOrder)) {
          throw userError("--sort-order must be a number.");
        }
      }
      const backend = await selectBackend(getGlobalSelectorOpts(cmd));
      const folder = await backend.createFolder({ name: opts.name as string, sortOrder });
      printJson(folder);
    });
}
