-- Copy households.fridge_locations names that are missing from fridge_locations.
-- Preserves list order after any rows already in the table. The households
-- column stays until Phase 8.

insert into public.fridge_locations (household_id, name, sort_order)
select
    h.id,
    trim(loc.name),
    coalesce(
        (
            select max(fl.sort_order)
            from public.fridge_locations fl
            where fl.household_id = h.id
        ),
        -1
    ) + loc.ord
from public.households h
cross join lateral unnest(coalesce(h.fridge_locations, '{}'::text[]))
    with ordinality as loc(name, ord)
where trim(loc.name) <> ''
    and not exists (
        select 1
        from public.fridge_locations fl
        where fl.household_id = h.id
            and fl.name = trim(loc.name)
    );
