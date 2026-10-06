"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const g = require("./controls.cjs");
const execute = promisify(execFile);
const files = ["controls.cjs", "db.cjs", "host.cjs", "financial-api.yml"];
function bundleHash(dir = __dirname) {
  return g.hash(
    files
      .map((n) => n + ":" + g.hash(fs.readFileSync(dir + "/" + n)))
      .join("\n"),
  );
}
async function main(mode = process.argv[2]) {
  const p = JSON.parse(fs.readFileSync(__dirname + "/packet.json", "utf8"));
  g.validatePacket(p);
  const release = "/opt/masarifi/releases/" + p.sourceSha,
    image =
      "ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:" + p.imageDigest;
  const scope = "voice-epoch-" + p.sourceSha + "-" + p.attemptId,
    name = "masarifi-" + scope,
    service = name + "-deadline";
  const compose = [
    "compose",
    "--env-file",
    "/etc/masarifi/compose.env",
    ...[
      "compose.backend.yml",
      "release-version.yml",
      "voice-runtime.yml",
      "voice-analysis.yml",
    ].flatMap((n) => ["-f", release + "/docker/staging/" + n]),
  ];
  const run = async (cmd, args, timeout = 60000) =>
    (
      await execute(cmd, args, {
        timeout,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          MASARIFI_BACKEND_REPOSITORY:
            "ghcr.io/masarifiratibi-spec/masarifi-backend",
          MASARIFI_BACKEND_DIGEST: p.imageDigest,
        },
      })
    ).stdout.trim();
  const target = async () => {
    assert.equal(process.platform, "linux");
    assert.equal(process.getuid(), 0);
    assert.equal(fs.realpathSync(__dirname), g.controlDirectory(p));
  };
  const pins = async () => {
    await target();
    assert.equal(fs.realpathSync("/opt/masarifi/current"), release);
    assert.equal(bundleHash(), p.controlHash, "CONTROL_BUNDLE_CHANGED");
    for (const [n, h] of Object.entries(p.envHashes))
      assert.equal(
        g.hash(fs.readFileSync("/etc/masarifi/" + n)),
        h,
        "ENV_CHANGED",
      );
  };
  const inspect = async (n) => {
    const c = JSON.parse(await run("docker", ["inspect", n]));
    assert.equal(c.length, 1);
    return c[0];
  };
  const stopService = async (n, s) => {
    const c = await inspect(n);
    assert.equal(
      c.Config.Labels["com.docker.compose.project"],
      "masarifi-staging",
    );
    assert.equal(c.Config.Labels["com.docker.compose.service"], s);
    assert.equal(c.HostConfig.NetworkMode, "masarifi-staging_backend");
    await run("docker", ["stop", "--time", "5", n], 20000);
  };
  const stopScoped = async () => {
    const ids = (
      await run("docker", [
        "ps",
        "-q",
        "--filter",
        "label=org.masarifi.scope=" + scope,
      ])
    )
      .split("\n")
      .filter(Boolean);
    for (const id of ids) {
      const c = await inspect(id);
      assert.equal(c.Config.Labels["org.masarifi.scope"], scope);
      assert.equal(c.HostConfig.NetworkMode, "masarifi-staging_backend");
      await run("docker", ["stop", "--time", "5", id], 20000);
    }
  };
  const db = async (action) => {
    // Closure checks only its own immutable credentials and executable pins, not mutable API pins.
    assert.equal(
      g.hash(fs.readFileSync("/etc/masarifi/migration.env")),
      p.envHashes["migration.env"],
    );
    assert.equal(bundleHash(), p.controlHash);
    g.makeControlsReadable(__dirname, [
      "packet.json",
      ...(action === "prepare" || action === "baseline" ? [] : ["epoch.json"]),
      ...(action === "activate" ? ["approval.json"] : []),
    ]);
    const args = [
      "run",
      "--rm",
      "--network",
      "masarifi-staging_backend",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit",
      "128",
      "--memory",
      "512m",
      "--cpus",
      "1",
      "--env-file",
      "/etc/masarifi/migration.env",
      "-e",
      "MASARIFI_PROCESS_KIND=migration",
      "-e",
      "MASARIFI_RELEASE_VERSION=" + p.sourceSha,
      "-v",
      "/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro",
      "-v",
      __dirname + ":/control:ro",
      image,
      "/control/db.cjs",
      action,
      "/control",
    ];
    return JSON.parse(await run("docker", args));
  };
  const health = async (analysis) => {
    const general = await inspect("masarifi-staging-worker-1");
    assert.equal(general.State.Running, false, "GENERAL_WORKER_RUNNING");
    const api = await inspect("masarifi-staging-api-1");
    assert.equal(api.Config.Image, image);
    assert.equal(api.State.Running, true);
    assert.equal(api.State.Health?.Status, "healthy");
    assert(api.Config.Env.includes("MASARIFI_VOICE_ANALYSIS_ONLY=" + analysis));
    const a = await inspect("masarifi-staging-analysis-worker-1");
    assert.equal(a.State.Running, analysis);
    const live = JSON.parse(
      await run("curl", [
        "--fail",
        "--silent",
        "--max-time",
        "10",
        "http://127.0.0.1:3000/health/live",
      ]),
    );
    const ready = JSON.parse(
      await run("curl", [
        "--fail",
        "--silent",
        "--max-time",
        "10",
        "http://127.0.0.1:3000/health/ready",
      ]),
    );
    assert.equal(live.version, p.sourceSha);
    assert(ready);
  };
  const waitHealth = async (analysis) => {
    for (let n = 0; n < 30; n++) {
      try {
        await health(analysis);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw Error("API_HEALTH_UNCONFIRMED");
  };
  const close = () =>
    g.cleanup({
      target,
      stopApi: () => stopService("masarifi-staging-api-1", "api"),
      stopScoped,
      stopGeneral: () => stopService("masarifi-staging-worker-1", "worker"),
      closeEpoch: () => db("close"),
      pins,
      restore: () =>
        run("docker", [
          ...compose,
          "up",
          "-d",
          "--no-deps",
          "api",
          "analysis-worker",
        ]),
      health: () => waitHealth(true),
    });
  if (mode === "cleanup" || mode === "rehearse") return close();
  await pins();
  if (mode === "baseline") {
    await health(true);
    return db("baseline");
  }
  if (mode === "prepare") {
    await health(true);
    const epoch = await db("prepare");
    fs.writeFileSync(__dirname + "/epoch.json", JSON.stringify(epoch), {
      flag: "wx",
      mode: 0o600,
    });
    g.makeControlsReadable(__dirname, ["epoch.json"]);
    return epoch;
  }
  if (mode === "status") {
    await health(true);
    return db("status");
  }
  const approved = () =>
    g.approve(
      p,
      JSON.parse(fs.readFileSync(__dirname + "/approval.json", "utf8")),
    );
  const watchdog = async () => {
    assert.equal(
      await run("systemctl", ["is-active", service + ".timer"]),
      "active",
    );
    assert(
      (
        await run("systemctl", [
          "show",
          service + ".service",
          "--property=ExecStart",
          "--value",
        ])
      ).includes(__dirname + "/host.cjs cleanup"),
    );
    assert.equal(
      await run("systemctl", [
        "show",
        service + ".service",
        "--property=Restart",
        "--value",
      ]),
      "on-failure",
    );
  };
  if (mode === "enable") {
    approved();
    await health(true);
    const epoch = JSON.parse(
      fs.readFileSync(__dirname + "/epoch.json", "utf8"),
    );
    assert.equal((await db("status")).state, "prepared");
    const when =
      new Date(p.deadline).toISOString().replace("T", " ").slice(0, 19) +
      " UTC";
    const unit = `[Unit]\nAfter=docker.service network-online.target\n[Service]\nType=oneshot\nUser=root\nExecStart=/usr/bin/node ${__dirname}/host.cjs cleanup\nRestart=on-failure\nRestartSec=5\nTimeoutStartSec=120\n`;
    const timer = `[Timer]\nOnCalendar=${when}\nAccuracySec=1s\nPersistent=true\nUnit=${service}.service\n[Install]\nWantedBy=timers.target\n`;
    const supervisor = `[Unit]\nAfter=docker.service network-online.target\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/node ${__dirname}/host.cjs supervise\nRestart=on-failure\nRestartSec=2\n`;
    for (const [n, body] of [
      [service + ".service", unit],
      [service + ".timer", timer],
      [name + "-supervisor.service", supervisor],
    ])
      fs.writeFileSync("/etc/systemd/system/" + n, body, {
        flag: "wx",
        mode: 0o600,
      });
    await run("systemd-analyze", [
      "verify",
      ...[".service", ".timer"].map(
        (s) => "/etc/systemd/system/" + service + s,
      ),
      "/etc/systemd/system/" + name + "-supervisor.service",
    ]);
    await run("systemctl", ["daemon-reload"]);
    await run("systemctl", ["enable", "--now", service + ".timer"]);
    await watchdog();
    try {
      await run("docker", [...compose, "stop", "analysis-worker"]);
      await run("docker", [
        ...compose,
        "-f",
        __dirname + "/financial-api.yml",
        "up",
        "-d",
        "--no-deps",
        "api",
      ]);
      await waitHealth(false);
      approved();
      await watchdog();
      await db("activate");
      await run("docker", [
        "run",
        "--detach",
        "--name",
        name,
        "--network",
        "masarifi-staging_backend",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit",
        "128",
        "--memory",
        "512m",
        "--cpus",
        "1",
        "--restart",
        "unless-stopped",
        "--label",
        "org.masarifi.scope=" + scope,
        "--env-file",
        "/etc/masarifi/worker.env",
        "-e",
        "MASARIFI_PROCESS_KIND=worker",
        "-e",
        "MASARIFI_RELEASE_VERSION=" + p.sourceSha,
        "-e",
        "MASARIFI_VOICE_ANALYSIS_ONLY=false",
        "-e",
        "MASARIFI_AI_PROVIDER_ENABLED=true",
        "-e",
        "MASARIFI_AI_WORKER_POLL_MS=500",
        "-e",
        "MASARIFI_AI_JOB_BATCH_SIZE=1",
        "-e",
        "MASARIFI_AI_MAX_CONCURRENCY=1",
        "-e",
        "MASARIFI_AI_LEASE_SECONDS=120",
        "-e",
        "MASARIFI_STAGING_VOICE_EPOCH_ID=" + epoch.epochId,
        "--no-healthcheck",
        "-v",
        "/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro",
        image,
        "dist/src/staging-voice-worker.js",
      ]);
      await run("systemctl", ["start", name + "-supervisor.service"]);
      return { epoch: epoch.epochId, deadline: p.deadline };
    } catch (e) {
      await run("systemctl", [
        "start",
        "--no-block",
        service + ".service",
      ]).catch(() => undefined);
      await close().catch(() => undefined);
      throw e;
    }
  }
  if (mode === "supervise") {
    // No approval revalidation here: expiration must close, even after the approving CLI exits.
    const started = Date.now();
    while (true) {
      try {
        const state = await db("status");
        if (
          Date.now() >= Date.parse(p.deadline) ||
          state.state !== "active" ||
          !state.posting ||
          state.failed ||
          state.committed >= 2
        ) {
          return close();
        }
        const runtime = await inspect(name);
        if (!runtime.State.Running) return close();
        if (Date.now() - started > 10000)
          await run(
            "docker",
            [
              "exec",
              name,
              "/nodejs/bin/node",
              "dist/src/staging-voice-healthcheck.js",
            ],
            5000,
          );
        if (!state.heartbeat_at && Date.now() - started > 20000) return close();
        if (
          state.heartbeat_at &&
          Date.now() - Date.parse(state.heartbeat_at) > 20000
        )
          return close();
      } catch (e) {
        await run("systemctl", [
          "start",
          "--no-block",
          service + ".service",
        ]).catch(() => undefined);
        await close().catch(() => undefined);
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw Error("UNKNOWN_HOST_MODE");
}
module.exports = { main, bundleHash };
if (require.main === module)
  main()
    .then((r) => console.log(JSON.stringify(r)))
    .catch(() => {
      console.error("VOICE_HOST_CONTROL_FAILED");
      process.exitCode = 1;
    });
