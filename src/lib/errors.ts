export const ExitCode = {
  Ok: 0,
  UserError: 1,
  BackendUnreachable: 2,
  AuthFailure: 3,
  NotFound: 4,
  SafetyGate: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class CliError extends Error {
  readonly exitCode: ExitCodeValue;

  constructor(exitCode: ExitCodeValue, message: string) {
    super(message);
    this.exitCode = exitCode;
    this.name = "CliError";
  }
}

export function userError(message: string): CliError {
  return new CliError(ExitCode.UserError, message);
}

export function backendUnreachable(message: string): CliError {
  return new CliError(ExitCode.BackendUnreachable, message);
}

export function authFailure(message: string): CliError {
  return new CliError(ExitCode.AuthFailure, message);
}

export function notFound(message: string): CliError {
  return new CliError(ExitCode.NotFound, message);
}
