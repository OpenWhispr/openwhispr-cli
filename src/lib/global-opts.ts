import type { Command } from "commander";
import type { SelectorOptions } from "../backends/selector.js";

// Subcommands are nested two levels: program -> group -> leaf.
// The global --local/--remote flags live on the program (root), so walk up.
export function getGlobalSelectorOpts(cmd: Command): SelectorOptions {
  let node: Command | null | undefined = cmd;
  while (node?.parent) node = node.parent;
  return ((node?.opts() ?? {}) as SelectorOptions) ?? {};
}
