-- The reference catalogue is seeded by migration 202609250002 so both local and
-- hosted databases receive the same repeatable data. Auth users are provisioned
-- separately with `npm run seed:users` because passwords do not belong in SQL.
select 'Reference data is already present from migrations.' as seed_status;

