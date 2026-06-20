-- =============================================================================
-- PG360 · 0013_room_type.sql — drop the legacy rooms.type check.
-- Room type now derives from the rate card, whose sharing types include quad +
-- dorm. The old constraint (single/double/triple only) rejected those, so
-- adding a "Four sharing" / "Dormitory" room failed. Type is free text now.
-- Idempotent.
-- =============================================================================

alter table public.rooms drop constraint if exists rooms_type_check;
