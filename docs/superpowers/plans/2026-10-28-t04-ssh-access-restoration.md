# T04 SSH access restoration — exact approval request

Status: PREPARED, NOT APPLIED. Existing Hostinger VPS 2006836 / srv2006836 / IPv4 187.77.81.97. Sol/xhigh only. No VPS, OS, service, credential, key, database, worker or financial change is authorized by this document.

The original strict SSH connection still times out. The existing authenticated Hostinger hPanel session opened its official Web Console. After the user privately returned the console from an unrelated Codex login to the root shell, read-only diagnostics established: SSH service active; sshd listening on IPv4 and IPv6 port22; UFW active with deny incoming / allow outgoing / deny routed; 28 existing numbered rules. Hostinger's own firewall panel shows no configured firewall. Existing UFW rules permit earlier source IPs; rule26 permits 5.163.148.193 to187.77.81.97:22. No rule permits the current source51.39.31.206.

At15:57:57UTC /18:57:57Riyadh, both api.ipify.org and checkip.amazonaws.com independently returned51.39.31.206. UFW dry-run validated the exact command below with exit0/no stderr. No rule was changed. Dry-run output SHA-256: `b7c3cd2d4867478b1099ea6099340a5278cedfbb295501ada2e1a5b790ca95b5`.

Proposed single persistent rule, to execute once only after specific approval and a fresh source-IP/rule check:

```sh
ufw allow proto tcp from 51.39.31.206/32 to 187.77.81.97 port 22 comment 'Masarifi T04 approved source 2026-10-28'
```

This adds SSH access from exactly one IPv4 address to this VPS's port22. It preserves every existing rule and UFW's default policies; it does not open SSH to all sources, change credentials/host validation, reload/restart SSH or any application, or authorize R18 deployment. Persistent `/32` access follows the existing authorized access method. If the source IP changes, stop and obtain a new exact approval.

Record intent before applying; on an uncertain command result, read current rules rather than repeating. Afterward verify exactly one matching rule, existing-rule/default-policy preservation and the original strict `masarifi` SSH key/known-host connection. Do not delete old rules or weaken the firewall. A future removal requires its own authorization; do not silently broaden or clean up access.

Read-only R18 checks may continue over the official Web Console while this request is pending. Server access restoration never approves API/container/key binding, deployment or financial/settings actions. Preserve the held R18 packet and all completed evidence. Local approval screenshot: private `r18-cursor-api-artifact-prep/ssh-access-dry-run-2026-10-28.jpg`.
