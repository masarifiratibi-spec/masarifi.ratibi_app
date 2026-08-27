insert into storage.buckets (id, name, public)
values
  ('support-attachments', 'support-attachments', false),
  ('report-exports', 'report-exports', false),
  ('voice-temp', 'voice-temp', false)
on conflict (id) do update
set public = false;

revoke all on storage.objects from anon, authenticated;
