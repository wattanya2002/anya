-- Calendar RCM v1.1 §4.4: every manual item has an editable short title for Month chips. Additive and nullable.
alter table calendar_events add column if not exists short_title text
  check (short_title is null or length(btrim(short_title)) between 1 and 24);
