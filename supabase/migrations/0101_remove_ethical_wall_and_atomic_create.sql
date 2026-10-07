-- =====================================================================
-- 0101_remove_ethical_wall_and_atomic_create.sql
-- 1. Remove ethical wall completely; enforce simple department/role RLS.
-- 2. Add atomic security-invoker functions litigator.create_case and
--    litigator.create_agreement.
-- 3. Clean up orphan core.project_codes left by failed attempts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Drop triggers, functions and ethical_wall column
-- ---------------------------------------------------------------------

-- Drop triggers and functions that reference ethical wall
drop trigger if exists trg_check_intern_case_update on litigator.cases;
drop function if exists litigator.check_intern_case_update();

-- Clean up any functions in schema public (nothing may be in public)
drop function if exists public.create_case;
drop function if exists public.create_agreement;

-- Drop all old policies referencing can_see_case or can_see_agreement
drop policy if exists p_cases_select on litigator.cases;
drop policy if exists p_cases_insert on litigator.cases;
drop policy if exists p_cases_update on litigator.cases;
drop policy if exists p_cases_delete on litigator.cases;

drop policy if exists p_case_team_select on litigator.case_team;
drop policy if exists p_case_team_insert on litigator.case_team;
drop policy if exists p_case_team_update on litigator.case_team;
drop policy if exists p_case_team_delete on litigator.case_team;

drop policy if exists p_case_parties_select on litigator.case_parties;
drop policy if exists p_case_parties_insert on litigator.case_parties;
drop policy if exists p_case_parties_update on litigator.case_parties;
drop policy if exists p_case_parties_delete on litigator.case_parties;

drop policy if exists p_hearings_select on litigator.hearings;
drop policy if exists p_hearings_insert on litigator.hearings;
drop policy if exists p_hearings_update on litigator.hearings;
drop policy if exists p_hearings_delete on litigator.hearings;

drop policy if exists p_orders_select on litigator.orders;
drop policy if exists p_orders_insert on litigator.orders;
drop policy if exists p_orders_update on litigator.orders;
drop policy if exists p_orders_delete on litigator.orders;

drop policy if exists p_internal_notes_select on litigator.internal_notes;
drop policy if exists p_internal_notes_insert on litigator.internal_notes;
drop policy if exists p_internal_notes_update on litigator.internal_notes;
drop policy if exists p_internal_notes_delete on litigator.internal_notes;

drop policy if exists p_deadlines_select on litigator.deadlines;
drop policy if exists p_deadlines_insert on litigator.deadlines;
drop policy if exists p_deadlines_update on litigator.deadlines;
drop policy if exists p_deadlines_delete on litigator.deadlines;

drop policy if exists p_linked_ip_select on litigator.linked_ip;
drop policy if exists p_linked_ip_insert on litigator.linked_ip;
drop policy if exists p_linked_ip_update on litigator.linked_ip;
drop policy if exists p_linked_ip_delete on litigator.linked_ip;

drop policy if exists p_agreements_select on litigator.agreements;
drop policy if exists p_agreements_insert on litigator.agreements;
drop policy if exists p_agreements_update on litigator.agreements;
drop policy if exists p_agreements_delete on litigator.agreements;

drop policy if exists p_agreement_parties_select on litigator.agreement_parties;
drop policy if exists p_agreement_parties_insert on litigator.agreement_parties;
drop policy if exists p_agreement_parties_update on litigator.agreement_parties;
drop policy if exists p_agreement_parties_delete on litigator.agreement_parties;

drop policy if exists p_agreement_versions_select on litigator.agreement_versions;
drop policy if exists p_agreement_versions_insert on litigator.agreement_versions;
drop policy if exists p_agreement_versions_update on litigator.agreement_versions;
drop policy if exists p_agreement_versions_delete on litigator.agreement_versions;

drop policy if exists p_templates_select on litigator.templates;
drop policy if exists p_templates_insert on litigator.templates;
drop policy if exists p_templates_update on litigator.templates;
drop policy if exists p_templates_delete on litigator.templates;

drop policy if exists p_cliq_outbox_select on litigator.cliq_outbox;
drop policy if exists p_cliq_outbox_insert on litigator.cliq_outbox;
drop policy if exists p_cliq_outbox_update on litigator.cliq_outbox;
drop policy if exists p_cliq_outbox_delete on litigator.cliq_outbox;

-- Drop row-lookup helper functions
drop function if exists litigator.can_see_case(uuid);
drop function if exists litigator.can_see_agreement(uuid);

-- Drop ethical_wall column from cases
alter table litigator.cases drop column if exists ethical_wall;

-- ---------------------------------------------------------------------
-- B. Recreate simple role/department RLS policies (No row lookups)
-- ---------------------------------------------------------------------

-- 1. cases: Lit/Agr & SuperAdmin full, Intern read/write no delete, Finance read-only
create policy p_cases_select on litigator.cases
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT') or
    core.has_role('FINANCE') or
    core.my_department() = 'FINANCE'
  );

create policy p_cases_insert on litigator.cases
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_cases_update on litigator.cases
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_cases_delete on litigator.cases
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 2. case_team: plain list of team members, no access rules tied to it
create policy p_case_team_select on litigator.case_team
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_team_insert on litigator.case_team
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_team_update on litigator.case_team
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_team_delete on litigator.case_team
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 3. case_parties
create policy p_case_parties_select on litigator.case_parties
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_parties_insert on litigator.case_parties
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_parties_update on litigator.case_parties
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_case_parties_delete on litigator.case_parties
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 4. hearings
create policy p_hearings_select on litigator.hearings
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_hearings_insert on litigator.hearings
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_hearings_update on litigator.hearings
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_hearings_delete on litigator.hearings
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 5. orders
create policy p_orders_select on litigator.orders
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_orders_insert on litigator.orders
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_orders_update on litigator.orders
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_orders_delete on litigator.orders
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 6. internal_notes (Finance has NO access)
create policy p_internal_notes_select on litigator.internal_notes
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_internal_notes_insert on litigator.internal_notes
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_internal_notes_update on litigator.internal_notes
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_internal_notes_delete on litigator.internal_notes
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 7. deadlines
create policy p_deadlines_select on litigator.deadlines
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_deadlines_insert on litigator.deadlines
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_deadlines_update on litigator.deadlines
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_deadlines_delete on litigator.deadlines
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 8. linked_ip
create policy p_linked_ip_select on litigator.linked_ip
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_linked_ip_insert on litigator.linked_ip
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_linked_ip_update on litigator.linked_ip
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_linked_ip_delete on litigator.linked_ip
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 9. agreements: Lit/Agr & SuperAdmin full, Intern read/write no delete, Finance read-only
create policy p_agreements_select on litigator.agreements
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT') or
    core.has_role('FINANCE') or
    core.my_department() = 'FINANCE'
  );

create policy p_agreements_insert on litigator.agreements
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreements_update on litigator.agreements
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreements_delete on litigator.agreements
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 10. agreement_parties
create policy p_agreement_parties_select on litigator.agreement_parties
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_parties_insert on litigator.agreement_parties
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_parties_update on litigator.agreement_parties
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_parties_delete on litigator.agreement_parties
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 11. agreement_versions
create policy p_agreement_versions_select on litigator.agreement_versions
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_versions_insert on litigator.agreement_versions
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_versions_update on litigator.agreement_versions
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_agreement_versions_delete on litigator.agreement_versions
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 12. templates
create policy p_templates_select on litigator.templates
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_templates_insert on litigator.templates
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_templates_update on litigator.templates
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_templates_delete on litigator.templates
  for delete using (
    (core.has_role('SUPER_ADMIN') or core.my_department() in ('LITIGATION', 'AGREEMENT'))
    and not core.has_role('INTERN')
  );

-- 13. cliq_outbox
create policy p_cliq_outbox_select on litigator.cliq_outbox
  for select using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_cliq_outbox_insert on litigator.cliq_outbox
  for insert with check (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_cliq_outbox_update on litigator.cliq_outbox
  for update using (
    core.has_role('SUPER_ADMIN') or
    core.my_department() in ('LITIGATION', 'AGREEMENT')
  );

create policy p_cliq_outbox_delete on litigator.cliq_outbox
  for delete using (core.has_role('SUPER_ADMIN'));

-- ---------------------------------------------------------------------
-- C. Atomic Case Creation Function (Security Invoker)
-- ---------------------------------------------------------------------
create or replace function litigator.create_case(
  p_project_code        text,
  p_case_type           text,
  p_court               text,
  p_cause_title         text,
  p_client_role         text,
  p_client_id           uuid default null,
  p_new_client_name     text default null,
  p_new_client_code     text default null,
  p_bench               text default null,
  p_case_number         text default null,
  p_cnr_number          text default null,
  p_filing_date         date default null,
  p_current_stage       text default 'Suit filed',
  p_lead_user_id        uuid default null,
  p_claim_value         numeric default null,
  p_court_fee           numeric default null,
  p_next_hearing_date   date default null,
  p_next_purpose        text default null,
  p_opposite_party_name text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_client_id       uuid;
  v_client_name     text;
  v_project_code_id uuid;
  v_case_id         uuid;
  v_lead_id         uuid;
  v_user_id         uuid;
begin
  v_user_id := auth.uid();

  -- 1. Resolve or create Client
  if p_client_id is not null then
    v_client_id := p_client_id;
    select client_name into v_client_name from core.clients where id = v_client_id;
  elsif p_new_client_name is not null and p_new_client_code is not null then
    if exists (select 1 from core.clients where client_code = upper(trim(p_new_client_code))) then
      raise exception 'Client code already exists — select it from the list';
    end if;

    insert into core.clients (client_code, client_name, entity_type, created_by)
    values (upper(trim(p_new_client_code)), trim(p_new_client_name), 'OTHER', v_user_id)
    returning id, client_name into v_client_id, v_client_name;
  else
    raise exception 'Either client_id or new_client_name and new_client_code must be provided';
  end if;

  v_lead_id := coalesce(p_lead_user_id, v_user_id);

  -- 2. Create Project Code
  insert into core.project_codes (
    code, client_id, department, owning_app, title, lead_assignee_id, status, created_by
  )
  values (
    upper(trim(p_project_code)), v_client_id, 'LITIGATION', 'LITIGATOR',
    trim(p_cause_title), v_lead_id, 'ACTIVE', v_user_id
  )
  returning id into v_project_code_id;

  -- 3. Create Case (ethical_wall dropped)
  insert into litigator.cases (
    project_code_id, case_type, court, bench, case_number, cnr_number,
    filing_date, cause_title, client_role, current_stage, lead_user_id,
    claim_value, court_fee, next_hearing_date, next_purpose, status, created_by
  )
  values (
    v_project_code_id, p_case_type, trim(p_court), nullif(trim(p_bench), ''),
    nullif(trim(p_case_number), ''), nullif(trim(p_cnr_number), ''),
    p_filing_date, trim(p_cause_title), p_client_role,
    coalesce(p_current_stage, 'Suit filed'), v_lead_id,
    p_claim_value, p_court_fee, p_next_hearing_date,
    nullif(trim(p_next_purpose), ''), 'ACTIVE', v_user_id
  )
  returning id into v_case_id;

  -- 4. Case Team (Lead and creator)
  if v_lead_id is not null then
    insert into litigator.case_team (case_id, user_id, role_in_team, created_by)
    values (v_case_id, v_lead_id, 'LEAD', v_user_id)
    on conflict (case_id, user_id) do nothing;
  end if;

  if v_user_id is not null and v_user_id <> v_lead_id then
    insert into litigator.case_team (case_id, user_id, role_in_team, created_by)
    values (v_case_id, v_user_id, 'CREATOR', v_user_id)
    on conflict (case_id, user_id) do nothing;
  end if;

  -- 5. Aliases (CNR, CASE_NO) - core.project_aliases has no created_by column
  if p_cnr_number is not null and trim(p_cnr_number) <> '' then
    insert into core.project_aliases (project_code_id, alias_type, alias_value)
    values (v_project_code_id, 'CNR', upper(trim(p_cnr_number)));
  end if;

  if p_case_number is not null and trim(p_case_number) <> '' then
    insert into core.project_aliases (project_code_id, alias_type, alias_value)
    values (v_project_code_id, 'CASE_NO', trim(p_case_number));
  end if;

  -- 6. Parties (Ours and Opposite)
  insert into litigator.case_parties (case_id, name, side, party_role, created_by)
  values (v_case_id, coalesce(v_client_name, 'Our Client'), 'OURS', p_client_role, v_user_id);

  if p_opposite_party_name is not null and trim(p_opposite_party_name) <> '' then
    insert into litigator.case_parties (case_id, name, side, party_role, created_by)
    values (
      v_case_id,
      trim(p_opposite_party_name),
      'OPPOSITE',
      case
        when p_client_role = 'PLAINTIFF' then 'DEFENDANT'
        when p_client_role = 'PETITIONER' then 'RESPONDENT'
        when p_client_role = 'APPELLANT' then 'RESPONDENT'
        when p_client_role = 'COMPLAINANT' then 'ACCUSED'
        else 'OPPOSITE_PARTY'
      end,
      v_user_id
    );
  end if;

  -- 7. First hearing (if date provided)
  if p_next_hearing_date is not null then
    insert into litigator.hearings (case_id, hearing_date, purpose, attended_by, created_by)
    values (
      v_case_id,
      p_next_hearing_date,
      coalesce(nullif(trim(p_next_purpose), ''), 'First Hearing / Notice'),
      v_lead_id,
      v_user_id
    );
  end if;

  -- 8. Matter Event
  insert into core.matter_events (
    project_code_id, event_code, title, detail, occurred_at,
    actor_user_id, source_app, client_visible, client_label, metadata
  )
  values (
    v_project_code_id,
    case
      when p_current_stage = 'Notice sent' then 'LEGAL_NOTICE_SENT'
      when p_current_stage = 'Notice served' then 'LEGAL_NOTICE_SERVED'
      else 'SUIT_FILED'
    end,
    'Court case filed: ' || trim(p_cause_title),
    'Filed before ' || trim(p_court) || coalesce(' (' || trim(p_bench) || ')', '') || coalesce('. Case No: ' || trim(p_case_number), ''),
    coalesce(p_filing_date::timestamptz, now()),
    v_user_id,
    'LITIGATOR',
    true,
    'Case filed',
    '{}'::jsonb
  );

  return v_case_id;
end;
$$;

-- ---------------------------------------------------------------------
-- D. Atomic Agreement Creation Function (Security Invoker)
-- ---------------------------------------------------------------------
create or replace function litigator.create_agreement(
  p_project_code          text,
  p_agreement_type        text,
  p_title                 text,
  p_client_id             uuid default null,
  p_new_client_name       text default null,
  p_new_client_code       text default null,
  p_client_side           text default 'FIRST_PARTY',
  p_stage                 text default 'INTAKE',
  p_lead_user_id          uuid default null,
  p_reviewer_user_id      uuid default null,
  p_governing_law         text default null,
  p_key_terms             text default null,
  p_execution_date        date default null,
  p_effective_date        date default null,
  p_expiry_date           date default null,
  p_renewal_type          text default 'NONE',
  p_notice_days           integer default null,
  p_stamp_duty            numeric default null,
  p_stamp_ref             text default null,
  p_registration_required boolean default false,
  p_registration_no       text default null,
  p_counterparty_name     text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_client_id       uuid;
  v_client_name     text;
  v_project_code_id uuid;
  v_agreement_id    uuid;
  v_lead_id         uuid;
  v_user_id         uuid;
begin
  v_user_id := auth.uid();

  -- 1. Resolve or create Client
  if p_client_id is not null then
    v_client_id := p_client_id;
    select client_name into v_client_name from core.clients where id = v_client_id;
  elsif p_new_client_name is not null and p_new_client_code is not null then
    if exists (select 1 from core.clients where client_code = upper(trim(p_new_client_code))) then
      raise exception 'Client code already exists — select it from the list';
    end if;

    insert into core.clients (client_code, client_name, entity_type, created_by)
    values (upper(trim(p_new_client_code)), trim(p_new_client_name), 'OTHER', v_user_id)
    returning id, client_name into v_client_id, v_client_name;
  else
    raise exception 'Either client_id or new_client_name and new_client_code must be provided';
  end if;

  v_lead_id := coalesce(p_lead_user_id, v_user_id);

  -- 2. Create Project Code
  insert into core.project_codes (
    code, client_id, department, owning_app, title, lead_assignee_id, status, created_by
  )
  values (
    upper(trim(p_project_code)), v_client_id, 'AGREEMENT', 'LITIGATOR',
    trim(p_title), v_lead_id, 'ACTIVE', v_user_id
  )
  returning id into v_project_code_id;

  -- 3. Create Agreement
  insert into litigator.agreements (
    project_code_id, agreement_type, title, client_side, stage,
    lead_user_id, reviewer_user_id, governing_law, key_terms,
    execution_date, effective_date, expiry_date, renewal_type,
    notice_days, stamp_duty, stamp_ref, registration_required,
    registration_no, created_by
  )
  values (
    v_project_code_id, p_agreement_type, trim(p_title),
    nullif(trim(p_client_side), ''), coalesce(p_stage, 'INTAKE'),
    v_lead_id, p_reviewer_user_id, nullif(trim(p_governing_law), ''),
    nullif(trim(p_key_terms), ''), p_execution_date, p_effective_date,
    p_expiry_date, coalesce(p_renewal_type, 'NONE'), p_notice_days,
    p_stamp_duty, nullif(trim(p_stamp_ref), ''), coalesce(p_registration_required, false),
    nullif(trim(p_registration_no), ''), v_user_id
  )
  returning id into v_agreement_id;

  -- 4. Parties
  insert into litigator.agreement_parties (agreement_id, name, party_role, entity_type, created_by)
  values (v_agreement_id, coalesce(v_client_name, 'Our Client'), coalesce(p_client_side, 'FIRST_PARTY'), 'CLIENT', v_user_id);

  if p_counterparty_name is not null and trim(p_counterparty_name) <> '' then
    insert into litigator.agreement_parties (agreement_id, name, party_role, entity_type, created_by)
    values (v_agreement_id, trim(p_counterparty_name), 'COUNTERPARTY', 'COUNTERPARTY', v_user_id);
  end if;

  -- 5. Matter Event
  insert into core.matter_events (
    project_code_id, event_code, title, detail, occurred_at,
    actor_user_id, source_app, client_visible, client_label, metadata
  )
  values (
    v_project_code_id,
    'AGR_INTAKE',
    'Agreement intake: ' || trim(p_title),
    'Agreement type: ' || p_agreement_type || '. Intake logged.',
    coalesce(p_effective_date::timestamptz, now()),
    v_user_id,
    'LITIGATOR',
    true,
    'Instructions received',
    '{}'::jsonb
  );

  return v_agreement_id;
end;
$$;

-- ---------------------------------------------------------------------
-- E. Preview and Clean Up Orphan core.project_codes
-- ---------------------------------------------------------------------

-- 1. Preview: List project codes that will be deleted
select
  pc.id,
  pc.code,
  pc.title,
  pc.department,
  pc.owning_app,
  pc.created_at
from core.project_codes pc
where pc.owning_app = 'LITIGATOR'
  and pc.created_at >= (now() - interval '3 days')
  and not exists (select 1 from litigator.cases c where c.project_code_id = pc.id)
  and not exists (select 1 from litigator.agreements a where a.project_code_id = pc.id)
  and not exists (select 1 from office.dispatch_project_links dpl where dpl.project_code_id = pc.id)
  and not exists (select 1 from office.cash_allocations ca where ca.project_code_id = pc.id)
  and not exists (select 1 from core.recoverable_costs rc where rc.project_code_id = pc.id)
  and not exists (select 1 from core.documents d where d.project_code_id = pc.id)
  and not exists (select 1 from core.matter_events me where me.project_code_id = pc.id and me.source_app <> 'LITIGATOR');

-- 2. Delete matter events belonging to these orphan project codes
delete from core.matter_events
where project_code_id in (
  select pc.id
  from core.project_codes pc
  where pc.owning_app = 'LITIGATOR'
    and pc.created_at >= (now() - interval '3 days')
    and not exists (select 1 from litigator.cases c where c.project_code_id = pc.id)
    and not exists (select 1 from litigator.agreements a where a.project_code_id = pc.id)
    and not exists (select 1 from office.dispatch_project_links dpl where dpl.project_code_id = pc.id)
    and not exists (select 1 from office.cash_allocations ca where ca.project_code_id = pc.id)
    and not exists (select 1 from core.recoverable_costs rc where rc.project_code_id = pc.id)
    and not exists (select 1 from core.documents d where d.project_code_id = pc.id)
    and not exists (select 1 from core.matter_events me where me.project_code_id = pc.id and me.source_app <> 'LITIGATOR')
);

-- 3. Delete aliases belonging to these orphan project codes
delete from core.project_aliases
where project_code_id in (
  select pc.id
  from core.project_codes pc
  where pc.owning_app = 'LITIGATOR'
    and pc.created_at >= (now() - interval '3 days')
    and not exists (select 1 from litigator.cases c where c.project_code_id = pc.id)
    and not exists (select 1 from litigator.agreements a where a.project_code_id = pc.id)
    and not exists (select 1 from office.dispatch_project_links dpl where dpl.project_code_id = pc.id)
    and not exists (select 1 from office.cash_allocations ca where ca.project_code_id = pc.id)
    and not exists (select 1 from core.recoverable_costs rc where rc.project_code_id = pc.id)
    and not exists (select 1 from core.documents d where d.project_code_id = pc.id)
    and not exists (select 1 from core.matter_events me where me.project_code_id = pc.id and me.source_app <> 'LITIGATOR')
);

-- 4. Delete the orphan project codes
delete from core.project_codes
where id in (
  select pc.id
  from core.project_codes pc
  where pc.owning_app = 'LITIGATOR'
    and pc.created_at >= (now() - interval '3 days')
    and not exists (select 1 from litigator.cases c where c.project_code_id = pc.id)
    and not exists (select 1 from litigator.agreements a where a.project_code_id = pc.id)
    and not exists (select 1 from office.dispatch_project_links dpl where dpl.project_code_id = pc.id)
    and not exists (select 1 from office.cash_allocations ca where ca.project_code_id = pc.id)
    and not exists (select 1 from core.recoverable_costs rc where rc.project_code_id = pc.id)
    and not exists (select 1 from core.documents d where d.project_code_id = pc.id)
    and not exists (select 1 from core.matter_events me where me.project_code_id = pc.id and me.source_app <> 'LITIGATOR')
);

-- ---------------------------------------------------------------------
-- F. Grants
-- ---------------------------------------------------------------------
grant usage on schema litigator to authenticated, service_role;
grant usage on schema core to authenticated, service_role;
grant all on all tables in schema litigator to service_role;
grant select, insert, update, delete on all tables in schema litigator to authenticated;
grant usage, select on all sequences in schema litigator to authenticated, service_role;
grant execute on all functions in schema litigator to authenticated, service_role;
