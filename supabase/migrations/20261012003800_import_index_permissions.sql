-- The immutable expression used by the customer index also runs for privileged
-- server jobs and fixture writes. It reads no tables and exposes no data.
grant execute on function app.import_key(text) to service_role;
