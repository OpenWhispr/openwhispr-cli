#!/usr/bin/env node
import { Command } from "commander";
import { CliError, ExitCode } from "./lib/errors.js";
import { notesListCommand } from "./commands/notes/list.js";
import { notesGetCommand } from "./commands/notes/get.js";
import { notesCreateCommand } from "./commands/notes/create.js";
import { notesUpdateCommand } from "./commands/notes/update.js";
import { notesDeleteCommand } from "./commands/notes/delete.js";
import { notesSearchCommand } from "./commands/notes/search.js";
import { foldersListCommand } from "./commands/folders/list.js";
import { foldersCreateCommand } from "./commands/folders/create.js";
import { transcriptionsListCommand } from "./commands/transcriptions/list.js";
import { transcriptionsGetCommand } from "./commands/transcriptions/get.js";
import { transcriptionsDeleteCommand } from "./commands/transcriptions/delete.js";
import { audioDeleteCommand } from "./commands/audio/delete.js";
import { authLoginCommand } from "./commands/auth/login.js";
import { authLogoutCommand } from "./commands/auth/logout.js";
import { authStatusCommand } from "./commands/auth/status.js";
import { configGetCommand } from "./commands/config/get.js";
import { configSetCommand } from "./commands/config/set.js";
import { doctorCommand } from "./commands/doctor.js";
import { getCliVersion, versionCommand } from "./commands/version.js";

function buildProgram(): Command {
  const program = new Command();
  program
    .name("openwhispr")
    .description("OpenWhispr CLI — operate against the local desktop app or the cloud API")
    .version(getCliVersion(), "-V, --version", "Print the CLI version")
    .option("--local", "Force local desktop bridge backend")
    .option("--remote", "Force remote API backend");

  const notes = new Command("notes").description("Notes commands");
  notes.addCommand(notesListCommand());
  notes.addCommand(notesGetCommand());
  notes.addCommand(notesCreateCommand());
  notes.addCommand(notesUpdateCommand());
  notes.addCommand(notesDeleteCommand());
  notes.addCommand(notesSearchCommand());
  program.addCommand(notes);

  const folders = new Command("folders").description("Folder commands");
  folders.addCommand(foldersListCommand());
  folders.addCommand(foldersCreateCommand());
  program.addCommand(folders);

  const transcriptions = new Command("transcriptions").description("Transcription commands");
  transcriptions.addCommand(transcriptionsListCommand());
  transcriptions.addCommand(transcriptionsGetCommand());
  transcriptions.addCommand(transcriptionsDeleteCommand());
  program.addCommand(transcriptions);

  const audio = new Command("audio").description("Audio file commands");
  audio.addCommand(audioDeleteCommand());
  program.addCommand(audio);

  const auth = new Command("auth").description("Authentication commands");
  auth.addCommand(authLoginCommand());
  auth.addCommand(authLogoutCommand());
  auth.addCommand(authStatusCommand());
  program.addCommand(auth);

  const config = new Command("config").description("CLI configuration");
  config.addCommand(configGetCommand());
  config.addCommand(configSetCommand());
  program.addCommand(config);

  program.addCommand(doctorCommand());
  program.addCommand(versionCommand());

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CliError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(err.exitCode);
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(ExitCode.UserError);
  }
}

void main();
