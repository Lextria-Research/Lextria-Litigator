-- =====================================================================
-- 0100_litigator.sql
-- Lextria Litigator schema definition: COURT CASES and AGREEMENTS
-- Schema: litigator
-- =====================================================================

create schema if not exists litigator;

-- ---------------------------------------------------------------------
-- 1. Cases (Litigation Matters)
-- ---------------------------------------------------------------------
create table litigator.cases (
  id                uuid primary key default gen_random_uuid(),
  project_code_id   uuid not null unique references core.project_codes(id) on delete cascade,
  case_type         text not null check (case_type in (
                      'CIVIL_SUIT','COMMERCIAL_SUIT','IP_INFRINGEMENT','WRIT','APPEAL',
                      'ARBITRATION','CONSUMER','CRIMINAL_COMPLAINT','PRE_LITIGATION','OTHER'
                    )),
  court             text not null,
  bench             text,
  case_number       text,
  cnr_number        text,
  filing_date       date,
  cause_title       text not null,
  client_role       text not null check (client_role in (
                      'PLAINTIFF','DEFENDANT','PETITIONER','RESPONDENT','APPELLANT','COMPLAINANT','OTHER'
                    )),
  current_stage     text not null default 'Notice sent',
  next_hearing_date date,
  next_purpose      text,
  lead_user_id      uuid references core.profiles(id),
  ethical_wall      boolean not null default false,
  claim_value       numeric(14,2),
  court_fee         numeric(12,2),
  status            text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED')),
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_cases_project_code on litigator.cases (project_code_id);
create index if not exists idx_cases_next_hearing on litigator.cases (next_hearing_date);
create index if not exists idx_cases_stage on litigator.cases (current_stage);
create index if not exists idx_cases_lead on litigator.cases (lead_user_id);
create index if not exists idx_cases_status on litigator.cases (status);
create index if not exists idx_cases_cnr on litigator.cases (cnr_number);
create index if not exists idx_cases_case_num on litigator.cases (case_number);

-- ---------------------------------------------------------------------
-- 2. Case Team (Team Members & Ethical Wall Whitelist)
-- ---------------------------------------------------------------------
create table litigator.case_team (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references litigator.cases(id) on delete cascade,
  user_id           uuid not null references core.profiles(id) on delete cascade,
  role_in_team      text not null default 'MEMBER',
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now(),
  unique(case_id, user_id)
);

create index if not exists idx_case_team_case on litigator.case_team (case_id);
create index if not exists idx_case_team_user on litigator.case_team (user_id);

-- ---------------------------------------------------------------------
-- 3. Case Parties (Litigants, Opposite Parties, Counsel)
-- ---------------------------------------------------------------------
create table litigator.case_parties (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references litigator.cases(id) on delete cascade,
  name              text not null,
  side              text not null check (side in ('OURS','OPPOSITE','OTHER')),
  party_role        text not null,
  address           text,
  counsel_name      text,
  counsel_contact   text,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_case_parties_case on litigator.case_parties (case_id);

-- ---------------------------------------------------------------------
-- 4. Hearings (Court Proceedings & Appearances)
-- ---------------------------------------------------------------------
create table litigator.hearings (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references litigator.cases(id) on delete cascade,
  hearing_date      date not null,
  purpose           text not null,
  attended_by       uuid references core.profiles(id),
  outcome           text,
  next_date         date,
  next_purpose      text,
  order_document_id uuid references core.documents(id),
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_hearings_case on litigator.hearings (case_id);
create index if not exists idx_hearings_date on litigator.hearings (hearing_date desc);
create index if not exists idx_hearings_attended on litigator.hearings (attended_by);

-- ---------------------------------------------------------------------
-- 5. Orders (Interim, Final, Compliance Rulings)
-- ---------------------------------------------------------------------
create table litigator.orders (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references litigator.cases(id) on delete cascade,
  order_date          date not null,
  order_type          text not null check (order_type in ('INTERIM','FINAL','PROCEDURAL','COSTS','OTHER')),
  summary             text not null,
  document_id         uuid references core.documents(id),
  compliance_required boolean not null default false,
  compliance_due      date,
  compliance_owner    uuid references core.profiles(id),
  created_by          uuid references core.profiles(id),
  created_at          timestamptz not null default now()
);

create index if not exists idx_orders_case on litigator.orders (case_id);
create index if not exists idx_orders_date on litigator.orders (order_date desc);
create index if not exists idx_orders_comp_due on litigator.orders (compliance_due);

-- ---------------------------------------------------------------------
-- 6. Internal Notes (Privileged Case Notes - Restricted from Finance)
-- ---------------------------------------------------------------------
create table litigator.internal_notes (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references litigator.cases(id) on delete cascade,
  author            uuid not null references core.profiles(id),
  note              text not null,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_internal_notes_case on litigator.internal_notes (case_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. Agreements (Contracts & Commercial Documents)
-- ---------------------------------------------------------------------
create table litigator.agreements (
  id                    uuid primary key default gen_random_uuid(),
  project_code_id       uuid not null unique references core.project_codes(id) on delete cascade,
  agreement_type        text not null check (agreement_type in (
                          'NDA','MOU','SERVICE','CONSULTANCY','EMPLOYMENT','LICENCE','ASSIGNMENT',
                          'LEASE','SHAREHOLDERS','PARTNERSHIP','DISTRIBUTION','FRANCHISE','SETTLEMENT','OTHER'
                        )),
  title                 text not null,
  client_side           text,
  stage                 text not null default 'INTAKE' check (stage in (
                          'INTAKE','DRAFTING','INTERNAL_REVIEW','CLIENT_REVIEW','COUNTERPARTY_REVIEW',
                          'NEGOTIATION','FINALIZED','EXECUTED','STAMPED_REGISTERED','EXPIRED','TERMINATED','ABANDONED'
                        )),
  lead_user_id          uuid references core.profiles(id),
  reviewer_user_id      uuid references core.profiles(id),
  governing_law         text,
  key_terms             text,
  execution_date        date,
  effective_date        date,
  expiry_date           date,
  renewal_type          text check (renewal_type in ('AUTO','MANUAL','NONE')),
  notice_days           integer,
  stamp_duty            numeric(12,2),
  stamp_ref             text,
  registration_required boolean not null default false,
  registration_no       text,
  created_by            uuid references core.profiles(id),
  created_at            timestamptz not null default now()
);

create index if not exists idx_agreements_pc on litigator.agreements (project_code_id);
create index if not exists idx_agreements_stage on litigator.agreements (stage);
create index if not exists idx_agreements_lead on litigator.agreements (lead_user_id);
create index if not exists idx_agreements_reviewer on litigator.agreements (reviewer_user_id);
create index if not exists idx_agreements_expiry on litigator.agreements (expiry_date);

-- ---------------------------------------------------------------------
-- 8. Agreement Parties (Signatories & Counterparties)
-- ---------------------------------------------------------------------
create table litigator.agreement_parties (
  id                uuid primary key default gen_random_uuid(),
  agreement_id      uuid not null references litigator.agreements(id) on delete cascade,
  name              text not null,
  party_role        text,
  entity_type       text,
  signatory         text,
  designation       text,
  email             text,
  address           text,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_agreement_parties_agr on litigator.agreement_parties (agreement_id);

-- ---------------------------------------------------------------------
-- 9. Agreement Versions (Version Control & Audit Trail)
-- ---------------------------------------------------------------------
create table litigator.agreement_versions (
  id                uuid primary key default gen_random_uuid(),
  agreement_id      uuid not null references litigator.agreements(id) on delete cascade,
  version_no        integer not null,
  document_id       uuid references core.documents(id),
  sent_to           text not null check (sent_to in ('INTERNAL','CLIENT','COUNTERPARTY','FINAL')),
  sent_at           timestamptz not null default now(),
  change_summary    text,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_agreement_versions_agr on litigator.agreement_versions (agreement_id, version_no);

-- ---------------------------------------------------------------------
-- 10. Templates (Agreement Template Library)
-- ---------------------------------------------------------------------
create table litigator.templates (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  agreement_type    text not null check (agreement_type in (
                      'NDA','MOU','SERVICE','CONSULTANCY','EMPLOYMENT','LICENCE','ASSIGNMENT',
                      'LEASE','SHAREHOLDERS','PARTNERSHIP','DISTRIBUTION','FRANCHISE','SETTLEMENT','OTHER'
                    )),
  document_id       uuid references core.documents(id),
  notes             text,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_templates_type on litigator.templates (agreement_type);

-- ---------------------------------------------------------------------
-- 11. Deadlines (Statutory, Court, Internal & Renewal Deadlines)
-- ---------------------------------------------------------------------
create table litigator.deadlines (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid references litigator.cases(id) on delete cascade,
  agreement_id      uuid references litigator.agreements(id) on delete cascade,
  title             text not null,
  due_date          date not null,
  deadline_type     text not null check (deadline_type in ('STATUTORY','COURT_ORDERED','INTERNAL','RENEWAL')),
  basis             text,
  owner_user_id     uuid not null references core.profiles(id),
  backup_user_id    uuid not null references core.profiles(id),
  status            text not null default 'OPEN' check (status in ('OPEN','DONE')),
  done_note         text,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_deadlines_case on litigator.deadlines (case_id);
create index if not exists idx_deadlines_agr on litigator.deadlines (agreement_id);
create index if not exists idx_deadlines_due on litigator.deadlines (due_date);
create index if not exists idx_deadlines_owner on litigator.deadlines (owner_user_id);
create index if not exists idx_deadlines_backup on litigator.deadlines (backup_user_id);
create index if not exists idx_deadlines_status on litigator.deadlines (status);

-- ---------------------------------------------------------------------
-- 12. Linked IP (Cross-Dashboard Bridge to IP Assets)
-- ---------------------------------------------------------------------
create table litigator.linked_ip (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references litigator.cases(id) on delete cascade,
  project_code_id   uuid references core.project_codes(id),
  ip_reference      text not null,
  relation          text not null check (relation in ('ENFORCES','DEFENDS','CHALLENGES','OTHER')),
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_linked_ip_case on litigator.linked_ip (case_id);

-- ---------------------------------------------------------------------
-- 13. Cliq Outbox (Zoho Cliq Notification Buffer)
-- ---------------------------------------------------------------------
create table litigator.cliq_outbox (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null,
  title             text not null,
  link              text,
  card              jsonb,
  status            text not null default 'QUEUED' check (status in ('QUEUED','SENT','FAILED')),
  error             text,
  sent_at           timestamptz,
  created_by        uuid references core.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_cliq_outbox_status on litigator.cliq_outbox (status, created_at desc);

-- ---------------------------------------------------------------------
-- Helper Security-Definer Functions
-- ---------------------------------------------------------------------

-- Check if current authenticated user can see a specific case (Ethical Wall Enforcer)
create or replace function litigator.can_see_case(p_case_id uuid)
returns boolean
language plpgsql security definer set search_path = litigator, core as $$
declare
  v_role text;
  v_dept text;
  v_wall boolean;
  v_lead uuid;
  v_on_team boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role, department into v_role, v_dept
  from core.profiles
  where id = auth.uid() and active;

  if v_role is null then
    return false;
  end if;

  -- 1. SUPER_ADMIN always has full access
  if v_role = 'SUPER_ADMIN' then
    return true;
  end if;

  -- Fetch case ethical_wall and lead_user_id
  select ethical_wall, lead_user_id into v_wall, v_lead
  from litigator.cases
  where id = p_case_id;

  if not found then
    return false;
  end if;

  -- Check if user is on team (lead or case_team member)
  v_on_team := (v_lead = auth.uid()) or exists (
    select 1 from litigator.case_team
    where case_id = p_case_id and user_id = auth.uid()
  );

  -- If ethical wall is ON: ONLY case_team members and the lead can see it
  if coalesce(v_wall, false) then
    return v_on_team;
  end if;

  -- If ethical wall is OFF:
  -- INTERN: read/update only if on team
  if v_role = 'INTERN' then
    return v_on_team;
  end if;

  -- Users in LITIGATION or MANAGEMENT department have full access
  if v_dept in ('LITIGATION', 'MANAGEMENT') then
    return true;
  end if;

  -- FINANCE has read access
  if v_role = 'FINANCE' or v_dept = 'FINANCE' then
    return true;
  end if;

  -- Any other staff explicitly on the case team
  return v_on_team;
end;
$$;

-- Check if current authenticated user can see a specific agreement
create or replace function litigator.can_see_agreement(p_agreement_id uuid)
returns boolean
language plpgsql security definer set search_path = litigator, core as $$
declare
  v_role text;
  v_dept text;
  v_lead uuid;
  v_reviewer uuid;
  v_on_team boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role, department into v_role, v_dept
  from core.profiles
  where id = auth.uid() and active;

  if v_role is null then
    return false;
  end if;

  if v_role = 'SUPER_ADMIN' then
    return true;
  end if;

  select lead_user_id, reviewer_user_id into v_lead, v_reviewer
  from litigator.agreements
  where id = p_agreement_id;

  if not found then
    return false;
  end if;

  v_on_team := (v_lead = auth.uid()) or (v_reviewer = auth.uid());

  if v_role = 'INTERN' then
    return v_on_team;
  end if;

  if v_dept in ('AGREEMENT', 'LITIGATION', 'MANAGEMENT') then
    return true;
  end if;

  if v_role = 'FINANCE' or v_dept = 'FINANCE' then
    return true;
  end if;

  return v_on_team;
end;
$$;

-- Intern constraint: Interns cannot modify ethical wall settings
create or replace function litigator.check_intern_case_update()
returns trigger language plpgsql security definer as $$
begin
  if core.my_role() = 'INTERN' then
    if new.ethical_wall is distinct from old.ethical_wall then
      raise exception 'Interns cannot modify ethical wall settings';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_intern_case_update on litigator.cases;
create trigger trg_check_intern_case_update
  before update on litigator.cases
  for each row execute function litigator.check_intern_case_update();

-- Agreement business rules validation trigger
create or replace function litigator.validate_agreement_stage()
returns trigger language plpgsql security definer as $$
begin
  -- 1. Moving to CLIENT_REVIEW requires a version sent to CLIENT
  if new.stage = 'CLIENT_REVIEW' and (tg_op = 'INSERT' or old.stage is distinct from 'CLIENT_REVIEW') then
    if not exists (
      select 1 from litigator.agreement_versions
      where agreement_id = new.id and sent_to in ('CLIENT', 'FINAL')
    ) then
      raise exception 'An agreement cannot move to CLIENT_REVIEW without a version sent to CLIENT';
    end if;
  end if;

  -- 2. Moving to COUNTERPARTY_REVIEW requires a version sent to COUNTERPARTY
  if new.stage = 'COUNTERPARTY_REVIEW' and (tg_op = 'INSERT' or old.stage is distinct from 'COUNTERPARTY_REVIEW') then
    if not exists (
      select 1 from litigator.agreement_versions
      where agreement_id = new.id and sent_to in ('COUNTERPARTY', 'FINAL')
    ) then
      raise exception 'An agreement cannot move to COUNTERPARTY_REVIEW without a version sent to COUNTERPARTY';
    end if;
  end if;

  -- 3. Moving to EXECUTED requires execution_date and a signed copy (sent_to = 'FINAL')
  if new.stage = 'EXECUTED' and (tg_op = 'INSERT' or old.stage is distinct from 'EXECUTED') then
    if new.execution_date is null then
      raise exception 'An agreement requires an execution_date to be marked EXECUTED';
    end if;
    if not exists (
      select 1 from litigator.agreement_versions
      where agreement_id = new.id and sent_to = 'FINAL'
    ) then
      raise exception 'An agreement requires an uploaded signed copy (version sent to FINAL) to be marked EXECUTED';
    end if;

    -- On execution, create a RENEWAL deadline at expiry_date minus notice_days (if both are set)
    if new.expiry_date is not null and new.notice_days is not null and new.notice_days > 0 then
      insert into litigator.deadlines (
        agreement_id,
        title,
        due_date,
        deadline_type,
        basis,
        owner_user_id,
        backup_user_id,
        status,
        created_by
      ) values (
        new.id,
        'Renewal Notice: ' || new.title,
        (new.expiry_date - (new.notice_days || ' days')::interval)::date,
        'RENEWAL',
        'Notice period (' || new.notice_days || ' days before expiry ' || new.expiry_date || ')',
        coalesce(new.lead_user_id, auth.uid()),
        coalesce(new.reviewer_user_id, new.lead_user_id, auth.uid()),
        'OPEN',
        auth.uid()
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_agreement_stage on litigator.agreements;
create trigger trg_validate_agreement_stage
  before insert or update on litigator.agreements
  for each row execute function litigator.validate_agreement_stage();

-- Audit trigger on all litigator business tables
do $$
declare t text;
begin
  foreach t in array array[
    'cases', 'case_team', 'case_parties', 'hearings', 'orders',
    'internal_notes', 'deadlines', 'linked_ip', 'agreements',
    'agreement_parties', 'agreement_versions', 'templates', 'cliq_outbox'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%1$s on litigator.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on litigator.%1$s
                    for each row execute function core.audit_trigger()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------
alter table litigator.cases              enable row level security;
alter table litigator.case_team          enable row level security;
alter table litigator.case_parties       enable row level security;
alter table litigator.hearings           enable row level security;
alter table litigator.orders             enable row level security;
alter table litigator.internal_notes     enable row level security;
alter table litigator.deadlines          enable row level security;
alter table litigator.linked_ip          enable row level security;
alter table litigator.agreements         enable row level security;
alter table litigator.agreement_parties  enable row level security;
alter table litigator.agreement_versions enable row level security;
alter table litigator.templates          enable row level security;
alter table litigator.cliq_outbox        enable row level security;

-- cases
drop policy if exists p_cases_select on litigator.cases;
create policy p_cases_select on litigator.cases
  for select using (litigator.can_see_case(id));

drop policy if exists p_cases_insert on litigator.cases;
create policy p_cases_insert on litigator.cases
  for insert with check (
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_cases_update on litigator.cases;
create policy p_cases_update on litigator.cases
  for update using (
    litigator.can_see_case(id) and
    (core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE','INTERN') and
     (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN')))
  );

drop policy if exists p_cases_delete on litigator.cases;
create policy p_cases_delete on litigator.cases
  for delete using (
    litigator.can_see_case(id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN' and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

-- case_team
drop policy if exists p_case_team_select on litigator.case_team;
create policy p_case_team_select on litigator.case_team
  for select using (litigator.can_see_case(case_id));

drop policy if exists p_case_team_insert on litigator.case_team;
create policy p_case_team_insert on litigator.case_team
  for insert with check (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

drop policy if exists p_case_team_update on litigator.case_team;
create policy p_case_team_update on litigator.case_team
  for update using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

drop policy if exists p_case_team_delete on litigator.case_team;
create policy p_case_team_delete on litigator.case_team
  for delete using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- case_parties
drop policy if exists p_case_parties_select on litigator.case_parties;
create policy p_case_parties_select on litigator.case_parties
  for select using (litigator.can_see_case(case_id));

drop policy if exists p_case_parties_insert on litigator.case_parties;
create policy p_case_parties_insert on litigator.case_parties
  for insert with check (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_case_parties_update on litigator.case_parties;
create policy p_case_parties_update on litigator.case_parties
  for update using (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_case_parties_delete on litigator.case_parties;
create policy p_case_parties_delete on litigator.case_parties
  for delete using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- hearings
drop policy if exists p_hearings_select on litigator.hearings;
create policy p_hearings_select on litigator.hearings
  for select using (litigator.can_see_case(case_id));

drop policy if exists p_hearings_insert on litigator.hearings;
create policy p_hearings_insert on litigator.hearings
  for insert with check (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_hearings_update on litigator.hearings;
create policy p_hearings_update on litigator.hearings
  for update using (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_hearings_delete on litigator.hearings;
create policy p_hearings_delete on litigator.hearings
  for delete using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- orders
drop policy if exists p_orders_select on litigator.orders;
create policy p_orders_select on litigator.orders
  for select using (litigator.can_see_case(case_id));

drop policy if exists p_orders_insert on litigator.orders;
create policy p_orders_insert on litigator.orders
  for insert with check (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_orders_update on litigator.orders;
create policy p_orders_update on litigator.orders
  for update using (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_orders_delete on litigator.orders;
create policy p_orders_delete on litigator.orders
  for delete using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- internal_notes (Finance cannot read or write)
drop policy if exists p_internal_notes_select on litigator.internal_notes;
create policy p_internal_notes_select on litigator.internal_notes
  for select using (
    litigator.can_see_case(case_id) and
    core.my_role() <> 'FINANCE' and
    core.my_department() <> 'FINANCE'
  );

drop policy if exists p_internal_notes_insert on litigator.internal_notes;
create policy p_internal_notes_insert on litigator.internal_notes
  for insert with check (
    litigator.can_see_case(case_id) and
    core.my_role() <> 'FINANCE' and
    core.my_department() <> 'FINANCE'
  );

drop policy if exists p_internal_notes_update on litigator.internal_notes;
create policy p_internal_notes_update on litigator.internal_notes
  for update using (
    litigator.can_see_case(case_id) and
    (author = auth.uid() or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_internal_notes_delete on litigator.internal_notes;
create policy p_internal_notes_delete on litigator.internal_notes
  for delete using (
    litigator.can_see_case(case_id) and
    (author = auth.uid() or core.has_role('SUPER_ADMIN'))
  );

-- linked_ip
drop policy if exists p_linked_ip_select on litigator.linked_ip;
create policy p_linked_ip_select on litigator.linked_ip
  for select using (litigator.can_see_case(case_id));

drop policy if exists p_linked_ip_insert on litigator.linked_ip;
create policy p_linked_ip_insert on litigator.linked_ip
  for insert with check (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_linked_ip_update on litigator.linked_ip;
create policy p_linked_ip_update on litigator.linked_ip
  for update using (
    litigator.can_see_case(case_id) and
    (core.my_department() in ('LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_linked_ip_delete on litigator.linked_ip;
create policy p_linked_ip_delete on litigator.linked_ip
  for delete using (
    litigator.can_see_case(case_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- agreements
drop policy if exists p_agreements_select on litigator.agreements;
create policy p_agreements_select on litigator.agreements
  for select using (litigator.can_see_agreement(id));

drop policy if exists p_agreements_insert on litigator.agreements;
create policy p_agreements_insert on litigator.agreements
  for insert with check (
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_agreements_update on litigator.agreements;
create policy p_agreements_update on litigator.agreements
  for update using (
    litigator.can_see_agreement(id) and
    (core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE','INTERN') and
     (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN')))
  );

drop policy if exists p_agreements_delete on litigator.agreements;
create policy p_agreements_delete on litigator.agreements
  for delete using (
    litigator.can_see_agreement(id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN' and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

-- agreement_parties
drop policy if exists p_agreement_parties_select on litigator.agreement_parties;
create policy p_agreement_parties_select on litigator.agreement_parties
  for select using (litigator.can_see_agreement(agreement_id));

drop policy if exists p_agreement_parties_insert on litigator.agreement_parties;
create policy p_agreement_parties_insert on litigator.agreement_parties
  for insert with check (
    litigator.can_see_agreement(agreement_id) and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_agreement_parties_update on litigator.agreement_parties;
create policy p_agreement_parties_update on litigator.agreement_parties
  for update using (
    litigator.can_see_agreement(agreement_id) and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_agreement_parties_delete on litigator.agreement_parties;
create policy p_agreement_parties_delete on litigator.agreement_parties
  for delete using (
    litigator.can_see_agreement(agreement_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- agreement_versions
drop policy if exists p_agreement_versions_select on litigator.agreement_versions;
create policy p_agreement_versions_select on litigator.agreement_versions
  for select using (litigator.can_see_agreement(agreement_id));

drop policy if exists p_agreement_versions_insert on litigator.agreement_versions;
create policy p_agreement_versions_insert on litigator.agreement_versions
  for insert with check (
    litigator.can_see_agreement(agreement_id) and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_agreement_versions_update on litigator.agreement_versions;
create policy p_agreement_versions_update on litigator.agreement_versions
  for update using (
    litigator.can_see_agreement(agreement_id) and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_agreement_versions_delete on litigator.agreement_versions;
create policy p_agreement_versions_delete on litigator.agreement_versions
  for delete using (
    litigator.can_see_agreement(agreement_id) and
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN'
  );

-- templates
drop policy if exists p_templates_select on litigator.templates;
create policy p_templates_select on litigator.templates
  for select using (core.is_staff());

drop policy if exists p_templates_insert on litigator.templates;
create policy p_templates_insert on litigator.templates
  for insert with check (
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_templates_update on litigator.templates;
create policy p_templates_update on litigator.templates
  for update using (
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    (core.my_department() in ('AGREEMENT','LITIGATION','MANAGEMENT') or core.has_role('SUPER_ADMIN'))
  );

drop policy if exists p_templates_delete on litigator.templates;
create policy p_templates_delete on litigator.templates
  for delete using (core.has_role('SUPER_ADMIN','DEPT_ADMIN'));

-- deadlines
drop policy if exists p_deadlines_select on litigator.deadlines;
create policy p_deadlines_select on litigator.deadlines
  for select using (
    (case_id is null or litigator.can_see_case(case_id)) and
    (agreement_id is null or litigator.can_see_agreement(agreement_id)) and
    (core.my_department() in ('LITIGATION','AGREEMENT','MANAGEMENT') or
     core.has_role('SUPER_ADMIN','FINANCE') or
     owner_user_id = auth.uid() or
     backup_user_id = auth.uid())
  );

drop policy if exists p_deadlines_insert on litigator.deadlines;
create policy p_deadlines_insert on litigator.deadlines
  for insert with check (
    (case_id is null or litigator.can_see_case(case_id)) and
    (agreement_id is null or litigator.can_see_agreement(agreement_id)) and
    (core.my_department() in ('LITIGATION','AGREEMENT','MANAGEMENT') or
     core.has_role('SUPER_ADMIN') or
     owner_user_id = auth.uid() or
     backup_user_id = auth.uid())
  );

drop policy if exists p_deadlines_update on litigator.deadlines;
create policy p_deadlines_update on litigator.deadlines
  for update using (
    (case_id is null or litigator.can_see_case(case_id)) and
    (agreement_id is null or litigator.can_see_agreement(agreement_id)) and
    (core.my_department() in ('LITIGATION','AGREEMENT','MANAGEMENT') or
     core.has_role('SUPER_ADMIN') or
     owner_user_id = auth.uid() or
     backup_user_id = auth.uid())
  );

drop policy if exists p_deadlines_delete on litigator.deadlines;
create policy p_deadlines_delete on litigator.deadlines
  for delete using (
    core.has_role('SUPER_ADMIN','DEPT_ADMIN','ASSOCIATE') and
    core.my_role() <> 'INTERN' and
    (case_id is null or litigator.can_see_case(case_id)) and
    (agreement_id is null or litigator.can_see_agreement(agreement_id))
  );

-- cliq_outbox
drop policy if exists p_cliq_outbox_select on litigator.cliq_outbox;
create policy p_cliq_outbox_select on litigator.cliq_outbox
  for select using (core.is_staff());

drop policy if exists p_cliq_outbox_insert on litigator.cliq_outbox;
create policy p_cliq_outbox_insert on litigator.cliq_outbox
  for insert with check (core.is_staff());

drop policy if exists p_cliq_outbox_update on litigator.cliq_outbox;
create policy p_cliq_outbox_update on litigator.cliq_outbox
  for update using (core.is_staff());

drop policy if exists p_cliq_outbox_delete on litigator.cliq_outbox;
create policy p_cliq_outbox_delete on litigator.cliq_outbox
  for delete using (core.has_role('SUPER_ADMIN'));

-- ---------------------------------------------------------------------
-- End Grants
-- ---------------------------------------------------------------------
grant usage on schema litigator to authenticated, service_role;
grant all on all tables in schema litigator to service_role;
grant select, insert, update, delete on all tables in schema litigator to authenticated;
grant usage, select on all sequences in schema litigator to authenticated, service_role;
grant execute on all functions in schema litigator to authenticated, service_role;
