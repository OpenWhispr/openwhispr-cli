import test from "node:test";
import assert from "node:assert/strict";
import { runTranscribe } from "../../dist/commands/transcribe.js";

// Node's own test reporter writes progress lines to the real stdout
// asynchronously (sometimes only flushed once a later test's capture window
// is already open), so a leaked reporter chunk can appear as a *prefix* in
// `chunks`. printJson/printText each write exactly one chunk synchronously,
// so callers should read `chunks.at(-1)` rather than joining everything.
async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  const chunks = [];
  process.stdout.write = (chunk) => {
    chunks.push(chunk);
    return true;
  };
  try {
    await fn();
    return chunks;
  } finally {
    process.stdout.write = original;
  }
}

function makeBackend({ submit, getJob }) {
  const calls = { submit: [], get: [] };
  return {
    calls,
    backend: {
      async submitTranscriptionJob(path) {
        calls.submit.push(path);
        return submit(path);
      },
      async getTranscriptionJob(jobId) {
        calls.get.push(jobId);
        return getJob(jobId, calls.get.length);
      },
    },
  };
}

test("without --wait, prints the queued job as JSON and does not poll", async () => {
  const { backend, calls } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: () => {
      throw new Error("should not poll without --wait");
    },
  });

  const out = await withCapturedStdout(() => runTranscribe(backend, "/abs/path.wav", { format: "text" }));

  assert.equal(calls.get.length, 0);
  assert.deepEqual(JSON.parse(out.at(-1)), {
    job_id: "job-1",
    status: "queued",
    stage: "queued",
    progress: 0,
  });
});

test("--wait polls until completed and prints the transcript in text format", async () => {
  const { backend } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: (jobId, pollCount) =>
      pollCount < 2
        ? { job_id: jobId, status: "transcribing", stage: "transcribing", progress: 50 }
        : {
            job_id: jobId,
            status: "completed",
            stage: "completed",
            progress: 100,
            result: { text: "hello world", diarized: false },
          },
  });

  const out = await withCapturedStdout(() =>
    runTranscribe(backend, "/abs/path.wav", { wait: true, format: "text" }, 1)
  );

  assert.equal(out.at(-1), "hello world\n");
});

test("--wait --format json prints the full completed job", async () => {
  const { backend } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: (jobId) => ({
      job_id: jobId,
      status: "completed",
      stage: "completed",
      progress: 100,
      result: { text: "hi" },
    }),
  });

  const out = await withCapturedStdout(() =>
    runTranscribe(backend, "/abs/path.wav", { wait: true, format: "json" }, 1)
  );
  const printed = JSON.parse(out.at(-1));
  assert.equal(printed.status, "completed");
  assert.equal(printed.result.text, "hi");
});

test("--wait surfaces a failed job as a thrown CliError with the job's error message", async () => {
  const { backend } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: (jobId) => ({
      job_id: jobId,
      status: "failed",
      stage: "failed",
      progress: 0,
      error: "model not downloaded",
    }),
  });

  await assert.rejects(
    () =>
      withCapturedStdout(() =>
        runTranscribe(backend, "/abs/path.wav", { wait: true, format: "text" }, 1)
      ),
    (err) => {
      assert.match(err.message, /model not downloaded/);
      return true;
    }
  );
});

test("--wait surfaces a cancelled job as a thrown CliError", async () => {
  const { backend } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: (jobId) => ({ job_id: jobId, status: "cancelled", stage: "cancelled", progress: 0 }),
  });

  await assert.rejects(
    () =>
      withCapturedStdout(() =>
        runTranscribe(backend, "/abs/path.wav", { wait: true, format: "text" }, 1)
      ),
    /cancelled/
  );
});

test("rejects an invalid --format value", async () => {
  const { backend } = makeBackend({
    submit: () => ({ job_id: "job-1", status: "queued", stage: "queued", progress: 0 }),
    getJob: () => {
      throw new Error("unreachable");
    },
  });

  await assert.rejects(() =>
    withCapturedStdout(() => runTranscribe(backend, "/abs/path.wav", { format: "yaml" }, 1))
  );
});
