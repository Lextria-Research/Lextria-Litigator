// src/lib/api.ts
// Direct Supabase database client interface and business workflows

import { coreDb, litigatorDb, supabase } from './supabase';
import { clock } from './clock';
import type {
  CaseRecord,
  CasePartyRecord,
  HearingRecord,
  OrderRecord,
  InternalNoteRecord,
  DeadlineRecord,
  LinkedIPRecord,
  AgreementRecord,
  AgreementPartyRecord,
  AgreementVersionRecord,
  TemplateRecord,
  CoreProfile,
  CoreClient,
  CoreProjectCode,
  CoreMatterEvent,
  CliqOutboxItem,
  CaseStage,
  AgreementStage,
} from './types';

// ==========================================
// 1. PROFILES & CLIENTS & PROJECT CODES
// ==========================================

export async function fetchProfiles(): Promise<CoreProfile[]> {
  const { data, error } = await coreDb
    .from('profiles')
    .select('*')
    .eq('active', true)
    .order('display_name');
  if (error) throw error;
  return (data || []) as CoreProfile[];
}

export async function fetchClients(): Promise<CoreClient[]> {
  const { data, error } = await coreDb
    .from('clients')
    .select('*')
    .order('client_name');
  if (error) throw error;
  return (data || []) as CoreClient[];
}

export async function createClient(client: Partial<CoreClient>): Promise<CoreClient> {
  const { data, error } = await coreDb
    .from('clients')
    .insert({
      client_code: client.client_code?.toUpperCase(),
      client_name: client.client_name,
      entity_type: client.entity_type || 'NATURAL_PERSON',
      email: client.email || null,
      phone: client.phone || null,
      gstin: client.gstin || null,
      pan: client.pan || null,
      billing_address: client.billing_address || null,
      state_code: client.state_code || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CoreClient;
}

export async function fetchProjectCodes(department?: string): Promise<CoreProjectCode[]> {
  let query = coreDb
    .from('project_codes')
    .select('*, client:clients(*)');
  if (department) {
    query = query.eq('department', department);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CoreProjectCode[];
}

export async function createProjectCode(params: {
  code: string;
  clientId: string;
  department: 'LITIGATION' | 'AGREEMENT';
  title: string;
  leadAssigneeId?: string | null;
}): Promise<CoreProjectCode> {
  const { data, error } = await coreDb
    .from('project_codes')
    .insert({
      code: params.code.trim(),
      client_id: params.clientId,
      department: params.department,
      title: params.title,
      lead_assignee_id: params.leadAssigneeId || null,
      owning_app: 'LITIGATOR',
      status: 'ACTIVE',
    })
    .select('*, client:clients(*)')
    .single();
  if (error) throw error;
  return data as CoreProjectCode;
}

export async function addProjectAlias(params: {
  projectCodeId: string;
  aliasType: 'CNR' | 'CASE_NO';
  aliasValue: string;
}) {
  if (!params.aliasValue.trim()) return;
  const { error } = await coreDb.from('project_aliases').upsert(
    {
      project_code_id: params.projectCodeId,
      alias_type: params.aliasType,
      alias_value: params.aliasValue.trim(),
    },
    { onConflict: 'alias_type,alias_value' }
  );
  if (error) console.warn('Could not record project alias:', error.message);
}

// ==========================================
// 2. CASES
// ==========================================

export async function fetchCases(filters?: {
  stage?: string;
  court?: string;
  leadUserId?: string;
  clientId?: string;
  search?: string;
  dateRange?: { start?: string; end?: string };
}): Promise<CaseRecord[]> {
  let query = litigatorDb
    .from('cases')
    .select(`
      *,
      project_code:project_code_id (
        id, code, title, client_id,
        client:client_id (id, client_code, client_name)
      ),
      lead_user:lead_user_id (id, display_name, email, role)
    `)
    .order('next_hearing_date', { ascending: true, nullsFirst: false });

  if (filters?.stage) query = query.eq('current_stage', filters.stage);
  if (filters?.court) query = query.ilike('court', `%${filters.court}%`);
  if (filters?.leadUserId) query = query.eq('lead_user_id', filters.leadUserId);
  if (filters?.dateRange?.start) query = query.gte('next_hearing_date', filters.dateRange.start);
  if (filters?.dateRange?.end) query = query.lte('next_hearing_date', filters.dateRange.end);

  const { data, error } = await query;
  if (error) throw error;

  let cases = (data || []) as CaseRecord[];

  // In-memory filter for deep relations like client and search
  if (filters?.clientId) {
    cases = cases.filter((c) => c.project_code?.client_id === filters.clientId);
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    cases = cases.filter(
      (c) =>
        c.cause_title.toLowerCase().includes(s) ||
        (c.case_number && c.case_number.toLowerCase().includes(s)) ||
        (c.cnr_number && c.cnr_number.toLowerCase().includes(s)) ||
        (c.court && c.court.toLowerCase().includes(s)) ||
        (c.project_code?.code && c.project_code.code.toLowerCase().includes(s))
    );
  }

  return cases;
}

export async function fetchCaseById(id: string): Promise<CaseRecord> {
  const { data, error } = await litigatorDb
    .from('cases')
    .select(`
      *,
      project_code:project_code_id (
        id, code, title, client_id,
        client:client_id (id, client_code, client_name, entity_type, email, phone)
      ),
      lead_user:lead_user_id (id, display_name, email, role)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as CaseRecord;
}

export async function createCase(params: {
  projectCodeId: string;
  caseType: string;
  court: string;
  bench?: string;
  caseNumber?: string;
  cnrNumber?: string;
  filingDate?: string;
  causeTitle: string;
  clientRole: string;
  currentStage?: string;
  nextHearingDate?: string;
  nextPurpose?: string;
  leadUserId?: string;
  ethicalWall?: boolean;
  claimValue?: number;
  courtFee?: number;
  parties?: Array<{ name: string; side: 'OURS' | 'OPPOSITE' | 'OTHER'; party_role: string }>;
}): Promise<CaseRecord> {
  const caseId = crypto.randomUUID();
  const { error: caseErr } = await litigatorDb
    .from('cases')
    .insert({
      id: caseId,
      project_code_id: params.projectCodeId,
      case_type: params.caseType,
      court: params.court,
      bench: params.bench || null,
      case_number: params.caseNumber || null,
      cnr_number: params.cnrNumber || null,
      filing_date: params.filingDate || null,
      cause_title: params.causeTitle,
      client_role: params.clientRole,
      current_stage: params.currentStage || 'Suit filed',
      next_hearing_date: params.nextHearingDate || null,
      next_purpose: params.nextPurpose || null,
      lead_user_id: params.leadUserId || null,
      ethical_wall: Boolean(params.ethicalWall),
      claim_value: params.claimValue || null,
      court_fee: params.courtFee || null,
      status: 'ACTIVE',
    });

  if (caseErr) throw caseErr;

  // Add lead to case_team
  if (params.leadUserId) {
    await litigatorDb.from('case_team').insert({
      case_id: caseId,
      user_id: params.leadUserId,
      role_in_team: 'LEAD',
    });
  }

  const { data: newCase } = await litigatorDb
    .from('cases')
    .select()
    .eq('id', caseId)
    .single();

  // Add parties if provided
  if (params.parties && params.parties.length > 0) {
    for (const p of params.parties) {
      await litigatorDb.from('case_parties').insert({
        case_id: newCase.id,
        name: p.name,
        side: p.side,
        party_role: p.party_role,
      });
    }
  }

  // Create initial hearing if next_hearing_date provided
  if (params.nextHearingDate) {
    await litigatorDb.from('hearings').insert({
      case_id: newCase.id,
      hearing_date: params.nextHearingDate,
      purpose: params.nextPurpose || 'First Hearing / Notice',
      attended_by: params.leadUserId || null,
    });
  }

  // Record aliases
  if (params.cnrNumber) {
    await addProjectAlias({
      projectCodeId: params.projectCodeId,
      aliasType: 'CNR',
      aliasValue: params.cnrNumber,
    });
  }
  if (params.caseNumber) {
    await addProjectAlias({
      projectCodeId: params.projectCodeId,
      aliasType: 'CASE_NO',
      aliasValue: params.caseNumber,
    });
  }

  // Write matter event: SUIT_FILED
  await recordMatterEvent({
    projectCodeId: params.projectCodeId,
    eventCode: 'SUIT_FILED',
    title: `Suit Filed: ${params.causeTitle}`,
    detail: `Filed in ${params.court} ${params.bench ? `(${params.bench})` : ''}. Case No: ${params.caseNumber || 'Pending'}`,
    occurredAt: params.filingDate || clock.nowISO(),
    clientVisible: true,
  });

  return newCase as CaseRecord;
}

export async function updateCase(
  caseId: string,
  updates: Partial<CaseRecord>
): Promise<CaseRecord> {
  const { data, error } = await litigatorDb
    .from('cases')
    .update(updates)
    .eq('id', caseId)
    .select()
    .single();
  if (error) throw error;
  return data as CaseRecord;
}

// ==========================================
// 3. CASE SUB-ENTITIES: HEARINGS, ORDERS, PARTIES, NOTES, LINKED IP
// ==========================================

export async function fetchHearings(caseId: string): Promise<HearingRecord[]> {
  const { data, error } = await litigatorDb
    .from('hearings')
    .select(`
      *,
      attending_profile:attended_by (id, display_name, email, role),
      order_document:order_document_id (id, file_name, zoho_permalink, workdrive_path)
    `)
    .eq('case_id', caseId)
    .order('hearing_date', { ascending: false });
  if (error) throw error;
  return (data || []) as HearingRecord[];
}

/**
 * "Update after hearing" action:
 * One form for outcome + next date + next purpose.
 * It saves the hearing, creates the next hearing row, updates cases.next_hearing_date,
 * and writes a HEARING_ATTENDED event.
 */
export async function updateAfterHearing(params: {
  caseId: string;
  hearingId?: string;
  hearingDate: string;
  purpose: string;
  outcome: string;
  nextDate?: string | null;
  nextPurpose?: string | null;
  attendedBy?: string | null;
  orderDocumentId?: string | null;
}) {
  let hearingId = params.hearingId;

  // 1. Update or create the current hearing row
  if (hearingId) {
    const { error } = await litigatorDb
      .from('hearings')
      .update({
        outcome: params.outcome,
        next_date: params.nextDate || null,
        next_purpose: params.nextPurpose || null,
        attended_by: params.attendedBy || null,
        order_document_id: params.orderDocumentId || null,
      })
      .eq('id', hearingId);
    if (error) throw error;
  } else {
    const { data: newH, error } = await litigatorDb
      .from('hearings')
      .insert({
        case_id: params.caseId,
        hearing_date: params.hearingDate,
        purpose: params.purpose,
        outcome: params.outcome,
        next_date: params.nextDate || null,
        next_purpose: params.nextPurpose || null,
        attended_by: params.attendedBy || null,
        order_document_id: params.orderDocumentId || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    hearingId = newH.id;
  }

  // 2. If nextDate is provided, create the NEXT hearing row & update case
  if (params.nextDate) {
    await litigatorDb.from('hearings').insert({
      case_id: params.caseId,
      hearing_date: params.nextDate,
      purpose: params.nextPurpose || 'Next Proceeding',
      attended_by: params.attendedBy || null,
    });

    await litigatorDb
      .from('cases')
      .update({
        next_hearing_date: params.nextDate,
        next_purpose: params.nextPurpose || null,
      })
      .eq('id', params.caseId);
  }

  // 3. Fetch case for project_code_id
  const theCase = await fetchCaseById(params.caseId);

  // 4. Write core.matter_events with event_code: HEARING_ATTENDED
  await recordMatterEvent({
    projectCodeId: theCase.project_code_id,
    eventCode: 'HEARING_ATTENDED',
    title: `Hearing Attended: ${params.outcome}`,
    detail: `Purpose: ${params.purpose}. Outcome: ${params.outcome}. Next Date: ${params.nextDate || 'None'} (${params.nextPurpose || 'N/A'})`,
    occurredAt: params.hearingDate,
    actorUserId: params.attendedBy || undefined,
    clientVisible: true,
  });

  // 5. Post or queue Cliq alert card
  await postCliqAlert({
    channel: '#litigation-updates',
    title: `Hearing Update: ${theCase.cause_title} [${theCase.case_number || 'Matter'}]`,
    link: `/cases/${params.caseId}`,
    card: {
      title: `Hearing Concluded: ${theCase.case_number || 'Case'}`,
      outcome: params.outcome,
      next_hearing: params.nextDate || 'Not fixed',
      next_purpose: params.nextPurpose || '—',
    },
  });

  return { hearingId, success: true };
}

export async function fetchOrders(caseId: string): Promise<OrderRecord[]> {
  const { data, error } = await litigatorDb
    .from('orders')
    .select(`
      *,
      compliance_owner_profile:compliance_owner (id, display_name, email, role),
      document:document_id (id, file_name, zoho_permalink, workdrive_path)
    `)
    .eq('case_id', caseId)
    .order('order_date', { ascending: false });
  if (error) throw error;
  return (data || []) as OrderRecord[];
}

export async function createOrder(order: Partial<OrderRecord>): Promise<OrderRecord> {
  const { data, error } = await litigatorDb
    .from('orders')
    .insert(order)
    .select()
    .single();
  if (error) throw error;
  return data as OrderRecord;
}

export async function fetchParties(caseId: string): Promise<CasePartyRecord[]> {
  const { data, error } = await litigatorDb
    .from('case_parties')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CasePartyRecord[];
}

export async function createParty(party: Partial<CasePartyRecord>): Promise<CasePartyRecord> {
  const { data, error } = await litigatorDb
    .from('case_parties')
    .insert(party)
    .select()
    .single();
  if (error) throw error;
  return data as CasePartyRecord;
}

export async function fetchInternalNotes(caseId: string): Promise<InternalNoteRecord[]> {
  const { data, error } = await litigatorDb
    .from('internal_notes')
    .select(`
      *,
      author_profile:author (id, display_name, email, role)
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as InternalNoteRecord[];
}

export async function createInternalNote(caseId: string, note: string, authorId: string) {
  const { data, error } = await litigatorDb
    .from('internal_notes')
    .insert({
      case_id: caseId,
      author: authorId,
      note,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InternalNoteRecord;
}

export async function fetchLinkedIP(caseId: string): Promise<LinkedIPRecord[]> {
  const { data, error } = await litigatorDb
    .from('linked_ip')
    .select('*, project_code:project_code_id(*)')
    .eq('case_id', caseId);
  if (error) throw error;
  return (data || []) as LinkedIPRecord[];
}

export async function createLinkedIP(params: Partial<LinkedIPRecord>) {
  const { data, error } = await litigatorDb
    .from('linked_ip')
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data as LinkedIPRecord;
}

// ==========================================
// 4. DEADLINES
// ==========================================

export async function fetchDeadlines(filters?: {
  caseId?: string;
  agreementId?: string;
  ownerId?: string;
  status?: 'OPEN' | 'DONE';
}): Promise<DeadlineRecord[]> {
  let query = litigatorDb
    .from('deadlines')
    .select(`
      *,
      owner_profile:owner_user_id (id, display_name, email, role),
      backup_profile:backup_user_id (id, display_name, email, role),
      case:case_id (id, cause_title, case_number, court),
      agreement:agreement_id (id, title, agreement_type, stage)
    `)
    .order('due_date', { ascending: true });

  if (filters?.caseId) query = query.eq('case_id', filters.caseId);
  if (filters?.agreementId) query = query.eq('agreement_id', filters.agreementId);
  if (filters?.ownerId) query = query.eq('owner_user_id', filters.ownerId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DeadlineRecord[];
}

export async function createDeadline(deadline: {
  case_id?: string | null;
  agreement_id?: string | null;
  title: string;
  due_date: string;
  deadline_type: string;
  basis?: string | null;
  owner_user_id: string;
  backup_user_id: string;
}): Promise<DeadlineRecord> {
  if (!deadline.owner_user_id || !deadline.backup_user_id) {
    throw new Error('A deadline cannot be saved without an owner and a backup owner.');
  }

  const { data, error } = await litigatorDb
    .from('deadlines')
    .insert({
      ...deadline,
      status: 'OPEN',
    })
    .select()
    .single();
  if (error) throw error;
  return data as DeadlineRecord;
}

export async function markDeadlineDone(id: string, doneNote?: string) {
  const { data, error } = await litigatorDb
    .from('deadlines')
    .update({
      status: 'DONE',
      done_note: doneNote || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ==========================================
// 5. AGREEMENTS & CONTRACTS
// ==========================================

export async function fetchAgreements(filters?: {
  stage?: string;
  agreementType?: string;
  leadUserId?: string;
  search?: string;
}): Promise<AgreementRecord[]> {
  let query = litigatorDb
    .from('agreements')
    .select(`
      *,
      project_code:project_code_id (
        id, code, title, client_id,
        client:client_id (id, client_code, client_name)
      ),
      lead_user:lead_user_id (id, display_name, email, role),
      reviewer_user:reviewer_user_id (id, display_name, email, role)
    `)
    .order('created_at', { ascending: false });

  if (filters?.stage) query = query.eq('stage', filters.stage);
  if (filters?.agreementType) query = query.eq('agreement_type', filters.agreementType);
  if (filters?.leadUserId) query = query.eq('lead_user_id', filters.leadUserId);

  const { data, error } = await query;
  if (error) throw error;

  let list = (data || []) as AgreementRecord[];
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        a.agreement_type.toLowerCase().includes(s) ||
        (a.project_code?.code && a.project_code.code.toLowerCase().includes(s))
    );
  }
  return list;
}

export async function fetchAgreementById(id: string): Promise<AgreementRecord> {
  const { data, error } = await litigatorDb
    .from('agreements')
    .select(`
      *,
      project_code:project_code_id (
        id, code, title, client_id,
        client:client_id (id, client_code, client_name, email, phone)
      ),
      lead_user:lead_user_id (id, display_name, email, role),
      reviewer_user:reviewer_user_id (id, display_name, email, role)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as AgreementRecord;
}

export async function createAgreement(params: {
  projectCodeId: string;
  agreementType: string;
  title: string;
  clientSide?: string;
  stage?: AgreementStage;
  leadUserId?: string;
  reviewerUserId?: string;
  governingLaw?: string;
  keyTerms?: string;
  executionDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  renewalType?: 'AUTO' | 'MANUAL' | 'NONE';
  noticeDays?: number;
  stampDuty?: number;
  stampRef?: string;
  registrationRequired?: boolean;
  registrationNo?: string;
  parties?: Array<{ name: string; party_role?: string; entity_type?: string }>;
}): Promise<AgreementRecord> {
  const agreementId = crypto.randomUUID();
  const { error: agrErr } = await litigatorDb
    .from('agreements')
    .insert({
      id: agreementId,
      project_code_id: params.projectCodeId,
      agreement_type: params.agreementType,
      title: params.title,
      client_side: params.clientSide || null,
      stage: params.stage || 'INTAKE',
      lead_user_id: params.leadUserId || null,
      reviewer_user_id: params.reviewerUserId || null,
      governing_law: params.governingLaw || null,
      key_terms: params.keyTerms || null,
      execution_date: params.executionDate || null,
      effective_date: params.effectiveDate || null,
      expiry_date: params.expiryDate || null,
      renewal_type: params.renewalType || 'NONE',
      notice_days: params.noticeDays || null,
      stamp_duty: params.stampDuty || null,
      stamp_ref: params.stampRef || null,
      registration_required: Boolean(params.registrationRequired),
      registration_no: params.registrationNo || null,
    });

  if (agrErr) throw agrErr;

  const { data: newAgr } = await litigatorDb
    .from('agreements')
    .select()
    .eq('id', agreementId)
    .single();

  // Add initial parties
  if (params.parties && params.parties.length > 0) {
    for (const p of params.parties) {
      await litigatorDb.from('agreement_parties').insert({
        agreement_id: newAgr.id,
        name: p.name,
        party_role: p.party_role || null,
        entity_type: p.entity_type || null,
      });
    }
  }

  // Record matter event: AGR_INTAKE
  await recordMatterEvent({
    projectCodeId: params.projectCodeId,
    eventCode: 'AGR_INTAKE',
    title: `Agreement Intake: ${params.title}`,
    detail: `Type: ${params.agreementType}. Intake logged.`,
    occurredAt: clock.nowISO(),
    clientVisible: true,
  });

  return newAgr as AgreementRecord;
}

export async function updateAgreementStage(
  agreementId: string,
  newStage: AgreementStage,
  extraParams?: { executionDate?: string }
): Promise<AgreementRecord> {
  // 1. Fetch versions to validate review stage rules
  const { data: versions } = await litigatorDb
    .from('agreement_versions')
    .select('sent_to')
    .eq('agreement_id', agreementId);

  const sentList = (versions || []).map((v) => v.sent_to);

  if (newStage === 'CLIENT_REVIEW') {
    if (!sentList.includes('CLIENT') && !sentList.includes('FINAL')) {
      throw new Error(
        'An agreement cannot move to CLIENT_REVIEW without a version sent to the client.'
      );
    }
  }

  if (newStage === 'COUNTERPARTY_REVIEW') {
    if (!sentList.includes('COUNTERPARTY') && !sentList.includes('FINAL')) {
      throw new Error(
        'An agreement cannot move to COUNTERPARTY_REVIEW without a version sent to the counterparty.'
      );
    }
  }

  const updatePayload: Record<string, any> = { stage: newStage };

  if (newStage === 'EXECUTED') {
    if (extraParams?.executionDate) {
      updatePayload.execution_date = extraParams.executionDate;
    }
    const currentAgr = await fetchAgreementById(agreementId);
    if (!currentAgr.execution_date && !extraParams?.executionDate) {
      throw new Error('FINALIZED -> EXECUTED requires execution_date and a signed copy uploaded.');
    }
    if (!sentList.includes('FINAL')) {
      throw new Error('FINALIZED -> EXECUTED requires a signed final copy uploaded (sent to FINAL).');
    }
  }

  const { data, error } = await litigatorDb
    .from('agreements')
    .update(updatePayload)
    .eq('id', agreementId)
    .select()
    .single();

  if (error) throw error;

  const updated = data as AgreementRecord;

  // Log corresponding matter events
  const stageEventMap: Record<string, string> = {
    CLIENT_REVIEW: 'AGR_CLIENT_APPROVED',
    COUNTERPARTY_REVIEW: 'AGR_COUNTERPARTY_SENT',
    FINALIZED: 'AGR_FINALIZED',
    EXECUTED: 'AGR_EXECUTED',
    STAMPED_REGISTERED: 'AGR_STAMPED',
  };

  if (stageEventMap[newStage]) {
    await recordMatterEvent({
      projectCodeId: updated.project_code_id,
      eventCode: stageEventMap[newStage],
      title: `Agreement Stage: ${newStage.replace(/_/g, ' ')}`,
      detail: `Agreement "${updated.title}" progressed to ${newStage}`,
      occurredAt: clock.nowISO(),
      clientVisible: true,
    });
  }

  return updated;
}

export async function fetchAgreementVersions(
  agreementId: string
): Promise<AgreementVersionRecord[]> {
  const { data, error } = await litigatorDb
    .from('agreement_versions')
    .select(`
      *,
      document:document_id (id, file_name, zoho_permalink, workdrive_path, size_bytes)
    `)
    .eq('agreement_id', agreementId)
    .order('version_no', { ascending: false });
  if (error) throw error;
  return (data || []) as AgreementVersionRecord[];
}

export async function addAgreementVersion(params: {
  agreementId: string;
  versionNo: number;
  documentId?: string | null;
  sentTo: 'INTERNAL' | 'CLIENT' | 'COUNTERPARTY' | 'FINAL';
  changeSummary?: string;
}): Promise<AgreementVersionRecord> {
  const { data, error } = await litigatorDb
    .from('agreement_versions')
    .insert({
      agreement_id: params.agreementId,
      version_no: params.versionNo,
      document_id: params.documentId || null,
      sent_to: params.sentTo,
      sent_at: clock.nowISO(),
      change_summary: params.changeSummary || null,
    })
    .select()
    .single();
  if (error) throw error;

  // If version 1 sent to client, record AGR_V1_SENT
  if (params.versionNo === 1 && params.sentTo === 'CLIENT') {
    const agr = await fetchAgreementById(params.agreementId);
    await recordMatterEvent({
      projectCodeId: agr.project_code_id,
      eventCode: 'AGR_V1_SENT',
      title: 'First Draft Sent to Client',
      detail: `Version 1 of ${agr.title} delivered for client review.`,
      occurredAt: clock.nowISO(),
      clientVisible: true,
    });
  }

  return data as AgreementVersionRecord;
}

export async function fetchAgreementParties(
  agreementId: string
): Promise<AgreementPartyRecord[]> {
  const { data, error } = await litigatorDb
    .from('agreement_parties')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as AgreementPartyRecord[];
}

export async function addAgreementParty(
  params: Partial<AgreementPartyRecord>
): Promise<AgreementPartyRecord> {
  const { data, error } = await litigatorDb
    .from('agreement_parties')
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data as AgreementPartyRecord;
}

// ==========================================
// 6. TEMPLATES
// ==========================================

export async function fetchTemplates(agreementType?: string): Promise<TemplateRecord[]> {
  let query = litigatorDb
    .from('templates')
    .select('*, document:document_id(*)')
    .order('name');
  if (agreementType) query = query.eq('agreement_type', agreementType);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TemplateRecord[];
}

export async function createTemplate(params: {
  name: string;
  agreementType: string;
  documentId?: string | null;
  notes?: string;
}): Promise<TemplateRecord> {
  const { data, error } = await litigatorDb
    .from('templates')
    .insert({
      name: params.name,
      agreement_type: params.agreementType,
      document_id: params.documentId || null,
      notes: params.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TemplateRecord;
}

// ==========================================
// 7. DAILY CAUSE LIST & CALENDAR
// ==========================================

export async function fetchDailyCauseList(dateStr: string) {
  const { data, error } = await litigatorDb
    .from('hearings')
    .select(`
      *,
      case:case_id (
        id, cause_title, case_number, cnr_number, court, bench, current_stage,
        client_role, claim_value, lead_user_id,
        project_code:project_code_id (code, client:client_id(client_name)),
        lead_user:lead_user_id (display_name, email)
      ),
      attending_profile:attended_by (display_name, email)
    `)
    .eq('hearing_date', dateStr)
    .order('purpose');

  if (error) throw error;
  return (data || []) as any[];
}

export async function fetchCalendarEvents(monthStart: string, monthEnd: string) {
  // Fetch hearings in range
  const { data: hearings } = await litigatorDb
    .from('hearings')
    .select(`
      id, hearing_date, purpose, outcome, attended_by,
      case:case_id (id, cause_title, case_number, court, lead_user_id),
      attending_profile:attended_by (id, display_name)
    `)
    .gte('hearing_date', monthStart)
    .lte('hearing_date', monthEnd);

  // Fetch deadlines in range
  const { data: deadlines } = await litigatorDb
    .from('deadlines')
    .select(`
      id, title, due_date, deadline_type, status, owner_user_id,
      case:case_id (id, cause_title, case_number),
      agreement:agreement_id (id, title),
      owner_profile:owner_user_id (id, display_name)
    `)
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd);

  return {
    hearings: (hearings || []) as any[],
    deadlines: (deadlines || []) as any[],
  };
}

// ==========================================
// 8. MATTER EVENTS (TIMELINE)
// ==========================================

export async function fetchMatterEvents(projectCodeId: string): Promise<CoreMatterEvent[]> {
  const { data, error } = await coreDb
    .from('matter_events')
    .select(`
      *,
      actor_profile:actor_user_id (id, display_name, email, role)
    `)
    .eq('project_code_id', projectCodeId)
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CoreMatterEvent[];
}

export async function recordMatterEvent(params: {
  projectCodeId: string;
  eventCode?: string;
  title: string;
  detail?: string;
  occurredAt?: string;
  actorUserId?: string;
  clientVisible?: boolean;
}) {
  try {
    const { error } = await coreDb.from('matter_events').insert({
      project_code_id: params.projectCodeId,
      event_code: params.eventCode || null,
      title: params.title,
      detail: params.detail || null,
      occurred_at: params.occurredAt || clock.nowISO(),
      actor_user_id: params.actorUserId || null,
      source_app: 'LITIGATOR',
      client_visible: params.clientVisible ?? false,
    });
    if (error) console.warn('Could not record core.matter_event:', error.message);
  } catch (e) {
    console.warn('Matter event insert error:', e);
  }
}

// ==========================================
// 9. CLIQ NOTIFICATIONS & OUTBOX
// ==========================================

export async function fetchCliqOutbox(): Promise<CliqOutboxItem[]> {
  const { data, error } = await litigatorDb
    .from('cliq_outbox')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CliqOutboxItem[];
}

export async function retryCliqOutboxItem(id: string) {
  const { data, error } = await litigatorDb
    .from('cliq_outbox')
    .update({ status: 'SENT', sent_at: clock.nowISO(), error: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function postCliqAlert(params: {
  channel: string;
  title: string;
  link?: string;
  card?: any;
}) {
  try {
    const resp = await fetch('/api/cliq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!resp.ok) {
      await litigatorDb.from('cliq_outbox').insert({
        channel: params.channel,
        title: params.title,
        link: params.link || null,
        card: params.card || null,
        status: 'FAILED',
        error: `Webhook returned status ${resp.status}`,
      });
    }
  } catch (err: any) {
    await litigatorDb.from('cliq_outbox').insert({
      channel: params.channel,
      title: params.title,
      link: params.link || null,
      card: params.card || null,
      status: 'QUEUED',
      error: err.message,
    });
  }
}
