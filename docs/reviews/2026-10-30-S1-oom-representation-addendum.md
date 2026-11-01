# S1 Docker representation addendum — approval pending

The first approved S1 handover rejected its replacement API before either candidate started. Docker 29.8.1 represented `HostConfig.OomKillDisable` as `false`; the original containers and approved raw hashes contain `null`. The strict guard rejected that difference and restored both original services in 28.789 seconds. Original names, images and full Config/HostConfig match; both are healthy, all 36 services are running, and the other 34 services are unchanged. No PDF or ZIP consumer window started.

This addendum requests only the observed **`HostConfig.OomKillDisable: null → false`** for the two existing S1 targets. `false` keeps Docker's default OOM killer enabled. It does not disable memory protection. [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/).

The [original S1 review](2026-10-30-S1-consolidated-staging-approval.md) requires: “refuse any unreviewed default/merge difference.” Its immutable packet and actual human approval remain preserved. This separate addendum is required because the inspected raw HostConfig/runtime hashes differ from those originally approved.

| Binding | SHA-256 |
| --- | --- |
| Original S1 packet, unchanged | `189dc3798d51877475f32ceebb96e48b9353cb7e95b0ec7ae65e4c3722551a7b` |
| Original v2 proposal, unchanged | `ff6680fe32b7e1d44968c433f12cc284f7b5701e958a848677be867f32764557` |
| This machine addendum | `c16c1d1736d9c71c4b470d81b73943cfe299a4c8df5b05748fcb96b4dd82d12c` |
| Effective proposal with the one field difference | `f58e39e92ccc7d5f003085111c88d1aa5db379d111715b2e05e8353fdd87e500` |
| Post-rollback baseline | `d9cf4b6e6302b83c55a323e428a772eb2b0bbbfe516fcc27c0e020377c129593` |
| Two prepared, never-started candidates | `a2e233e1651fda01b6d6b6b4ca2e35eccc5834eb5a945258218f1f5ccea8f30a` |

| Existing target | New raw HostConfig SHA | New raw Config + HostConfig SHA |
| --- | --- | --- |
| API | `1f9164a0d342cfff3e73a6d4506aa27a0caf3cf14a9929300427f059e98ffea7` | `c9998d9a305ac5391c0b013c8d6caa0647e0ad7574d024b225620dfbaf2476f5` |
| Assistant | `bf5847d752cb6773cf487479ed2c7933cae212c8a063d52988776b48d5a1b09b` | `1f60ad5d84ee9e6e5a0cd9944a523fb8c651d95255b67c2cfa7988eda54c7d9a` |

API image remains `sha256:137aeb426ade43b9d45af4c8bd24fd8e9bbc8d3104f58f0f3fad3a0f66e68fd6`; Assistant image remains `sha256:90f18ac87a1adbf18ba3602edfc764a6384cac77e7b6773e183610f005d82f7a`. Config, credentials, resource/security limits, commands, users, ports, mounts, network and aliases retain the original approved effective values. The baseline changes only the two original services' start times caused by the verified rollback. Original baseline files remain untouched.

The prepared execution uses a new directory and journal, checks both candidates are still never started and exactly match the new full hashes, then reuses those candidates. It cannot create another replacement or admit `true` or another HostConfig change. Missing actual human addendum approval rejects before Docker writes. The original API pause, fresh all-owner zero queue check, assistant-first health verification, 120-second bound, watchdog and rollback remain enforced. The failed attempt journal cannot be replayed.

The original PDF maximum six first attempts and exact-new ZIP maximum one request remain unchanged, in separate fresh ten-minute windows after successful runtime/client gates. No renewal, retry, restart, resume, worker-scope expansion, migration, financial mutation, new credential or access change is requested. Private authentication and sensitive destination selection retain the original human steps. The `2026-13` draft, financial data, current APK and Metro remain preserved. T20–T22 remain excluded.

Qualification: eight focused synthetic addendum tests pass locally and on the target Linux host. The read-only server preflight passes with all 36 original services, both never-started candidates, exact packages/network/mounts/configuration, 2,083 MiB available memory and 17.84 GiB Docker storage. Operational code, journals, receipts and screenshots remain private. This document is a review request, not an approval or claim that S1 or T19a is complete.
