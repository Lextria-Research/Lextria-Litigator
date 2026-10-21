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
  QuotationRecord,
  ClientNoteRecord,
  StageExpenseRecord,
} from './types';
import { getCustomCaseStages, saveCustomCaseStages } from './types';
import { getStoredUser, isSuperAdminOrFinance } from './auth';

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

export async function syncClientToIpLedger(name: string) {
  try {
    const { data: stRow } = await supabase
      .from('lextria_state')
      .select('state')
      .eq('id', 'lextria-state')
      .maybeSingle();

    if (stRow?.state) {
      const st = stRow.state;
      st.clients = st.clients || [];
      const clean = name.trim();
      const exists = st.clients.some((c: any) => c.name?.trim()?.toLowerCase() === clean.toLowerCase());
      if (!exists) {
        const nextSeq = st.nextClientSeq || (st.clients.length + 1);
        st.clients.push({
          id: 'c-' + nextSeq,
          name: clean,
          created: new Date().toISOString(),
        });
        st.nextClientSeq = nextSeq + 1;
        await supabase.from('lextria_state').update({ state: st }).eq('id', 'lextria-state');
      }
    }
  } catch (err) {
    console.warn('Sync to IP Ledger state warning:', err);
  }
}

export async function fetchClients(): Promise<CoreClient[]> {
  try {
    // Check if IP Ledger (public.lextria_state) has any client not yet in core.clients
    const { data: stRow } = await supabase
      .from('lextria_state')
      .select('state')
      .eq('id', 'lextria-state')
      .maybeSingle();

    if (stRow?.state?.clients?.length) {
      const ipClients: Array<{ id: string; name: string; created?: string }> = stRow.state.clients;
      const { data: existingCore } = await coreDb.from('clients').select('client_name');
      const existingNames = new Set((existingCore || []).map((c: any) => c.client_name?.trim()?.toLowerCase()));

      const missing = ipClients.filter((c) => c.name?.trim() && !existingNames.has(c.name.trim().toLowerCase()));
      if (missing.length > 0) {
        for (const m of missing) {
          const cleanName = m.name.trim();
          const codeCandidate = cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'CLI';
          try {
            await coreDb.from('clients').insert({
              client_name: cleanName,
              client_code: codeCandidate,
              entity_type: 'OTHER',
              created_at: m.created || new Date().toISOString(),
            });
          } catch {}
        }
      }
    }
  } catch (err) {
    // Graceful fallback to coreDb
  }

  const { data, error } = await coreDb
    .from('clients')
    .select('*')
    .order('client_name');
  if (error) throw error;
  return (data || []) as CoreClient[];
}

export async function createClient(client: Partial<CoreClient>): Promise<CoreClient> {
  const cleanName = client.client_name?.trim() || '';
  const cleanCode = client.client_code?.trim()?.toUpperCase() || '';

  if (!cleanName) {
    throw new Error('Client name is required.');
  }

  // 1. Check if a client with the same name (case-insensitive) already exists in core.clients
  const { data: existingByName, error: checkNameErr } = await coreDb
    .from('clients')
    .select('*')
    .ilike('client_name', cleanName)
    .limit(1)
    .maybeSingle();

  if (checkNameErr) console.warn('Check client by name warning:', checkNameErr.message);
  if (existingByName) {
    throw new Error(
      `A client named "${existingByName.client_name}" (${existingByName.client_code}) already exists in the universal client registry. Duplicate clients are not permitted.`
    );
  }

  // 2. Check if a client with the same client_code already exists
  if (cleanCode) {
    const { data: existingByCode, error: checkCodeErr } = await coreDb
      .from('clients')
      .select('*')
      .eq('client_code', cleanCode)
      .limit(1)
      .maybeSingle();

    if (checkCodeErr) console.warn('Check client by code warning:', checkCodeErr.message);
    if (existingByCode) {
      throw new Error(
        `Client code "${cleanCode}" is already registered to "${existingByCode.client_name}". Duplicate client codes are not permitted.`
      );
    }
  }

  const { data, error } = await coreDb
    .from('clients')
    .insert({
      client_code: cleanCode || undefined,
      client_name: cleanName,
      entity_type: client.entity_type || 'OTHER',
      email: client.email?.trim() || null,
      phone: client.phone?.trim() || null,
      gstin: client.gstin?.trim() || null,
      pan: client.pan?.trim() || null,
      billing_address: client.billing_address?.trim() || null,
      state_code: client.state_code || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A client with this name or code already exists in the universal client registry.');
    }
    throw error;
  }

  // 3. Synchronize immediately to IP Ledger (public.lextria_state)
  await syncClientToIpLedger(cleanName);

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
// 2. ENRICHMENT HELPERS (CROSS-SCHEMA FALLBACK)
// ==========================================

async function enrichCases(cases: any[]): Promise<CaseRecord[]> {
  if (!cases || cases.length === 0) return [];
  const projectCodeIds = [...new Set(cases.map((c) => c.project_code_id).filter(Boolean))];
  const leadUserIds = [...new Set(cases.map((c) => c.lead_user_id).filter(Boolean))];

  const pcMap = new Map<string, any>();
  if (projectCodeIds.length > 0) {
    const { data: pcs } = await coreDb
      .from('project_codes')
      .select('*, client:clients(*)')
      .in('id', projectCodeIds);
    (pcs || []).forEach((pc) => pcMap.set(pc.id, pc));
  }

  const profMap = new Map<string, any>();
  if (leadUserIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role, department')
      .in('id', leadUserIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  const currentUser = getStoredUser();
  const quoteMap = new Map<string, any>();
  if (isSuperAdminOrFinance(currentUser) && projectCodeIds.length > 0) {
    try {
      const { data: quotes } = await supabase
        .schema('finance')
        .from('quotations')
        .select('*')
        .in('project_code_id', projectCodeIds);
      (quotes || []).forEach((q) => quoteMap.set(q.project_code_id, q));
    } catch {
      // ignore
    }
  }

  return cases.map((c) => ({
    ...c,
    project_code: c.project_code || pcMap.get(c.project_code_id) || undefined,
    lead_user: c.lead_user || profMap.get(c.lead_user_id) || undefined,
    quotation: isSuperAdminOrFinance(currentUser) ? quoteMap.get(c.project_code_id) || undefined : undefined,
  })) as CaseRecord[];
}

async function enrichAgreements(agreements: any[]): Promise<AgreementRecord[]> {
  if (!agreements || agreements.length === 0) return [];
  const projectCodeIds = [...new Set(agreements.map((a) => a.project_code_id).filter(Boolean))];
  const userIds = [
    ...new Set(
      [...agreements.map((a) => a.lead_user_id), ...agreements.map((a) => a.reviewer_user_id)].filter(
        Boolean
      )
    ),
  ];

  const pcMap = new Map<string, any>();
  if (projectCodeIds.length > 0) {
    const { data: pcs } = await coreDb
      .from('project_codes')
      .select('*, client:clients(*)')
      .in('id', projectCodeIds);
    (pcs || []).forEach((pc) => pcMap.set(pc.id, pc));
  }

  const profMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role, department')
      .in('id', userIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  return agreements.map((a) => ({
    ...a,
    project_code: a.project_code || pcMap.get(a.project_code_id) || undefined,
    lead_user: a.lead_user || profMap.get(a.lead_user_id) || undefined,
    reviewer_user: a.reviewer_user || profMap.get(a.reviewer_user_id) || undefined,
  })) as AgreementRecord[];
}

async function enrichHearings(hearings: any[]): Promise<HearingRecord[]> {
  if (!hearings || hearings.length === 0) return [];
  const caseIds = [...new Set(hearings.map((h) => h.case_id).filter(Boolean))];
  const attendedByIds = [...new Set(hearings.map((h) => h.attended_by).filter(Boolean))];
  const docIds = [...new Set(hearings.map((h) => h.order_document_id).filter(Boolean))];

  const caseMap = new Map<string, any>();
  if (caseIds.length > 0) {
    const { data: rawCases } = await litigatorDb.from('cases').select('*').in('id', caseIds);
    const enriched = await enrichCases(rawCases || []);
    enriched.forEach((c) => caseMap.set(c.id, c));
  }

  const profMap = new Map<string, any>();
  if (attendedByIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role')
      .in('id', attendedByIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  const docMap = new Map<string, any>();
  if (docIds.length > 0) {
    const { data: docs } = await coreDb
      .from('documents')
      .select('id, file_name, zoho_permalink, workdrive_path')
      .in('id', docIds);
    (docs || []).forEach((d) => docMap.set(d.id, d));
  }

  return hearings.map((h) => ({
    ...h,
    case: h.case || caseMap.get(h.case_id) || undefined,
    attending_profile: h.attending_profile || profMap.get(h.attended_by) || undefined,
    order_document: h.order_document || docMap.get(h.order_document_id) || undefined,
  })) as HearingRecord[];
}

async function enrichOrders(orders: any[]): Promise<OrderRecord[]> {
  if (!orders || orders.length === 0) return [];
  const caseIds = [...new Set(orders.map((o) => o.case_id).filter(Boolean))];
  const ownerIds = [...new Set(orders.map((o) => o.compliance_owner).filter(Boolean))];
  const docIds = [...new Set(orders.map((o) => o.document_id).filter(Boolean))];

  const caseMap = new Map<string, any>();
  if (caseIds.length > 0) {
    const { data: rawCases } = await litigatorDb
      .from('cases')
      .select('id, cause_title, court')
      .in('id', caseIds);
    (rawCases || []).forEach((c) => caseMap.set(c.id, c));
  }

  const profMap = new Map<string, any>();
  if (ownerIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role')
      .in('id', ownerIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  const docMap = new Map<string, any>();
  if (docIds.length > 0) {
    const { data: docs } = await coreDb
      .from('documents')
      .select('id, file_name, zoho_permalink, workdrive_path')
      .in('id', docIds);
    (docs || []).forEach((d) => docMap.set(d.id, d));
  }

  return orders.map((o) => ({
    ...o,
    case: o.case || caseMap.get(o.case_id) || undefined,
    compliance_owner_profile: o.compliance_owner_profile || profMap.get(o.compliance_owner) || undefined,
    document: o.document || docMap.get(o.document_id) || undefined,
  })) as OrderRecord[];
}

async function enrichDeadlines(deadlines: any[]): Promise<DeadlineRecord[]> {
  if (!deadlines || deadlines.length === 0) return [];
  const caseIds = [...new Set(deadlines.map((d) => d.case_id).filter(Boolean))];
  const agrIds = [...new Set(deadlines.map((d) => d.agreement_id).filter(Boolean))];
  const userIds = [
    ...new Set(
      [...deadlines.map((d) => d.owner_user_id), ...deadlines.map((d) => d.backup_user_id)].filter(
        Boolean
      )
    ),
  ];

  const caseMap = new Map<string, any>();
  if (caseIds.length > 0) {
    const { data: cs } = await litigatorDb
      .from('cases')
      .select('id, cause_title, case_number, court')
      .in('id', caseIds);
    (cs || []).forEach((c) => caseMap.set(c.id, c));
  }

  const agrMap = new Map<string, any>();
  if (agrIds.length > 0) {
    const { data: agrs } = await litigatorDb
      .from('agreements')
      .select('id, title, agreement_type, stage')
      .in('id', agrIds);
    (agrs || []).forEach((a) => agrMap.set(a.id, a));
  }

  const profMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role')
      .in('id', userIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  return deadlines.map((d) => ({
    ...d,
    case: d.case || caseMap.get(d.case_id) || undefined,
    agreement: d.agreement || agrMap.get(d.agreement_id) || undefined,
    owner_profile: d.owner_profile || profMap.get(d.owner_user_id) || undefined,
    backup_profile: d.backup_profile || profMap.get(d.backup_user_id) || undefined,
  })) as DeadlineRecord[];
}

async function enrichInternalNotes(notes: any[]): Promise<InternalNoteRecord[]> {
  if (!notes || notes.length === 0) return [];
  const authorIds = [...new Set(notes.map((n) => n.author).filter(Boolean))];

  const profMap = new Map<string, any>();
  if (authorIds.length > 0) {
    const { data: profs } = await coreDb
      .from('profiles')
      .select('id, display_name, email, role')
      .in('id', authorIds);
    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  return notes.map((n) => ({
    ...n,
    author_profile: n.author_profile || profMap.get(n.author) || undefined,
  })) as InternalNoteRecord[];
}

async function enrichLinkedIP(linkedIp: any[]): Promise<LinkedIPRecord[]> {
  if (!linkedIp || linkedIp.length === 0) return [];
  const pcIds = [...new Set(linkedIp.map((l) => l.project_code_id).filter(Boolean))];

  const pcMap = new Map<string, any>();
  if (pcIds.length > 0) {
    const { data: pcs } = await coreDb.from('project_codes').select('*').in('id', pcIds);
    (pcs || []).forEach((pc) => pcMap.set(pc.id, pc));
  }

  return linkedIp.map((l) => ({
    ...l,
    project_code: l.project_code || pcMap.get(l.project_code_id) || undefined,
  })) as LinkedIPRecord[];
}

async function enrichAgreementVersions(versions: any[]): Promise<AgreementVersionRecord[]> {
  if (!versions || versions.length === 0) return [];
  const docIds = [...new Set(versions.map((v) => v.document_id).filter(Boolean))];

  const docMap = new Map<string, any>();
  if (docIds.length > 0) {
    const { data: docs } = await coreDb
      .from('documents')
      .select('id, file_name, zoho_permalink, workdrive_path, size_bytes')
      .in('id', docIds);
    (docs || []).forEach((d) => docMap.set(d.id, d));
  }

  return versions.map((v) => ({
    ...v,
    document: v.document || docMap.get(v.document_id) || undefined,
  })) as AgreementVersionRecord[];
}

async function enrichTemplates(templates: any[]): Promise<TemplateRecord[]> {
  if (!templates || templates.length === 0) return [];
  const docIds = [...new Set(templates.map((t) => t.document_id).filter(Boolean))];

  const docMap = new Map<string, any>();
  if (docIds.length > 0) {
    const { data: docs } = await coreDb
      .from('documents')
      .select('id, file_name, zoho_permalink, workdrive_path, size_bytes')
      .in('id', docIds);
    (docs || []).forEach((d) => docMap.set(d.id, d));
  }

  return templates.map((t) => ({
    ...t,
    document: t.document || docMap.get(t.document_id) || undefined,
  })) as TemplateRecord[];
}

// ==========================================
// 3. CASES
// ==========================================

export async function fetchCases(filters?: {
  stage?: string;
  court?: string;
  leadUserId?: string;
  clientId?: string;
  search?: string;
  dateRange?: { start?: string; end?: string };
  includePreLitigation?: boolean;
}): Promise<CaseRecord[]> {
  // 1. Try litigator.cases_view
  let query = litigatorDb
    .from('cases_view')
    .select('*')
    .order('next_hearing_date', { ascending: true, nullsFirst: false });

  if (filters?.stage) query = query.eq('current_stage', filters.stage);
  if (filters?.court) query = query.ilike('court', `%${filters.court}%`);
  if (filters?.leadUserId) query = query.eq('lead_user_id', filters.leadUserId);
  if (filters?.dateRange?.start) query = query.gte('next_hearing_date', filters.dateRange.start);
  if (filters?.dateRange?.end) query = query.lte('next_hearing_date', filters.dateRange.end);

  const { data, error } = await query;
  let cases: CaseRecord[];

  if (!error && data) {
    cases = data as CaseRecord[];
    const currentUser = getStoredUser();
    if (isSuperAdminOrFinance(currentUser) && cases.length > 0) {
      const pcIds = [...new Set(cases.map((c) => c.project_code_id).filter(Boolean))];
      if (pcIds.length > 0) {
        try {
          const { data: quotes } = await supabase
            .schema('finance')
            .from('quotations')
            .select('*')
            .in('project_code_id', pcIds);
          if (quotes && quotes.length > 0) {
            const qMap = new Map<string, any>();
            quotes.forEach((q) => qMap.set(q.project_code_id, q));
            cases = cases.map((c) => ({
              ...c,
              quotation: qMap.get(c.project_code_id) || undefined,
            }));
          }
        } catch {
          // ignore
        }
      }
    }
  } else {
    // Fallback to separate queries
    let fallbackQuery = litigatorDb
      .from('cases')
      .select('*')
      .order('next_hearing_date', { ascending: true, nullsFirst: false });

    if (filters?.stage) fallbackQuery = fallbackQuery.eq('current_stage', filters.stage);
    if (filters?.court) fallbackQuery = fallbackQuery.ilike('court', `%${filters.court}%`);
    if (filters?.leadUserId) fallbackQuery = fallbackQuery.eq('lead_user_id', filters.leadUserId);
    if (filters?.dateRange?.start) fallbackQuery = fallbackQuery.gte('next_hearing_date', filters.dateRange.start);
    if (filters?.dateRange?.end) fallbackQuery = fallbackQuery.lte('next_hearing_date', filters.dateRange.end);

    const { data: rawCases, error: cErr } = await fallbackQuery;
    if (cErr) throw cErr;
    cases = await enrichCases(rawCases || []);
  }

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

  if (!filters?.includePreLitigation) {
    cases = cases.filter((c) => c.case_type !== 'PRE_LITIGATION');
  }

  return cases;
}

export async function fetchCaseById(id: string): Promise<CaseRecord> {
  const currentUser = getStoredUser();
  let theCase: CaseRecord;

  const { data, error } = await litigatorDb
    .from('cases_view')
    .select('*')
    .eq('id', id)
    .single();

  if (!error && data) {
    theCase = data as CaseRecord;
  } else {
    // Fallback to separate queries
    const { data: rawCase, error: cErr } = await litigatorDb
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();
    if (cErr) throw cErr;

    const [enriched] = await enrichCases([rawCase]);
    theCase = enriched;
  }

  if (theCase && isSuperAdminOrFinance(currentUser) && theCase.project_code_id) {
    try {
      const { data: quote } = await supabase
        .schema('finance')
        .from('quotations')
        .select('*')
        .eq('project_code_id', theCase.project_code_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (quote) {
        theCase.quotation = quote as QuotationRecord;
      }
    } catch {
      // ignore
    }
  }

  return theCase;
}

export async function fetchQuotationByProjectCode(projectCodeId: string): Promise<QuotationRecord | null> {
  const currentUser = getStoredUser();
  if (!isSuperAdminOrFinance(currentUser)) return null;

  try {
    const { data, error } = await supabase
      .schema('finance')
      .from('quotations')
      .select('*')
      .eq('project_code_id', projectCodeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as QuotationRecord;
  } catch {
    return null;
  }
}

export async function saveCaseQuotation(params: {
  projectCodeId: string;
  clientId?: string;
  quoteNumber?: string;
  totalProfFee: number;
  notes?: string;
}): Promise<QuotationRecord> {
  const { data: existing } = await supabase
    .schema('finance')
    .from('quotations')
    .select('id')
    .eq('project_code_id', params.projectCodeId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .schema('finance')
      .from('quotations')
      .update({
        total_prof_fee: params.totalProfFee,
        quote_number: params.quoteNumber || null,
        notes: params.notes || null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as QuotationRecord;
  } else {
    const { data, error } = await supabase
      .schema('finance')
      .from('quotations')
      .insert({
        project_code_id: params.projectCodeId,
        client_id: params.clientId || null,
        quote_number: params.quoteNumber || null,
        total_prof_fee: params.totalProfFee,
        status: 'CONFIRMED',
        notes: params.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as QuotationRecord;
  }
}

export async function deleteCaseQuotation(projectCodeId: string): Promise<void> {
  const { error } = await supabase
    .schema('finance')
    .from('quotations')
    .delete()
    .eq('project_code_id', projectCodeId);
  if (error) {
    console.warn('Could not delete quotation from finance schema:', error.message);
  }
}

export interface CreateCaseParams {
  projectCode: string;
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
  claimValue?: number;
  courtFee?: number;
  oppositePartyName?: string;
  clientId?: string;
  newClientName?: string;
  newClientCode?: string;
  quotationAmount?: number;
  quotationNumber?: string;
}

export async function createCase(params: CreateCaseParams): Promise<{ id: string }> {
  let resolvedClientId = params.clientId || null;
  let resolvedNewClientName = params.newClientName || null;
  let resolvedNewClientCode = params.newClientCode || null;

  // Universal client duplicate prevention across connected dashboards:
  if (resolvedNewClientName) {
    const cleanName = resolvedNewClientName.trim();
    const cleanCode = (resolvedNewClientCode || '').trim().toUpperCase();

    try {
      let existingClient = null;
      const { data: byName } = await coreDb
        .from('clients')
        .select('id, client_name, client_code')
        .ilike('client_name', cleanName)
        .limit(1)
        .maybeSingle();

      if (byName) {
        existingClient = byName;
      } else if (cleanCode) {
        const { data: byCode } = await coreDb
          .from('clients')
          .select('id, client_name, client_code')
          .eq('client_code', cleanCode)
          .limit(1)
          .maybeSingle();
        if (byCode) existingClient = byCode;
      }

      if (existingClient) {
        resolvedClientId = existingClient.id;
        resolvedNewClientName = null;
        resolvedNewClientCode = null;
      }
    } catch (e) {
      console.warn('Existing client check error:', e);
    }
  }

  const { data, error } = await supabase.schema('litigator').rpc('create_case', {
    p_project_code: params.projectCode,
    p_case_type: params.caseType,
    p_court: params.court,
    p_cause_title: params.causeTitle,
    p_client_role: params.clientRole,
    p_client_id: resolvedClientId,
    p_new_client_name: resolvedNewClientName,
    p_new_client_code: resolvedNewClientCode,
    p_bench: params.bench || null,
    p_case_number: params.caseNumber || null,
    p_cnr_number: params.cnrNumber || null,
    p_filing_date: params.filingDate || null,
    p_current_stage: params.currentStage || 'Suit filed',
    p_lead_user_id: params.leadUserId || null,
    p_claim_value: params.claimValue ?? null,
    p_court_fee: params.courtFee ?? null,
    p_next_hearing_date: params.nextHearingDate || null,
    p_next_purpose: params.nextPurpose || null,
    p_opposite_party_name: params.oppositePartyName || null,
  });

  if (error) throw error;
  const caseId = data as string;

  if (resolvedNewClientName) {
    await syncClientToIpLedger(resolvedNewClientName);
  }

  if (params.quotationAmount && isSuperAdminOrFinance(getStoredUser())) {
    try {
      const created = await fetchCaseById(caseId);
      if (created.project_code_id) {
        await saveCaseQuotation({
          projectCodeId: created.project_code_id,
          clientId: created.project_code?.client_id,
          quoteNumber: params.quotationNumber || `Q-${params.projectCode}`,
          totalProfFee: Number(params.quotationAmount),
        });
      }
    } catch (e) {
      console.warn('Could not save quotation on new case:', e);
    }
  }

  return { id: caseId };
}

export async function updateCase(
  caseId: string,
  updates: Partial<CaseRecord>
): Promise<CaseRecord> {
  const { error } = await litigatorDb
    .from('cases')
    .update(updates)
    .eq('id', caseId);
  if (error) throw error;
  return fetchCaseById(caseId);
}

// ==========================================
// 4. CASE SUB-ENTITIES: HEARINGS, ORDERS, PARTIES, NOTES, LINKED IP
// ==========================================

export async function fetchHearings(caseId: string): Promise<HearingRecord[]> {
  let list: HearingRecord[] = [];
  const { data, error } = await litigatorDb
    .from('hearings_view')
    .select('*')
    .eq('case_id', caseId)
    .order('hearing_date', { ascending: false });

  if (!error && data) {
    list = data as HearingRecord[];
  } else {
    const { data: rawH, error: hErr } = await litigatorDb
      .from('hearings')
      .select('*')
      .eq('case_id', caseId)
      .order('hearing_date', { ascending: false });
    if (hErr) throw hErr;
    list = await enrichHearings(rawH || []);
  }

  // Deduplicate by hearing_date: if multiple records exist on the same date, prefer the one with an outcome
  const dateMap = new Map<string, HearingRecord>();
  for (const h of list) {
    const existing = dateMap.get(h.hearing_date);
    if (!existing) {
      dateMap.set(h.hearing_date, h);
    } else {
      const existingHasOutcome = Boolean(existing.outcome && existing.outcome.trim());
      const currentHasOutcome = Boolean(h.outcome && h.outcome.trim());
      if (!existingHasOutcome && currentHasOutcome) {
        dateMap.set(h.hearing_date, h);
      }
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(b.hearing_date).getTime() - new Date(a.hearing_date).getTime()
  );
}

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
  expense?: {
    amount: number;
    category: string;
    description?: string;
    billable?: boolean;
  } | null;
}) {
  let hearingId = params.hearingId;

  // 1. If hearingId not provided, search if a hearing already exists for this case and date
  if (!hearingId) {
    const { data: existingHearing } = await litigatorDb
      .from('hearings')
      .select('id, outcome')
      .eq('case_id', params.caseId)
      .eq('hearing_date', params.hearingDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingHearing) {
      hearingId = existingHearing.id;
    }
  }

  // Update or create the current hearing row
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

  // Clean up any other lingering duplicate hearing rows on the same date with outcome IS NULL
  try {
    await litigatorDb
      .from('hearings')
      .update({ outcome: params.outcome })
      .eq('case_id', params.caseId)
      .eq('hearing_date', params.hearingDate)
      .is('outcome', null);
  } catch {
    // ignore
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

  // 4b. Record stage expense if logged with this hearing outcome
  if (params.expense && Number(params.expense.amount) > 0 && theCase.project_code_id) {
    try {
      await saveStageExpense({
        projectCodeId: theCase.project_code_id,
        amount: Number(params.expense.amount),
        category: params.expense.category || 'Documentation',
        description:
          params.expense.description ||
          `Expense incurred during hearing for ${params.purpose}: ${params.outcome || 'Hearing attended'}`,
        stage: theCase.current_stage || 'Hearing',
        hearing_id: hearingId,
        billable: params.expense.billable !== false,
        date: params.hearingDate,
      });
    } catch (expErr) {
      console.warn('Could not record stage expense for hearing:', expErr);
    }
  }

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

export async function createHearing(hearing: {
  case_id: string;
  hearing_date: string;
  purpose?: string | null;
  outcome?: string | null;
  next_date?: string | null;
  next_purpose?: string | null;
  attended_by?: string | null;
  order_document_id?: string | null;
}): Promise<HearingRecord> {
  const { data, error } = await litigatorDb
    .from('hearings')
    .insert({
      case_id: hearing.case_id,
      hearing_date: hearing.hearing_date,
      purpose: hearing.purpose || 'Hearing',
      outcome: hearing.outcome || null,
      next_date: hearing.next_date || null,
      next_purpose: hearing.next_purpose || null,
      attended_by: hearing.attended_by || null,
      order_document_id: hearing.order_document_id || null,
    })
    .select()
    .single();
  if (error) throw error;

  if (hearing.next_date) {
    try {
      await litigatorDb
        .from('cases')
        .update({
          next_hearing_date: hearing.next_date,
          next_purpose: hearing.next_purpose || null,
        })
        .eq('id', hearing.case_id);
    } catch {
      // ignore
    }
  }

  const [enriched] = await enrichHearings([data]);
  return enriched;
}

export async function updateHearing(
  hearingId: string,
  updates: Partial<HearingRecord>
): Promise<HearingRecord> {
  const payload: Record<string, any> = {};
  if (updates.hearing_date !== undefined) payload.hearing_date = updates.hearing_date;
  if (updates.purpose !== undefined) payload.purpose = updates.purpose;
  if (updates.outcome !== undefined) payload.outcome = updates.outcome;
  if (updates.next_date !== undefined) payload.next_date = updates.next_date;
  if (updates.next_purpose !== undefined) payload.next_purpose = updates.next_purpose;
  if (updates.attended_by !== undefined) payload.attended_by = updates.attended_by;
  if (updates.order_document_id !== undefined) payload.order_document_id = updates.order_document_id;

  const { data, error } = await litigatorDb
    .from('hearings')
    .update(payload)
    .eq('id', hearingId)
    .select()
    .single();
  if (error) throw error;

  if (updates.case_id && updates.next_date) {
    try {
      await litigatorDb
        .from('cases')
        .update({
          next_hearing_date: updates.next_date,
          next_purpose: updates.next_purpose || null,
        })
        .eq('id', updates.case_id);
    } catch {
      // ignore
    }
  }

  const [enriched] = await enrichHearings([data]);
  return enriched;
}

export async function deleteHearing(hearingId: string): Promise<void> {
  const { error } = await litigatorDb
    .from('hearings')
    .delete()
    .eq('id', hearingId);
  if (error) throw error;
}

export async function fetchOrders(caseId: string): Promise<OrderRecord[]> {
  const { data, error } = await litigatorDb
    .from('orders_view')
    .select('*')
    .eq('case_id', caseId)
    .order('order_date', { ascending: false });

  if (!error && data) {
    return data as OrderRecord[];
  }

  const { data: rawO, error: oErr } = await litigatorDb
    .from('orders')
    .select('*')
    .eq('case_id', caseId)
    .order('order_date', { ascending: false });
  if (oErr) throw oErr;
  return enrichOrders(rawO || []);
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

export async function updateOrder(
  orderId: string,
  updates: Partial<OrderRecord>
): Promise<OrderRecord> {
  const payload: Record<string, any> = {};
  if (updates.order_date !== undefined) payload.order_date = updates.order_date;
  if (updates.order_type !== undefined) payload.order_type = updates.order_type;
  if (updates.summary !== undefined) payload.summary = updates.summary;
  if (updates.compliance_required !== undefined) payload.compliance_required = updates.compliance_required;
  if (updates.compliance_due !== undefined) payload.compliance_due = updates.compliance_due;
  if (updates.compliance_owner !== undefined) payload.compliance_owner = updates.compliance_owner;
  if (updates.document_id !== undefined) payload.document_id = updates.document_id;

  const { data, error } = await litigatorDb
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  const [enriched] = await enrichOrders([data]);
  return enriched;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await litigatorDb
    .from('orders')
    .delete()
    .eq('id', orderId);
  if (error) throw error;
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

export async function updateParty(
  partyId: string,
  updates: Partial<CasePartyRecord>
): Promise<CasePartyRecord> {
  const { data, error } = await litigatorDb
    .from('case_parties')
    .update({
      name: updates.name,
      side: updates.side,
      party_role: updates.party_role,
      counsel_name: updates.counsel_name,
    })
    .eq('id', partyId)
    .select()
    .single();
  if (error) throw error;
  return data as CasePartyRecord;
}

export async function deleteParty(partyId: string): Promise<void> {
  const { error } = await litigatorDb
    .from('case_parties')
    .delete()
    .eq('id', partyId);
  if (error) throw error;
}

export async function fetchInternalNotes(caseId: string): Promise<InternalNoteRecord[]> {
  const { data, error } = await litigatorDb
    .from('internal_notes_view')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return data as InternalNoteRecord[];
  }

  const { data: rawN, error: nErr } = await litigatorDb
    .from('internal_notes')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (nErr) throw nErr;
  return enrichInternalNotes(rawN || []);
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

export async function updateInternalNote(noteId: string, noteText: string): Promise<void> {
  const { error } = await litigatorDb
    .from('internal_notes')
    .update({ note: noteText })
    .eq('id', noteId);
  if (error) throw error;
}

export async function deleteInternalNote(noteId: string): Promise<void> {
  const { error } = await litigatorDb
    .from('internal_notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}

export async function fetchLinkedIP(caseId: string): Promise<LinkedIPRecord[]> {
  const { data, error } = await litigatorDb
    .from('linked_ip_view')
    .select('*')
    .eq('case_id', caseId);

  if (!error && data) {
    return data as LinkedIPRecord[];
  }

  const { data: rawL, error: lErr } = await litigatorDb
    .from('linked_ip')
    .select('*')
    .eq('case_id', caseId);
  if (lErr) throw lErr;
  return enrichLinkedIP(rawL || []);
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

export async function deleteLinkedIP(id: string): Promise<void> {
  const { error } = await litigatorDb
    .from('linked_ip')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ==========================================
// 5. DEADLINES
// ==========================================

export async function fetchDeadlines(filters?: {
  caseId?: string;
  agreementId?: string;
  ownerId?: string;
  status?: 'OPEN' | 'DONE';
}): Promise<DeadlineRecord[]> {
  let query = litigatorDb
    .from('deadlines_view')
    .select('*')
    .order('due_date', { ascending: true });

  if (filters?.caseId) query = query.eq('case_id', filters.caseId);
  if (filters?.agreementId) query = query.eq('agreement_id', filters.agreementId);
  if (filters?.ownerId) query = query.eq('owner_user_id', filters.ownerId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (!error && data) {
    return data as DeadlineRecord[];
  }

  let fallbackQuery = litigatorDb
    .from('deadlines')
    .select('*')
    .order('due_date', { ascending: true });

  if (filters?.caseId) fallbackQuery = fallbackQuery.eq('case_id', filters.caseId);
  if (filters?.agreementId) fallbackQuery = fallbackQuery.eq('agreement_id', filters.agreementId);
  if (filters?.ownerId) fallbackQuery = fallbackQuery.eq('owner_user_id', filters.ownerId);
  if (filters?.status) fallbackQuery = fallbackQuery.eq('status', filters.status);

  const { data: rawD, error: dErr } = await fallbackQuery;
  if (dErr) throw dErr;
  return enrichDeadlines(rawD || []);
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

export async function updateDeadline(
  deadlineId: string,
  updates: Partial<DeadlineRecord>
): Promise<DeadlineRecord> {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;
  if (updates.deadline_type !== undefined) payload.deadline_type = updates.deadline_type;
  if (updates.owner_user_id !== undefined) payload.owner_user_id = updates.owner_user_id;
  if (updates.backup_user_id !== undefined) payload.backup_user_id = updates.backup_user_id;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.done_note !== undefined) payload.done_note = updates.done_note;

  const { data, error } = await litigatorDb
    .from('deadlines')
    .update(payload)
    .eq('id', deadlineId)
    .select()
    .single();
  if (error) throw error;
  const [enriched] = await enrichDeadlines([data]);
  return enriched;
}

export async function deleteDeadline(deadlineId: string): Promise<void> {
  const { error } = await litigatorDb
    .from('deadlines')
    .delete()
    .eq('id', deadlineId);
  if (error) throw error;
}

// ==========================================
// 6. AGREEMENTS & CONTRACTS
// ==========================================

export async function fetchAgreements(filters?: {
  stage?: string;
  agreementType?: string;
  leadUserId?: string;
  search?: string;
}): Promise<AgreementRecord[]> {
  let query = litigatorDb
    .from('agreements_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.stage) query = query.eq('stage', filters.stage);
  if (filters?.agreementType) query = query.eq('agreement_type', filters.agreementType);
  if (filters?.leadUserId) query = query.eq('lead_user_id', filters.leadUserId);

  const { data, error } = await query;
  let list: AgreementRecord[];

  if (!error && data) {
    list = data as AgreementRecord[];
  } else {
    let fallbackQuery = litigatorDb
      .from('agreements')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.stage) fallbackQuery = fallbackQuery.eq('stage', filters.stage);
    if (filters?.agreementType) fallbackQuery = fallbackQuery.eq('agreement_type', filters.agreementType);
    if (filters?.leadUserId) fallbackQuery = fallbackQuery.eq('lead_user_id', filters.leadUserId);

    const { data: rawAgrs, error: aErr } = await fallbackQuery;
    if (aErr) throw aErr;
    list = await enrichAgreements(rawAgrs || []);
  }

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
    .from('agreements_view')
    .select('*')
    .eq('id', id)
    .single();

  if (!error && data) {
    return data as AgreementRecord;
  }

  const { data: rawAgr, error: aErr } = await litigatorDb
    .from('agreements')
    .select('*')
    .eq('id', id)
    .single();
  if (aErr) throw aErr;

  const [enriched] = await enrichAgreements([rawAgr]);
  return enriched;
}

export interface CreateAgreementParams {
  projectCode: string;
  agreementType: string;
  title: string;
  clientId?: string;
  newClientName?: string;
  newClientCode?: string;
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
  counterpartyName?: string;
}

export async function createAgreement(params: CreateAgreementParams): Promise<{ id: string }> {
  let resolvedClientId = params.clientId || null;
  let resolvedNewClientName = params.newClientName || null;
  let resolvedNewClientCode = params.newClientCode || null;

  // If a new client name is provided, check if client already exists universally
  if (params.newClientName?.trim()) {
    const cleanName = params.newClientName.trim();
    const cleanCode = params.newClientCode?.trim()?.toUpperCase();
    try {
      let existingClient = null;
      const { data: byName } = await coreDb
        .from('clients')
        .select('id, client_name, client_code')
        .ilike('client_name', cleanName)
        .limit(1)
        .maybeSingle();

      if (byName) {
        existingClient = byName;
      } else if (cleanCode) {
        const { data: byCode } = await coreDb
          .from('clients')
          .select('id, client_name, client_code')
          .eq('client_code', cleanCode)
          .limit(1)
          .maybeSingle();
        if (byCode) existingClient = byCode;
      }

      if (existingClient) {
        resolvedClientId = existingClient.id;
        resolvedNewClientName = null;
        resolvedNewClientCode = null;
      }
    } catch (e) {
      console.warn('Existing client check error in createAgreement:', e);
    }
  }

  const { data, error } = await supabase.schema('litigator').rpc('create_agreement', {
    p_project_code: params.projectCode,
    p_agreement_type: params.agreementType,
    p_title: params.title,
    p_client_id: resolvedClientId,
    p_new_client_name: resolvedNewClientName,
    p_new_client_code: resolvedNewClientCode,
    p_client_side: params.clientSide || 'FIRST_PARTY',
    p_stage: params.stage || 'INTAKE',
    p_lead_user_id: params.leadUserId || null,
    p_reviewer_user_id: params.reviewerUserId || null,
    p_governing_law: params.governingLaw || null,
    p_key_terms: params.keyTerms || null,
    p_execution_date: params.executionDate || null,
    p_effective_date: params.effectiveDate || null,
    p_expiry_date: params.expiryDate || null,
    p_renewal_type: params.renewalType || 'NONE',
    p_notice_days: params.noticeDays ?? null,
    p_stamp_duty: params.stampDuty ?? null,
    p_stamp_ref: params.stampRef || null,
    p_registration_required: Boolean(params.registrationRequired),
    p_registration_no: params.registrationNo || null,
    p_counterparty_name: params.counterpartyName || null,
  });

  if (error) throw error;
  const agreementId = data as string;

  if (resolvedNewClientName) {
    await syncClientToIpLedger(resolvedNewClientName);
  }

  return { id: agreementId };
}

export async function updateAgreementStage(
  agreementId: string,
  newStage: AgreementStage,
  extraParams?: { executionDate?: string }
): Promise<AgreementRecord> {
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

  const { error } = await litigatorDb
    .from('agreements')
    .update(updatePayload)
    .eq('id', agreementId);

  if (error) throw error;

  const updated = await fetchAgreementById(agreementId);

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
    .from('agreement_versions_view')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('version_no', { ascending: false });

  if (!error && data) {
    return data as AgreementVersionRecord[];
  }

  const { data: rawV, error: vErr } = await litigatorDb
    .from('agreement_versions')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('version_no', { ascending: false });
  if (vErr) throw vErr;
  return enrichAgreementVersions(rawV || []);
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
// 7. TEMPLATES
// ==========================================

export async function fetchTemplates(agreementType?: string): Promise<TemplateRecord[]> {
  let query = litigatorDb
    .from('templates_view')
    .select('*')
    .order('name');
  if (agreementType) query = query.eq('agreement_type', agreementType);
  const { data, error } = await query;
  if (!error && data) {
    return data as TemplateRecord[];
  }

  let fallbackQuery = litigatorDb
    .from('templates')
    .select('*')
    .order('name');
  if (agreementType) fallbackQuery = fallbackQuery.eq('agreement_type', agreementType);
  const { data: rawT, error: tErr } = await fallbackQuery;
  if (tErr) throw tErr;
  return enrichTemplates(rawT || []);
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
// 8. DAILY CAUSE LIST & CALENDAR
// ==========================================

export async function fetchDailyCauseList(dateStr: string) {
  const { data, error } = await litigatorDb
    .from('hearings_view')
    .select('*')
    .eq('hearing_date', dateStr)
    .order('purpose');

  if (!error && data) {
    return data as any[];
  }

  const { data: rawH, error: hErr } = await litigatorDb
    .from('hearings')
    .select('*')
    .eq('hearing_date', dateStr)
    .order('purpose');
  if (hErr) throw hErr;
  return enrichHearings(rawH || []);
}

export async function fetchCalendarEvents(monthStart: string, monthEnd: string) {
  const [hRes, dRes] = await Promise.all([
    litigatorDb
      .from('hearings_view')
      .select('*')
      .gte('hearing_date', monthStart)
      .lte('hearing_date', monthEnd),
    litigatorDb
      .from('deadlines_view')
      .select('*')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd),
  ]);

  let hearings = hRes.data;
  let deadlines = dRes.data;

  if (hRes.error || !hearings) {
    const { data: rawH } = await litigatorDb
      .from('hearings')
      .select('*')
      .gte('hearing_date', monthStart)
      .lte('hearing_date', monthEnd);
    hearings = await enrichHearings(rawH || []);
  }

  if (dRes.error || !deadlines) {
    const { data: rawD } = await litigatorDb
      .from('deadlines')
      .select('*')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd);
    deadlines = await enrichDeadlines(rawD || []);
  }

  return {
    hearings: (hearings || []) as any[],
    deadlines: (deadlines || []) as any[],
  };
}

// ==========================================
// 9. TODAY DASHBOARD
// ==========================================

export async function fetchTodayDashboard(todayStr: string, next7Days: string) {
  // 1. Hearings
  let hData: any[] | null = null;
  const { data: vH, error: vHErr } = await litigatorDb
    .from('hearings_view')
    .select('*')
    .gte('hearing_date', todayStr)
    .lte('hearing_date', next7Days)
    .order('hearing_date', { ascending: true });

  if (!vHErr && vH) {
    hData = vH;
  } else {
    const { data: rawH } = await litigatorDb
      .from('hearings')
      .select('*')
      .gte('hearing_date', todayStr)
      .lte('hearing_date', next7Days)
      .order('hearing_date', { ascending: true });
    hData = await enrichHearings(rawH || []);
  }

  // 2. Unupdated past hearings
  let unData: any[] | null = null;
  const { data: vUn, error: vUnErr } = await litigatorDb
    .from('hearings_view')
    .select('*')
    .lte('hearing_date', todayStr)
    .is('outcome', null)
    .order('hearing_date', { ascending: false });

  if (!vUnErr && vUn) {
    unData = vUn;
  } else {
    const { data: rawUn } = await litigatorDb
      .from('hearings')
      .select('*')
      .lte('hearing_date', todayStr)
      .is('outcome', null)
      .order('hearing_date', { ascending: false });
    unData = await enrichHearings(rawUn || []);
  }

  // 3. Deadlines
  let dData: any[] | null = null;
  const { data: vD, error: vDErr } = await litigatorDb
    .from('deadlines_view')
    .select('*')
    .eq('status', 'OPEN')
    .order('due_date', { ascending: true });

  if (!vDErr && vD) {
    dData = vD;
  } else {
    const { data: rawD } = await litigatorDb
      .from('deadlines')
      .select('*')
      .eq('status', 'OPEN')
      .order('due_date', { ascending: true });
    dData = await enrichDeadlines(rawD || []);
  }

  // 4. Pending orders
  let oData: any[] | null = null;
  const { data: vO, error: vOErr } = await litigatorDb
    .from('orders_view')
    .select('*')
    .eq('compliance_required', true)
    .order('compliance_due', { ascending: true });

  if (!vOErr && vO) {
    oData = vO;
  } else {
    const { data: rawO } = await litigatorDb
      .from('orders')
      .select('*')
      .eq('compliance_required', true)
      .order('compliance_due', { ascending: true });
    oData = await enrichOrders(rawO || []);
  }

  const allH = hData || [];
  const allD = dData || [];

  const rawUnupdated = unData || [];

  // Deduplicate and filter out hearings where an outcome is already logged on that date for that case
  const caseIds = Array.from(new Set(rawUnupdated.map((h: any) => h.case_id).filter(Boolean)));
  let loggedHearings: any[] = [];
  if (caseIds.length > 0) {
    const { data: loggedH } = await litigatorDb
      .from('hearings')
      .select('case_id, hearing_date, outcome')
      .in('case_id', caseIds)
      .not('outcome', 'is', null);
    loggedHearings = (loggedH || []).filter(
      (h: any) => h.outcome && typeof h.outcome === 'string' && h.outcome.trim() !== ''
    );
  }

  const seenKeys = new Set<string>();
  const filteredUnupdated = rawUnupdated.filter((h: any) => {
    // 1. If hearing has an outcome, skip
    if (h.outcome && typeof h.outcome === 'string' && h.outcome.trim() !== '') {
      return false;
    }
    // 2. If another hearing record exists for this case on the same date with an outcome, skip
    const alreadyLoggedOnSameDate = loggedHearings.some(
      (lh: any) => lh.case_id === h.case_id && lh.hearing_date === h.hearing_date
    );
    if (alreadyLoggedOnSameDate) {
      return false;
    }
    // 3. Deduplicate multiple empty rows on the exact same case and date
    const key = `${h.case_id}_${h.hearing_date}`;
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);

    return true;
  });

  return {
    todayHearings: allH.filter((h: any) => h.hearing_date === todayStr),
    weekHearings: allH.filter((h: any) => h.hearing_date !== todayStr),
    unupdatedHearings: filteredUnupdated,
    overdueDeadlines: allD.filter((d: any) => d.due_date < todayStr),
    upcomingDeadlines: allD.filter((d: any) => d.due_date >= todayStr && d.due_date <= next7Days),
    pendingOrders: oData || [],
  };
}

export async function fetchClientNotes(projectCodeId: string): Promise<ClientNoteRecord[]> {
  const { data, error } = await coreDb
    .from('matter_events')
    .select(`
      *,
      actor_profile:actor_user_id (id, display_name, email, role)
    `)
    .eq('project_code_id', projectCodeId)
    .eq('client_visible', true)
    .eq('event_code', 'CLIENT_NOTE')
    .order('occurred_at', { ascending: false });

  if (error) {
    console.warn('Could not fetch client notes:', error.message);
    return [];
  }

  return (data || []).map((ev: any) => ({
    id: ev.id,
    project_code_id: ev.project_code_id,
    author: ev.actor_user_id,
    note: ev.detail || ev.title,
    client_visible: true,
    created_at: ev.occurred_at || ev.created_at,
    author_profile: ev.actor_profile,
  }));
}

export async function createClientNote(params: {
  projectCodeId: string;
  note: string;
  authorId: string;
}): Promise<void> {
  await recordMatterEvent({
    projectCodeId: params.projectCodeId,
    eventCode: 'CLIENT_NOTE',
    title: 'Client Note',
    detail: params.note,
    occurredAt: clock.nowISO(),
    actorUserId: params.authorId,
    clientVisible: true,
    clientLabel: 'Client Update',
  });
}

export async function updateClientNote(eventId: string, noteText: string): Promise<void> {
  const { error } = await coreDb
    .from('matter_events')
    .update({ detail: noteText, title: 'Client Note' })
    .eq('id', eventId);
  if (error) throw error;
}

export async function deleteClientNote(eventId: string): Promise<void> {
  const { error } = await coreDb
    .from('matter_events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

// ==========================================
// 10. MATTER EVENTS (TIMELINE)
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
  clientLabel?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const actorId = authData?.user?.id || params.actorUserId;
    if (!actorId) {
      console.warn('Cannot record matter event: actor_user_id is required by RLS');
      return;
    }

    const { error } = await coreDb.from('matter_events').insert({
      project_code_id: params.projectCodeId,
      event_code: params.eventCode || null,
      title: params.title,
      detail: params.detail || null,
      occurred_at: params.occurredAt || clock.nowISO(),
      actor_user_id: actorId,
      source_app: 'LITIGATOR',
      client_visible: params.clientVisible ?? false,
      client_label: params.clientLabel || null,
      metadata: params.metadata || {},
    });
    if (error) console.warn('Could not record core.matter_event:', error.message);
  } catch (e) {
    console.warn('Matter event insert error:', e);
  }
}

export async function createCustomMilestone(params: {
  projectCodeId: string;
  title: string;
  detail?: string;
  occurredAt: string;
  category?: string;
  actorUserId?: string;
}): Promise<void> {
  await recordMatterEvent({
    projectCodeId: params.projectCodeId,
    eventCode: params.category || 'MILESTONE',
    title: params.title,
    detail: params.detail,
    occurredAt: params.occurredAt,
    actorUserId: params.actorUserId,
    clientVisible: false,
    clientLabel: params.category || 'Milestone',
  });
}

export async function updateMatterEvent(
  eventId: string,
  updates: { title?: string; detail?: string; occurredAt?: string; eventCode?: string }
): Promise<void> {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.detail !== undefined) payload.detail = updates.detail;
  if (updates.occurredAt !== undefined) payload.occurred_at = updates.occurredAt;
  if (updates.eventCode !== undefined) payload.event_code = updates.eventCode;

  const { error } = await coreDb
    .from('matter_events')
    .update(payload)
    .eq('id', eventId);
  if (error) throw error;
}

export async function deleteMatterEvent(eventId: string): Promise<void> {
  const { error } = await coreDb
    .from('matter_events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

// ==========================================
// 10b. STAGE EXPENSES & LEGAL NOTICES
// ==========================================

export async function fetchCaseExpenses(projectCodeId: string): Promise<StageExpenseRecord[]> {
  if (!projectCodeId) return [];
  const { data, error } = await coreDb
    .from('matter_events')
    .select('*')
    .eq('project_code_id', projectCodeId)
    .eq('event_code', 'STAGE_EXPENSE')
    .order('occurred_at', { ascending: false });

  if (error) {
    console.warn('Could not fetch stage expenses:', error.message);
    return [];
  }

  let profileMap = new Map<string, string>();
  try {
    const profs = await fetchProfiles();
    profs.forEach((p) => profileMap.set(p.id, p.display_name));
  } catch {
    // ignore
  }

  return (data || []).map((row: any) => {
    const meta = row.metadata || {};
    return {
      id: row.id,
      amount: Number(meta.amount) || 0,
      category: meta.category || 'Other',
      description: meta.description || row.detail || '',
      stage: meta.stage || '',
      hearing_id: meta.hearing_id || '',
      billable: meta.billable !== false,
      date: (row.occurred_at || '').split('T')[0],
      created_at: row.created_at,
      actor_name: profileMap.get(row.actor_user_id) || 'Team Member',
    };
  });
}

export async function saveStageExpense(params: {
  projectCodeId: string;
  amount: number;
  category: string;
  description?: string;
  stage?: string;
  hearing_id?: string;
  billable?: boolean;
  date?: string;
}): Promise<StageExpenseRecord> {
  const stored = getStoredUser();
  const { data: authData } = await supabase.auth.getUser();
  const actorId =
    authData?.user?.id || stored?.id || '5b488b59-915c-4f02-b973-748cf9a46902';
  const occurredAt = params.date
    ? new Date(params.date).toISOString()
    : clock.nowISO();

  const amt = Number(params.amount) || 0;
  const stage = params.stage || 'General';
  const title = `Expense Incurred (${stage}): ₹${amt.toLocaleString('en-IN')} - ${params.category}`;
  const detail =
    params.description ||
    `${params.category} expense of ₹${amt.toLocaleString('en-IN')} logged for ${stage} stage. Billable to client: ${
      params.billable !== false ? 'Yes' : 'No'
    }.`;

  const { data, error } = await coreDb
    .from('matter_events')
    .insert({
      project_code_id: params.projectCodeId,
      event_code: 'STAGE_EXPENSE',
      title,
      detail,
      occurred_at: occurredAt,
      actor_user_id: actorId,
      source_app: 'LITIGATOR',
      client_visible: false,
      client_label: 'Stage Expense',
      metadata: {
        amount: amt,
        category: params.category,
        description: params.description || '',
        stage: params.stage || '',
        hearing_id: params.hearing_id || '',
        billable: params.billable !== false,
        expense_type: 'STAGE_EXPENSE',
      },
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to save stage expense:', error);
    throw error;
  }

  return {
    id: data.id,
    amount: amt,
    category: params.category,
    description: params.description || '',
    stage: params.stage || '',
    hearing_id: params.hearing_id || '',
    billable: params.billable !== false,
    date: (data.occurred_at || '').split('T')[0],
    created_at: data.created_at,
    actor_name: stored?.display_name || 'Team Member',
  };
}

export async function updateStageExpense(
  id: string,
  params: Partial<StageExpenseRecord>
): Promise<void> {
  const { data: current, error: getErr } = await coreDb
    .from('matter_events')
    .select('*')
    .eq('id', id)
    .single();

  if (getErr || !current) throw new Error('Expense record not found');

  const meta = {
    ...(current.metadata || {}),
    ...(params.amount !== undefined ? { amount: Number(params.amount) } : {}),
    ...(params.category !== undefined ? { category: params.category } : {}),
    ...(params.description !== undefined ? { description: params.description } : {}),
    ...(params.stage !== undefined ? { stage: params.stage } : {}),
    ...(params.billable !== undefined ? { billable: params.billable } : {}),
  };

  const amount = Number(meta.amount) || 0;
  const category = meta.category || 'Other';
  const stage = meta.stage || 'General';
  const title = `Expense Incurred (${stage}): ₹${amount.toLocaleString('en-IN')} - ${category}`;
  const detail =
    meta.description ||
    `${category} expense of ₹${amount.toLocaleString('en-IN')} logged for ${stage} stage. Billable: ${
      meta.billable !== false ? 'Yes' : 'No'
    }.`;

  const updatePayload: any = {
    title,
    detail,
    metadata: meta,
  };

  if (params.date) {
    updatePayload.occurred_at = new Date(params.date).toISOString();
  }

  const { error } = await coreDb
    .from('matter_events')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error('Failed to update stage expense:', error);
    throw error;
  }
}

export async function deleteStageExpense(id: string): Promise<void> {
  const { error } = await coreDb
    .from('matter_events')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete stage expense:', error);
    throw error;
  }
}

export async function fetchLegalNotices(filters?: {
  stage?: string;
  leadUserId?: string;
  clientId?: string;
  search?: string;
}): Promise<CaseRecord[]> {
  const allCases = await fetchCases({
    stage: filters?.stage,
    leadUserId: filters?.leadUserId,
    clientId: filters?.clientId,
    search: filters?.search,
    includePreLitigation: true,
  });

  return allCases.filter((c) => c.case_type === 'PRE_LITIGATION');
}

export async function convertNoticeToCourtCase(params: {
  caseId: string;
  courtName: string;
  bench?: string;
  caseNumber?: string;
  cnrNumber?: string;
  caseType: string;
  filingDate?: string;
  judgeName?: string;
  stage?: string;
}): Promise<CaseRecord> {
  const { data: updatedCase, error } = await litigatorDb
    .from('cases')
    .update({
      case_type: params.caseType,
      court: params.courtName,
      bench: params.bench || null,
      case_number: params.caseNumber || null,
      cnr_number: params.cnrNumber || null,
      filing_date: params.filingDate || clock.todayYMD(),
      judge_name: params.judgeName || null,
      current_stage: params.stage || 'Pleadings',
    })
    .eq('id', params.caseId)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to convert notice to court case:', error);
    throw error;
  }

  if (updatedCase.project_code_id) {
    await recordMatterEvent({
      projectCodeId: updatedCase.project_code_id,
      eventCode: 'NOTICE_CONVERTED',
      title: `Legal Notice Converted to Court Suit: ${params.courtName}`,
      detail: `Legal notice transitioned into formal court proceeding. Court: ${params.courtName}${
        params.bench ? ` (${params.bench})` : ''
      }. Case No: ${params.caseNumber || 'Pending'}${
        params.cnrNumber ? ` | CNR: ${params.cnrNumber}` : ''
      }. Date of filing: ${params.filingDate || clock.todayYMD()}`,
      occurredAt: params.filingDate ? new Date(params.filingDate).toISOString() : clock.nowISO(),
      clientVisible: true,
      clientLabel: 'Notice converted to court case',
      metadata: {
        previous_case_type: 'PRE_LITIGATION',
        converted_case_type: params.caseType,
        court_name: params.courtName,
        case_number: params.caseNumber,
      },
    });
  }

  return fetchCaseById(params.caseId);
}

export async function getNextProjectCode(department: string = 'LITIGATION'): Promise<string> {
  const prefix = department === 'AGREEMENTS' ? 'AG' : 'LC';
  try {
    const { data, error } = await coreDb
      .from('project_codes')
      .select('code')
      .like('code', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      return `${prefix}1`;
    }

    let maxNum = 0;
    for (const row of data) {
      const match = (row.code || '').match(/^(?:LC|AG)[-_\s]*(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    return `${prefix}${maxNum + 1}`;
  } catch {
    return `${prefix}1`;
  }
}

export async function syncCustomStagesFromDb(): Promise<string[]> {
  try {
    const { data } = await coreDb
      .from('event_codes')
      .select('description')
      .eq('domain', 'CASE_STAGE');

    if (data && data.length > 0) {
      const dbStages = data.map((r: any) => r.description).filter(Boolean);
      const localStages = getCustomCaseStages();
      const merged = Array.from(new Set([...localStages, ...dbStages]));
      saveCustomCaseStages(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Could not sync custom stages from DB:', err);
  }
  return getCustomCaseStages();
}

export async function persistCustomStageToDb(stageName: string): Promise<void> {
  const code = 'STAGE_' + stageName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  try {
    await coreDb.from('event_codes').upsert({
      code,
      domain: 'CASE_STAGE',
      description: stageName.trim(),
      default_client_label: stageName.trim(),
    });
  } catch (err) {
    console.warn('Could not persist custom stage to database:', err);
  }
}

export async function removeCustomStageFromDb(stageName: string): Promise<void> {
  const code = 'STAGE_' + stageName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  try {
    await coreDb.from('event_codes').delete().eq('code', code).eq('domain', 'CASE_STAGE');
  } catch (err) {
    console.warn('Could not remove custom stage from database:', err);
  }
}

// ==========================================
// 11. CLIQ NOTIFICATIONS & OUTBOX
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

// ==========================================
// 12. USER & TEAM MEMBER MANAGEMENT
// ==========================================

export async function createTeamUser(params: {
  email: string;
  password: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'FINANCE' | 'ASSOCIATE' | 'LITIGATION_ASSOCIATE' | 'AGREEMENTS_ASSOCIATE';
  department?: string;
}): Promise<CoreProfile> {
  const resp = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to create team member (${resp.status} ${resp.statusText}).`);
  }
  return data.profile as CoreProfile;
}

export async function deleteTeamUser(userId: string): Promise<void> {
  let apiSuccess = false;
  let apiErrorMessage: string | null = null;

  try {
    const resp = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data = await resp.json().catch(() => null);
    if (resp.ok && data?.success) {
      apiSuccess = true;
    } else {
      apiErrorMessage = data?.error || `Delete request returned status ${resp.status}`;
      console.warn('API user deletion issue:', apiErrorMessage);
    }
  } catch (err: any) {
    console.warn('Network call to /api/users failed:', err);
    apiErrorMessage = err?.message;
  }

  // Fallback: If serverless endpoint is not reachable (or if it fails),
  // immediately update active=false in core.profiles using the active Supabase session.
  // This guarantees the user is immediately removed from Settings and all dropdowns!
  if (!apiSuccess) {
    const { error: supaErr } = await coreDb
      .from('profiles')
      .update({ active: false })
      .eq('id', userId);

    if (supaErr) {
      throw new Error(apiErrorMessage || supaErr.message || 'Failed to remove team member.');
    }
  }
}

