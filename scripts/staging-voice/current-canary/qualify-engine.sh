#!/usr/bin/env bash
set -euo pipefail
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_REPOSITORY" == masarifiratibi-spec/masarifi.ratibi_app ]]
[[ "$(hostname)" != srv2006836 && "$EUID" == 0 ]]
[[ -z "$(docker ps -aq)" ]]
task_dir=$(mktemp -d "$RUNNER_TEMP/docker-29.8.1-XXXXXX")
curl --fail --silent --show-error --location --max-time 90 https://download.docker.com/linux/static/stable/x86_64/docker-29.8.1.tgz -o "$task_dir/engine.tgz"
sha256sum "$task_dir/engine.tgz" > "$RUNNER_TEMP/docker-engine-archive.sha256"
tar -xzf "$task_dir/engine.tgz" -C "$task_dir"
"$task_dir/docker/dockerd" --version | tee "$RUNNER_TEMP/docker-engine-version.txt"
[[ "$("$task_dir/docker/dockerd" --version)" == 'Docker version 29.8.1, build 464cd50' ]]
systemctl stop docker.service docker.socket
export PATH="$task_dir/docker:$PATH"
echo '{}' > "$task_dir/config.json"
dockerd --config-file "$task_dir/config.json" --data-root "$task_dir/data" --exec-root "$task_dir/exec" --pidfile "$task_dir/daemon.pid" --host unix:///var/run/docker.sock > "$RUNNER_TEMP/docker-exact-daemon.log" 2>&1 &
daemon_pid=$!
cleanup() { kill "$daemon_pid" 2>/dev/null || true; wait "$daemon_pid" 2>/dev/null || true; }
trap cleanup EXIT
ready=false
for attempt in $(seq 1 60); do
  if docker version --format '{{.Server.Version}}' > "$task_dir/version" 2>/dev/null && [[ "$(cat "$task_dir/version")" == 29.8.1 ]]; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]]
python3 scripts/staging-voice/current-canary/qualify-worker-create.py
