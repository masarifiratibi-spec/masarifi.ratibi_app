\set ON_ERROR_STOP on

delete from private.outbox_events
where (aggregate_type = 'fixture' and event_type = 'fixture.created')
   or (aggregate_type = 'spec_be_001' and event_type = 'spec_be_001.integration');
