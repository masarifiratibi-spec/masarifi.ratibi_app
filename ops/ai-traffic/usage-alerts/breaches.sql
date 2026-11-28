WITH ordered AS (
  SELECT user_id, workload, created_at,
    lag(created_at, CASE workload WHEN 'financial_assistant' THEN 25 ELSE 15 END)
      OVER (PARTITION BY user_id, workload ORDER BY created_at, id) AS prior
  FROM {source}
  WHERE workload IN ('financial_assistant','voice_transcription')
    AND created_at >= to_timestamp({start}) AND created_at <= to_timestamp({end})
), crossings AS (
  SELECT user_id, workload, created_at,
    count(*) OVER (PARTITION BY user_id, workload ORDER BY created_at
      RANGE BETWEEN INTERVAL '540 seconds' PRECEDING AND INTERVAL '60 seconds' PRECEDING) AS earlier
  FROM ordered WHERE prior > created_at - INTERVAL '60 seconds'
)
SELECT encode(sha256(convert_to(user_id::text,'UTF8')),'hex'), workload,
       floor(extract(epoch FROM min(created_at)))::bigint
FROM crossings WHERE earlier > 0 AND created_at >= to_timestamp({since})
GROUP BY user_id, workload
