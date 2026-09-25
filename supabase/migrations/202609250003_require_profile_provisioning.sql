-- Auth identities receive application access only after an administrator
-- explicitly provisions a profile. This keeps accidental hosted signup from
-- granting the adviser role.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_profile_for_auth_user();

comment on table public.profiles is
  'Application access list. Rows are provisioned explicitly by an administrator.';
