-- Migration 0102: Create views in schema litigator to resolve cross-schema embedding
-- Run in Supabase SQL Editor

-- 1. cases_view
create or replace view litigator.cases_view
with (security_invoker = true) as
select
  c.*,
  case
    when pc.id is not null then
      jsonb_build_object(
        'id', pc.id,
        'code', pc.code,
        'title', pc.title,
        'department', pc.department,
        'owning_app', pc.owning_app,
        'lead_assignee_id', pc.lead_assignee_id,
        'status', pc.status,
        'client_id', pc.client_id,
        'client', case
          when cl.id is not null then
            jsonb_build_object(
              'id', cl.id,
              'client_code', cl.client_code,
              'client_name', cl.client_name,
              'entity_type', cl.entity_type,
              'email', cl.email,
              'phone', cl.phone
            )
          else null
        end
      )
    else null
  end as project_code,
  case
    when p.id is not null then
      jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'email', p.email,
        'role', p.role,
        'department', p.department
      )
    else null
  end as lead_user
from litigator.cases c
left join core.project_codes pc on pc.id = c.project_code_id
left join core.clients cl on cl.id = pc.client_id
left join core.profiles p on p.id = c.lead_user_id;

-- 2. agreements_view
create or replace view litigator.agreements_view
with (security_invoker = true) as
select
  a.*,
  case
    when pc.id is not null then
      jsonb_build_object(
        'id', pc.id,
        'code', pc.code,
        'title', pc.title,
        'department', pc.department,
        'owning_app', pc.owning_app,
        'lead_assignee_id', pc.lead_assignee_id,
        'status', pc.status,
        'client_id', pc.client_id,
        'client', case
          when cl.id is not null then
            jsonb_build_object(
              'id', cl.id,
              'client_code', cl.client_code,
              'client_name', cl.client_name,
              'entity_type', cl.entity_type,
              'email', cl.email,
              'phone', cl.phone
            )
          else null
        end
      )
    else null
  end as project_code,
  case
    when lp.id is not null then
      jsonb_build_object(
        'id', lp.id,
        'display_name', lp.display_name,
        'email', lp.email,
        'role', lp.role,
        'department', lp.department
      )
    else null
  end as lead_user,
  case
    when rp.id is not null then
      jsonb_build_object(
        'id', rp.id,
        'display_name', rp.display_name,
        'email', rp.email,
        'role', rp.role,
        'department', rp.department
      )
    else null
  end as reviewer_user
from litigator.agreements a
left join core.project_codes pc on pc.id = a.project_code_id
left join core.clients cl on cl.id = pc.client_id
left join core.profiles lp on lp.id = a.lead_user_id
left join core.profiles rp on rp.id = a.reviewer_user_id;

-- 3. hearings_view
create or replace view litigator.hearings_view
with (security_invoker = true) as
select
  h.*,
  case
    when c.id is not null then
      jsonb_build_object(
        'id', c.id,
        'cause_title', c.cause_title,
        'case_number', c.case_number,
        'cnr_number', c.cnr_number,
        'court', c.court,
        'bench', c.bench,
        'current_stage', c.current_stage,
        'client_role', c.client_role,
        'claim_value', c.claim_value,
        'lead_user_id', c.lead_user_id,
        'project_code', case
          when pc.id is not null then
            jsonb_build_object(
              'id', pc.id,
              'code', pc.code,
              'client_id', pc.client_id,
              'client', case
                when cl.id is not null then
                  jsonb_build_object(
                    'id', cl.id,
                    'client_code', cl.client_code,
                    'client_name', cl.client_name
                  )
                else null
              end
            )
          else null
        end,
        'lead_user', case
          when lp.id is not null then
            jsonb_build_object('id', lp.id, 'display_name', lp.display_name, 'email', lp.email)
          else null
        end
      )
    else null
  end as "case",
  case
    when ap.id is not null then
      jsonb_build_object('id', ap.id, 'display_name', ap.display_name, 'email', ap.email, 'role', ap.role)
    else null
  end as attending_profile,
  case
    when d.id is not null then
      jsonb_build_object('id', d.id, 'file_name', d.file_name, 'zoho_permalink', d.zoho_permalink, 'workdrive_path', d.workdrive_path)
    else null
  end as order_document
from litigator.hearings h
left join litigator.cases c on c.id = h.case_id
left join core.project_codes pc on pc.id = c.project_code_id
left join core.clients cl on cl.id = pc.client_id
left join core.profiles ap on ap.id = h.attended_by
left join core.profiles lp on lp.id = c.lead_user_id
left join core.documents d on d.id = h.order_document_id;

-- 4. deadlines_view
create or replace view litigator.deadlines_view
with (security_invoker = true) as
select
  d.*,
  case
    when c.id is not null then
      jsonb_build_object(
        'id', c.id,
        'cause_title', c.cause_title,
        'case_number', c.case_number,
        'court', c.court
      )
    else null
  end as "case",
  case
    when a.id is not null then
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'agreement_type', a.agreement_type,
        'stage', a.stage
      )
    else null
  end as agreement,
  case
    when op.id is not null then
      jsonb_build_object('id', op.id, 'display_name', op.display_name, 'email', op.email, 'role', op.role)
    else null
  end as owner_profile,
  case
    when bp.id is not null then
      jsonb_build_object('id', bp.id, 'display_name', bp.display_name, 'email', bp.email, 'role', bp.role)
    else null
  end as backup_profile
from litigator.deadlines d
left join litigator.cases c on c.id = d.case_id
left join litigator.agreements a on a.id = d.agreement_id
left join core.profiles op on op.id = d.owner_user_id
left join core.profiles bp on bp.id = d.backup_user_id;

-- 5. orders_view
create or replace view litigator.orders_view
with (security_invoker = true) as
select
  o.*,
  case
    when c.id is not null then
      jsonb_build_object(
        'id', c.id,
        'cause_title', c.cause_title,
        'court', c.court
      )
    else null
  end as "case",
  case
    when cp.id is not null then
      jsonb_build_object('id', cp.id, 'display_name', cp.display_name, 'email', cp.email, 'role', cp.role)
    else null
  end as compliance_owner_profile,
  case
    when d.id is not null then
      jsonb_build_object('id', d.id, 'file_name', d.file_name, 'zoho_permalink', d.zoho_permalink, 'workdrive_path', d.workdrive_path)
    else null
  end as document
from litigator.orders o
left join litigator.cases c on c.id = o.case_id
left join core.profiles cp on cp.id = o.compliance_owner
left join core.documents d on d.id = o.document_id;

-- 6. internal_notes_view
create or replace view litigator.internal_notes_view
with (security_invoker = true) as
select
  n.*,
  case
    when p.id is not null then
      jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email, 'role', p.role)
    else null
  end as author_profile
from litigator.internal_notes n
left join core.profiles p on p.id = n.author;

-- 7. agreement_versions_view
create or replace view litigator.agreement_versions_view
with (security_invoker = true) as
select
  av.*,
  case
    when d.id is not null then
      jsonb_build_object('id', d.id, 'file_name', d.file_name, 'zoho_permalink', d.zoho_permalink, 'workdrive_path', d.workdrive_path, 'size_bytes', d.size_bytes)
    else null
  end as document
from litigator.agreement_versions av
left join core.documents d on d.id = av.document_id;

-- 8. linked_ip_view
create or replace view litigator.linked_ip_view
with (security_invoker = true) as
select
  lip.*,
  case
    when pc.id is not null then
      jsonb_build_object(
        'id', pc.id,
        'code', pc.code,
        'title', pc.title,
        'department', pc.department,
        'owning_app', pc.owning_app,
        'status', pc.status
      )
    else null
  end as project_code
from litigator.linked_ip lip
left join core.project_codes pc on pc.id = lip.project_code_id;

-- 9. templates_view
create or replace view litigator.templates_view
with (security_invoker = true) as
select
  t.*,
  case
    when d.id is not null then
      jsonb_build_object('id', d.id, 'file_name', d.file_name, 'zoho_permalink', d.zoho_permalink, 'workdrive_path', d.workdrive_path, 'size_bytes', d.size_bytes)
    else null
  end as document
from litigator.templates t
left join core.documents d on d.id = t.document_id;

-- Grants
grant select on litigator.cases_view to authenticated, service_role;
grant select on litigator.agreements_view to authenticated, service_role;
grant select on litigator.hearings_view to authenticated, service_role;
grant select on litigator.deadlines_view to authenticated, service_role;
grant select on litigator.orders_view to authenticated, service_role;
grant select on litigator.internal_notes_view to authenticated, service_role;
grant select on litigator.agreement_versions_view to authenticated, service_role;
grant select on litigator.linked_ip_view to authenticated, service_role;
grant select on litigator.templates_view to authenticated, service_role;

notify pgrst, 'reload schema';
