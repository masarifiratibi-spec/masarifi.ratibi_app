"""Synthetic Docker inspect objects; never connects to an engine."""
from copy import deepcopy
import unittest

from runtime_plan import fingerprint, plan


def fixture():
    paths = ["/app/dist/src/security/security.service.js"] + [f"/app/module{i}.js" for i in range(28)]
    row = {"Id": "1" * 64, "Name": "/original", "Image": "sha256:" + "2" * 64,
           "State": {"Running": True, "StartedAt": "start"}, "RestartCount": 0,
           "Config": {"Hostname": "original", "Image": "old-tag", "User": "65532:65532",
                      "WorkingDir": "/app", "Entrypoint": ["/nodejs/bin/node"],
                      "Cmd": ["dist/src/main.js"], "Labels": {},
                      "Env": ["NODE_ENV=production", "MASARIFI_PROCESS_KIND=api",
                              "MASARIFI_RUNTIME_SCOPE=project-server", "MASARIFI_STORAGE_PROVIDER=filesystem",
                              "DATABASE_URL=postgresql://fixture:fake@project-db:5432/postgres"]},
           "HostConfig": {"ReadonlyRootfs": True, "Privileged": False, "CapDrop": ["ALL"],
                          "SecurityOpt": ["no-new-privileges"], "NetworkMode": "bridge",
                          "PortBindings": {"3000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "3033"}]},
                          "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
                          "Mounts": [{"Type": "bind", "Source": f"/base/{i}.js", "Target": p, "ReadOnly": True}
                                     for i, p in enumerate(paths)], "Binds": None},
           "Mounts": [{"Type": "bind", "Source": f"/base/{i}.js", "Destination": p, "RW": False}
                      for i, p in enumerate(paths)],
           "NetworkSettings": {"Networks": {"bridge": {"Aliases": ["original"], "IPAMConfig": None},
                                             "masarifi-selfhost-data": {"Aliases": ["original"], "IPAMConfig": None}}}}
    pins = dict(containerId=row["Id"], imageId=row["Image"], startedAt="start",
                configurationSha256=fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")]),
                name="original", command=["/nodejs/bin/node", "dist/src/main.js"])
    return row, pins


class PlanTests(unittest.TestCase):
    def test_preserves_runtime_repairs_and_secrets_without_alias_hijack(self):
        row, pins = fixture()
        before = deepcopy(row)
        body = plan(row, "api", pins)
        self.assertEqual(row, before)
        self.assertEqual(body["Env"], row["Config"]["Env"])
        self.assertEqual(body["Image"], row["Image"])
        self.assertEqual(body["HostConfig"]["RestartPolicy"]["Name"], "no")
        self.assertEqual(body["HostConfig"]["PortBindings"]["3000/tcp"][0],
                         {"HostIp": "127.0.0.1", "HostPort": "3091"})
        mounts = body["HostConfig"]["Mounts"]
        self.assertEqual(len(mounts), 30)
        self.assertEqual(mounts[1:29], row["HostConfig"]["Mounts"][1:])
        self.assertTrue(mounts[0]["Source"].endswith("/modules/security/security.service.js"))
        self.assertTrue(mounts[29]["Source"].endswith("/modules/security/security.repository.js"))
        endpoints = body["NetworkingConfig"]["EndpointsConfig"]
        self.assertEqual(endpoints["bridge"], {})
        self.assertNotIn("original", endpoints["masarifi-selfhost-data"]["Aliases"])

    def test_config_drift_is_rejected_before_planning(self):
        row, pins = fixture()
        row["Config"]["Env"].append("SECRET_CHANGED=fixture")
        with self.assertRaisesRegex(ValueError, "SOURCE_CONFIG_DRIFT"):
            plan(row, "api", pins)

    def test_worker_old_database_and_unsafe_process_are_rejected_even_if_rebound(self):
        for replacement in ("MASARIFI_PROCESS_KIND=worker", "SUPABASE_URL=https://fixture.supabase.co",
                            "DATABASE_URL=postgresql://fixture@fixture.supabase.co/postgres"):
            row, pins = fixture()
            key = replacement.split("=")[0]
            row["Config"]["Env"] = [v for v in row["Config"]["Env"] if not v.startswith(key + "=")] + [replacement]
            pins["configurationSha256"] = fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")])
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                plan(row, "api", pins)

    def test_unknown_or_writable_module_mount_cannot_be_silently_dropped(self):
        row, pins = fixture()
        row["Mounts"][1]["RW"] = True
        pins["configurationSha256"] = fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")])
        with self.assertRaisesRegex(ValueError, "API_MOUNTS"):
            plan(row, "api", pins)


if __name__ == "__main__":
    unittest.main()
