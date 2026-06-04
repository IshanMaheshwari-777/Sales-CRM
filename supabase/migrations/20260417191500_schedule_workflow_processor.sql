/*
  # Schedule Workflow Processor

  Uses pg_cron + pg_net to invoke the workflow-processor Edge Function every minute.
  This follows Supabase's documented scheduling pattern for Edge Functions.
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'workflow-processor-every-minute'
  ) THEN
    PERFORM cron.unschedule('workflow-processor-every-minute');
  END IF;
END
$$;

SELECT cron.schedule(
  'workflow-processor-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hhbdhvuzjpegcglreukz.supabase.co/functions/v1/workflow-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYmRodnV6anBlZ2NnbHJldWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODY4MzQsImV4cCI6MjA5MDQ2MjgzNH0.MJQBW4bildOAq5vJ-8Jpho0MkMky84s-CHuqxsTNi0Q'
    ),
    body := '{"mode":"run"}'::jsonb,
    timeout_milliseconds := 5000
  ) AS request_id;
  $$
);
