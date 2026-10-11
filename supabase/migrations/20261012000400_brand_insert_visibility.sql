-- INSERT ... RETURNING evaluates SELECT policies before a stable helper can
-- observe the newly inserted row. Internal access is checked without a lookup.
alter policy brands_read on public.brands using (app.is_internal() or app.has_brand_access(id));
