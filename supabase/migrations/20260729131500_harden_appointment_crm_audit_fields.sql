-- Preserve the audit identity of CRM records while still allowing staff to
-- update operational fields and appointment status.

create or replace function public.protect_appointment_request_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.appointment_number is distinct from old.appointment_number
     or new.created_by is distinct from old.created_by
     or new.prospector_user_id is distinct from old.prospector_user_id
     or new.created_at is distinct from old.created_at
     or new.whatsapp_target is distinct from old.whatsapp_target then
    raise insufficient_privilege
      using message = 'Appointment audit fields cannot be modified.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_appointment_request_audit_fields
on public.appointment_requests;

create trigger protect_appointment_request_audit_fields
before update on public.appointment_requests
for each row
execute function public.protect_appointment_request_audit_fields();

revoke all on function public.protect_appointment_request_audit_fields()
from public, anon, authenticated;
