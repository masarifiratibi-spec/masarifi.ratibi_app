import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

import api_archive as check


def synthetic(path,*,worker=False,substitute=False,extra_tag=False):
    sha=lambda b:hashlib.sha256(b).hexdigest()
    js=lambda x:json.dumps(x).encode()
    commit="c"*40
    layer=b"synthetic nonexecuted filesystem layer"
    blob=gzip.compress(layer,mtime=0)
    config=js({"os":"linux","architecture":"amd64","config":{"User":"65532:65532","WorkingDir":"/app",
        "Entrypoint":["/nodejs/bin/node"],"Cmd":["dist/src/worker.js" if worker else "dist/src/main.js"],
        "Labels":{"org.opencontainers.image.revision":commit}},
        "rootfs":{"type":"layers","diff_ids":["sha256:"+sha(b"different" if substitute else layer)]}})
    leaf=js({"schemaVersion":2,"config":{"digest":"sha256:"+sha(config)},"layers":[{"digest":"sha256:"+sha(blob)}]})
    index=js({"schemaVersion":2,"manifests":[{"digest":"sha256:"+sha(leaf),"annotations":
        {"io.containerd.image.name":"docker.io/library/"+("foreign" if extra_tag else "masarifi-backend")+":"+commit}}]})
    entry=lambda b:"blobs/sha256/"+sha(b)
    docker=js([{"RepoTags":["masarifi-backend:"+commit],"Config":entry(config),"Layers":[entry(blob)]}])
    tar=io.BytesIO()
    with tarfile.open(fileobj=tar,mode="w:gz") as t:
        for name,data in [("index.json",index),("manifest.json",docker),(entry(config),config),(entry(blob),blob),(entry(leaf),leaf)]:
            m=tarfile.TarInfo(name);m.size=len(data);t.addfile(m,io.BytesIO(data))
    data=tar.getvalue()
    meta={"sourceCommit":commit,"imageId":"sha256:"+sha(config),"archiveSha256":sha(data),
          "archiveBytes":len(data),"format":"docker-save-gzip","hostedActivationPerformed":False}
    with zipfile.ZipFile(path,"w") as z:
        for name,body in ((check.ID,meta["imageId"]+"\n"),(check.META,js(meta)),(check.TAR,data)):
            z.writestr(name,body)
    return path,sha(path.read_bytes()),path.stat().st_size,commit


class Archive(unittest.TestCase):
    def test_verified_gzip_and_both_manifest_bindings(self):
        with tempfile.TemporaryDirectory() as tmp:
            args=synthetic(Path(tmp)/"api.zip")
            self.assertEqual(check.verify(*args)["layers"],1)
            with self.assertRaisesRegex(ValueError,"ZIP_DIGEST_DRIFT"):
                check.verify(args[0],"f"*64,*args[2:])

    def test_rehashed_bad_runtime_layer_and_tags_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            for option,reason in [("worker","IMAGE_RUNTIME_DRIFT"),("substitute","LAYER_PIN_DRIFT"),("extra_tag","UNREVIEWED_OCI_TAG")]:
                with self.subTest(option=option),self.assertRaisesRegex(ValueError,reason):
                    check.verify(*synthetic(Path(tmp)/"api.zip",**{option:True}))


if __name__=="__main__":
    unittest.main()
