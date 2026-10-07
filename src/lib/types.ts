// src/lib/types.ts
// Domain types for Lextria Litigator: COURT CASES and AGREEMENTS

export type CaseType =
  | 'CIVIL_SUIT'
  | 'COMMERCIAL_SUIT'
  | 'IP_INFRINGEMENT'
  | 'WRIT'
  | 'APPEAL'
  | 'ARBITRATION'
  | 'CONSUMER'
  | 'CRIMINAL_COMPLAINT'
  | 'PRE_LITIGATION'
  | 'OTHER';

export type ClientRole =
  | 'PLAINTIFF'
  | 'DEFENDANT'
  | 'PETITIONER'
  | 'RESPONDENT'
  | 'APPELLANT'
  | 'COMPLAINANT'
  | 'OTHER';

export const CASE_STAGES = [
  'Notice sent',
  'Notice served',
  'Suit filed',
  'Summons',
  'Written statement',
  'Interim application',
  'Evidence',
  'Final arguments',
  'Judgment',
  'Execution',
  'Appeal',
  'Settled',
  'Closed',
] as const;

export type CaseStage = typeof CASE_STAGES[number];

export interface CaseRecord {
  id: string;
  project_code_id: string;
  case_type: CaseType;
  court: string;
  bench?: string | null;
  case_number?: string | null;
  cnr_number?: string | null;
  filing_date?: string | null;
  cause_title: string;
  client_role: ClientRole;
  current_stage: CaseStage;
  next_hearing_date?: string | null;
  next_purpose?: string | null;
  lead_user_id?: string | null;
  ethical_wall: boolean;
  claim_value?: number | null;
  court_fee?: number | null;
  status: 'ACTIVE' | 'CLOSED';
  created_by?: string | null;
  created_at: string;

  // Joined relations
  project_code?: CoreProjectCode | null;
  lead_user?: CoreProfile | null;
  parties?: CasePartyRecord[];
}

export interface CaseTeamMember {
  id: string;
  case_id: string;
  user_id: string;
  role_in_team: string;
  created_by?: string | null;
  created_at: string;
  user?: CoreProfile | null;
}

export interface CasePartyRecord {
  id: string;
  case_id: string;
  name: string;
  side: 'OURS' | 'OPPOSITE' | 'OTHER';
  party_role: string;
  address?: string | null;
  counsel_name?: string | null;
  counsel_contact?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface HearingRecord {
  id: string;
  case_id: string;
  hearing_date: string;
  purpose: string;
  attended_by?: string | null;
  outcome?: string | null;
  next_date?: string | null;
  next_purpose?: string | null;
  order_document_id?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  attending_profile?: CoreProfile | null;
  case?: CaseRecord | null;
  order_document?: CoreDocument | null;
}

export interface OrderRecord {
  id: string;
  case_id: string;
  order_date: string;
  order_type: 'INTERIM' | 'FINAL' | 'PROCEDURAL' | 'COSTS' | 'OTHER';
  summary: string;
  document_id?: string | null;
  compliance_required: boolean;
  compliance_due?: string | null;
  compliance_owner?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  compliance_owner_profile?: CoreProfile | null;
  document?: CoreDocument | null;
}

export interface InternalNoteRecord {
  id: string;
  case_id: string;
  author: string;
  note: string;
  created_by?: string | null;
  created_at: string;

  // Joined
  author_profile?: CoreProfile | null;
}

export type DeadlineType = 'STATUTORY' | 'COURT_ORDERED' | 'INTERNAL' | 'RENEWAL';

export interface DeadlineRecord {
  id: string;
  case_id?: string | null;
  agreement_id?: string | null;
  title: string;
  due_date: string;
  deadline_type: DeadlineType;
  basis?: string | null;
  owner_user_id: string;
  backup_user_id: string;
  status: 'OPEN' | 'DONE';
  done_note?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  owner_profile?: CoreProfile | null;
  backup_profile?: CoreProfile | null;
  case?: CaseRecord | null;
  agreement?: AgreementRecord | null;
}

export interface LinkedIPRecord {
  id: string;
  case_id: string;
  project_code_id?: string | null;
  ip_reference: string;
  relation: 'ENFORCES' | 'DEFENDS' | 'CHALLENGES' | 'OTHER';
  created_by?: string | null;
  created_at: string;

  // Joined
  project_code?: CoreProjectCode | null;
}

export const AGREEMENT_TYPES = [
  'NDA',
  'MOU',
  'SERVICE',
  'CONSULTANCY',
  'EMPLOYMENT',
  'LICENCE',
  'ASSIGNMENT',
  'LEASE',
  'SHAREHOLDERS',
  'PARTNERSHIP',
  'DISTRIBUTION',
  'FRANCHISE',
  'SETTLEMENT',
  'OTHER',
] as const;

export type AgreementType = typeof AGREEMENT_TYPES[number];

export const AGREEMENT_STAGES = [
  'INTAKE',
  'DRAFTING',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'COUNTERPARTY_REVIEW',
  'NEGOTIATION',
  'FINALIZED',
  'EXECUTED',
  'STAMPED_REGISTERED',
  'EXPIRED',
  'TERMINATED',
  'ABANDONED',
] as const;

export type AgreementStage = typeof AGREEMENT_STAGES[number];

export interface AgreementRecord {
  id: string;
  project_code_id: string;
  agreement_type: AgreementType;
  title: string;
  client_side?: string | null;
  stage: AgreementStage;
  lead_user_id?: string | null;
  reviewer_user_id?: string | null;
  governing_law?: string | null;
  key_terms?: string | null;
  execution_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  renewal_type?: 'AUTO' | 'MANUAL' | 'NONE' | null;
  notice_days?: number | null;
  stamp_duty?: number | null;
  stamp_ref?: string | null;
  registration_required: boolean;
  registration_no?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  project_code?: CoreProjectCode | null;
  lead_user?: CoreProfile | null;
  reviewer_user?: CoreProfile | null;
  parties?: AgreementPartyRecord[];
  versions?: AgreementVersionRecord[];
}

export interface AgreementPartyRecord {
  id: string;
  agreement_id: string;
  name: string;
  party_role?: string | null;
  entity_type?: string | null;
  signatory?: string | null;
  designation?: string | null;
  email?: string | null;
  address?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface AgreementVersionRecord {
  id: string;
  agreement_id: string;
  version_no: number;
  document_id?: string | null;
  sent_to: 'INTERNAL' | 'CLIENT' | 'COUNTERPARTY' | 'FINAL';
  sent_at: string;
  change_summary?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  document?: CoreDocument | null;
}

export interface TemplateRecord {
  id: string;
  name: string;
  agreement_type: AgreementType;
  document_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined
  document?: CoreDocument | null;
}

export interface CliqOutboxItem {
  id: string;
  channel: string;
  title: string;
  link?: string | null;
  card?: any;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  error?: string | null;
  sent_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

// Core Schema Records
export interface CoreProfile {
  id: string;
  display_name: string;
  email: string;
  role: string;
  department: string;
  reports_to?: string | null;
  is_finance_lead: boolean;
  active: boolean;
}

export interface CoreClient {
  id: string;
  client_code: string;
  client_name: string;
  entity_type: string;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: string | null;
  state_code?: string | null;
}

export interface CoreProjectCode {
  id: string;
  code: string;
  code_normalized: string;
  prefix?: string | null;
  department: string;
  client_id: string;
  title: string;
  status: string;
  spoc_user_id?: string | null;
  lead_assignee_id?: string | null;
  owning_app: string;
  client?: CoreClient | null;
}

export interface CoreDocument {
  id: string;
  project_code_id?: string | null;
  category: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  zoho_resource_id?: string | null;
  zoho_permalink?: string | null;
  workdrive_path?: string | null;
  client_shared: boolean;
  finance_only: boolean;
  source_app: string;
  uploaded_by?: string | null;
  uploaded_at: string;
  created_at?: string;
}

export interface CoreMatterEvent {
  id: string;
  project_code_id: string;
  event_code?: string | null;
  title: string;
  detail?: string | null;
  occurred_at: string;
  actor_user_id?: string | null;
  source_app: string;
  client_visible: boolean;
  client_label?: string | null;
  metadata?: any;
  created_at: string;
  actor_profile?: CoreProfile | null;
}

export interface CoreNotification {
  id: string;
  user_id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  source_app: string;
  created_at: string;
  read_at?: string | null;
}
