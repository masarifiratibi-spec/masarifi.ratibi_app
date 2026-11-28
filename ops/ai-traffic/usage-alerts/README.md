# Production AI usage alerts

The 28 November release installed the Python observer, SQL query and mail helper in `/opt/masarifi/selfhost/releases/ai-usage-alerts-20261128/`. The systemd service and timer in this directory record the installed units. The timer checks usage every 30 seconds. It sends a notification for repeated usage above 25 chat or 15 voice events per minute under the windows in `breaches.sql`. SQLite state under `/var/lib/masarifi-ai-usage-alerts/` retains the cursor and notification history across runs.

The checked-in mail helper is a template. To reproduce the installed `alert-mail.cjs`, replace the entire quoted `'__MASARIFI_ALERT_RECIPIENT__'` literal with the private operator mailbox encoded as a JavaScript string. Keep the rendered file on the host. The observer reads this helper by name. SMTP settings come from the existing mail container. Keep the installed state directory when replacing code to retain pending notifications and deduplication.
