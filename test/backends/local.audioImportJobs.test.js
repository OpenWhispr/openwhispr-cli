import test from "node:test";
import assert from "node:assert/strict";
import { LocalBackend } from "../../dist/backends/local.js";

function makeBackend() {
  return new LocalBackend({ version: 1, port: 8213, token: "test-token" });
}

function stubFetch(t, handler) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return handler(new URL(url), init);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  return calls;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("submitAudioImportJob POSTs the absolute path and unwraps the job envelope", async (t) => {
  const calls = stubFetch(t, () =>
    jsonResponse(202, {
      data: { job_id: "job-1", status: "queued", stage: "queued", progress: 0 },
    })
  );

  const backend = makeBackend();
  const job = await backend.submitAudioImportJob("/Users/erik/audio.wav");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url.pathname, "/v1/audio-import-jobs");
  assert.equal(calls[0].url.origin, "http://127.0.0.1:8213");
  assert.deepEqual(JSON.parse(calls[0].init.body), { path: "/Users/erik/audio.wav" });
  assert.ok(String(calls[0].init.headers.Authorization).includes("test-token"));
  assert.deepEqual(job, { job_id: "job-1", status: "queued", stage: "queued", progress: 0 });
});

test("getAudioImportJob GETs the job by id", async (t) => {
  stubFetch(t, (url) => {
    assert.equal(url.pathname, "/v1/audio-import-jobs/job-1");
    return jsonResponse(200, {
      data: {
        job_id: "job-1",
        status: "completed",
        stage: "completed",
        progress: 100,
        result: { note_id: "note-1", title: "audio", text: "hello world" },
      },
    });
  });

  const backend = makeBackend();
  const job = await backend.getAudioImportJob("job-1");
  assert.equal(job.status, "completed");
  assert.equal(job.result.note_id, "note-1");
});

test("getAudioImportJob surfaces a 404 as a not-found CliError", async (t) => {
  stubFetch(t, () => jsonResponse(404, { error: { code: "not_found", message: "not found" } }));

  const backend = makeBackend();
  await assert.rejects(() => backend.getAudioImportJob("missing"), (err) => {
    assert.equal(err.exitCode, 4);
    return true;
  });
});

test("cancelAudioImportJob DELETEs the job by id and unwraps the cancellation result", async (t) => {
  stubFetch(t, (url, init) => {
    assert.equal(init.method, "DELETE");
    assert.equal(url.pathname, "/v1/audio-import-jobs/job-1");
    return jsonResponse(200, {
      data: {
        job: { job_id: "job-1", status: "cancelled", stage: "cancelled", progress: 0 },
        cancelled: true,
      },
    });
  });

  const backend = makeBackend();
  const result = await backend.cancelAudioImportJob("job-1");
  assert.equal(result.cancelled, true);
  assert.equal(result.job.status, "cancelled");
});
