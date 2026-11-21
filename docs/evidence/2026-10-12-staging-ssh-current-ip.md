# Staging SSH address-change evidence

The exact approved conditional first-launch scope `66a65c1a` was consumed once on
12 October 2026 and failed STAGING_PREFLIGHT. Its retained result records zero
device commands, installations, instrumentation, launches or screenshots. An
independent result audit verifies truthful failure handling and no unsupported
restoration/admission claims. The previously installed client `23a565` and retained
Voice data were not accessed or changed by this attempt. No device retry is
authorized by that consumed approval.

The separate read-only verifier check returned SSH exit 255 / SSH_CONNECTION_TIMEOUT.
Current public IPv4 was observed twice as `109.82.95.144`. Staging HTTPS, GitHub
IPv4, alternative Cloudflare/Google IPv4 and Cloudflare IPv6 were reachable;
these observations do not support a general IPv4 outage. No network setting was
changed.

Computer Use opened the existing Hostinger Staging overview for VPS 2006836 and
its web console. The console is on `srv2006836` and shows active UFW. Its previous
approved TCP 22 rule remains limited to `77.232.122.227`; no `109.82.95.144` rule
exists. A filtered read-only kernel journal query shows UFW BLOCK for TCP SYN
packets from `109.82.95.144` to `187.77.81.97`, destination port 22. This identifies
the rejected SSH source-address condition directly, rather than inferring it
from a timeout alone. No firewall/security mutation was performed.

Prepared firewall scope `b502ea29774ddad019868457921a4cda43ca732609e670e2ad2551f011c475c8`
allows exactly one source `109.82.95.144/32` TCP 22 rule, preserving other rules and
SSH key authentication. It requires new explicit security-change approval and
fresh exact-address/host/rule preconditions before one command, then rule and
strict-host-identity/read-only posting-OFF verification. No Production change,
deployment or device operation is included in that firewall scope.

Prepared renewed device scope `5f1b7278e0a6ccee9edcc020ebd4f8e1047404dd309bf8396c8f1b80e67661d3`
copies the four previously qualified controller files bytewise unchanged,
preserves the old failed directory and adds the zero-device result plus SSH
recovery evidence to 44 pins. It independently requires exact approval and a
successful fresh external Staging read-only check before execution. The same
conditional admission, legacy Voice preservation, bounded launch/PNG, postchecks
and cleanup limits apply. No financial activation, deployment or protected merge
is authorized by preparation.

Retained directories:

- `E:/Masarifi-staging-acceptance-2026-10-12/preservation-first-launch-preparation/`
- `E:/Masarifi-staging-acceptance-2026-10-12/ssh-current-ip-recovery/`
- `E:/Masarifi-staging-acceptance-2026-10-12/preservation-first-launch-after-ip-recovery/`

Independent final reviews of both packets passed. The firewall review is retained
as `ssh-current-ip-recovery/INDEPENDENT-REVIEW.md` (SHA256
`3dbd2ce4ce01c725c11a97b3b45b0ef17ec2fb6e912092699d05773e672e9bac`);
the renewed device review is retained as
`preservation-first-launch-after-ip-recovery/FINAL-PACKET-REVIEW.md` (SHA256
`89ce45f81c6c6eef4c50ca8754bd10d6d0b2b301d60850fd4fd2af513ec8b403`).
Review grants no operational authority. Both new exact human approvals remain
required. Fresh successful read-only Staging verification is an operator dispatch
prerequisite before invoking the unchanged device controller; the controller
also repeats its own preflight. No new device observations or full client
acceptance are established by these read-only transport findings.

Subsequent execution: the user separately approved both exact scopes. The one
firewall command added the current source rule, preserving the previous 18 rules
and active state. Strict pinned SSH and fresh external read-only Staging
verification passed before device approval was recorded. The candidate remained
healthy, posting OFF, and the financial/historical baseline unchanged.
`ssh-current-ip-recovery/RESULT-INDEPENDENT-REVIEW.md` independently passed the
narrow recovery audit (SHA256
`f2e9322a846d0bf87e6afd3914cab84cc01de37c910947d509767ba0c5464e65`).

The renewed conditional Redmi attempt then ran once and stopped at PRE_ADMISSION:
both JS/native contexts are PRESENT, so no MainActivity launch occurred. The
complete pre-admission private Voice receipt matches the f2 baseline after only
the approved diagnostic-hash substitution; package enabled/stopped states were
verified restored. No final private snapshot was collected. Independent truthful
failure review passed, retained in
`preservation-first-launch-after-ip-recovery/RESULT-INDEPENDENT-REVIEW.md` (SHA256
`40ecd3a40f71338706e386ba21f14d23353fd9bcfd482347314d3bebb05a4e5a`).
Both approvals are consumed and authorize no retry.

Repository publication note: evidence commit `a0cfc9fa` was initially pushed to
the older `origin` remote, creating the same feature branch there. It was then
pushed to the intended `ratibi` remote and its exact remote head verified.
No protected branch was changed. Duplicate disposable CI on `origin` was
cancelled where still running; one inert preparation job had already succeeded
and two jobs were skipped. No deployment workflow ran. The extra feature branch
was retained rather than deleted. The intended repository's posting-boundary
run `38249480236` passed for this documentation commit.
