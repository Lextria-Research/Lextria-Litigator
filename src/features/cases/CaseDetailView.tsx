// src/features/cases/CaseDetailView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scale,
  Calendar,
  Clock,
  Users,
  FolderLock,
  Link as LinkIcon,
  FileText,
  History,
  Shield,
  ShieldAlert,
  ExternalLink,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Upload,
  AlertCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Coins,
  Edit2,
  Trash2,
  Receipt,
  IndianRupee,
  Layers,
} from 'lucide-react';
import {
  fetchCaseById,
  updateCase,
  fetchHearings,
  deleteHearing,
  fetchOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  fetchParties,
  createParty,
  updateParty,
  deleteParty,
  fetchInternalNotes,
  createInternalNote,
  updateInternalNote,
  deleteInternalNote,
  fetchLinkedIP,
  createLinkedIP,
  deleteLinkedIP,
  fetchDeadlines,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  fetchMatterEvents,
  fetchProfiles,
  fetchClientNotes,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  saveCaseQuotation,
  fetchCaseExpenses,
  deleteStageExpense,
  fetchProjectCodes,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatINR, formatINRShort } from '../../lib/currency';
import {
  uploadLitigatorFile,
  fetchProjectDocuments,
  getDocumentUrl,
  LITIGATION_FILE_CATEGORIES,
} from '../../lib/files';
import { getStoredUser, isFinance, isSuperAdminOrFinance, canEditCaseData } from '../../lib/auth';
import {
  CASE_STAGES,
  CaseRecord,
  HearingRecord,
  OrderRecord,
  CasePartyRecord,
  InternalNoteRecord,
  ClientNoteRecord,
  LinkedIPRecord,
  DeadlineRecord,
  CoreMatterEvent,
  CoreProfile,
  CoreDocument,
  StageExpenseRecord,
  EXPENSE_CATEGORIES,
  getAllCaseStages,
  CoreProjectCode,
} from '../../lib/types';
import { UpdateHearingModal } from './UpdateHearingModal';
import { EditCaseModal } from './EditCaseModal';
import { EditOrderModal } from './EditOrderModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import { EditPartyModal } from './EditPartyModal';
import { AddMilestoneModal } from './AddMilestoneModal';
import { QuotationModal } from './QuotationModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { RecordExpenseModal } from './RecordExpenseModal';

type TabKey =
  | 'timeline'
  | 'parties'
  | 'deadlines'
  | 'hearings'
  | 'orders'
  | 'notes'
  | 'client_notes'
  | 'documents'
  | 'expenses'
  | 'linked_ip';

export const CaseDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const canViewQuotation = isSuperAdminOrFinance(currentUser);
  const canEdit = canEditCaseData(currentUser);

  const [theCase, setTheCase] = useState<CaseRecord | null>(null);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');

  // Sub-entity data states
  const [hearings, setHearings] = useState<HearingRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineRecord[]>([]);
  const [parties, setParties] = useState<CasePartyRecord[]>([]);
  const [documents, setDocuments] = useState<CoreDocument[]>([]);
  const [linkedIp, setLinkedIp] = useState<LinkedIPRecord[]>([]);
  const [notes, setNotes] = useState<InternalNoteRecord[]>([]);
  const [clientNotes, setClientNotes] = useState<ClientNoteRecord[]>([]);
  const [timeline, setTimeline] = useState<CoreMatterEvent[]>([]);

  // Edit Case Details modal state
  const [editCaseOpen, setEditCaseOpen] = useState(false);

  // Update hearing modal state
  const [updateHearingOpen, setUpdateHearingOpen] = useState(false);
  const [targetHearing, setTargetHearing] = useState<HearingRecord | null>(null);

  // Edit Order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState<OrderRecord | null>(null);

  // Edit Deadline modal state
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [targetDeadline, setTargetDeadline] = useState<DeadlineRecord | null>(null);

  // Edit Party modal state
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [targetParty, setTargetParty] = useState<CasePartyRecord | null>(null);

  // Timeline Milestone modal state
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [targetMilestone, setTargetMilestone] = useState<{
    id: string;
    date: string;
    title: string;
    detail?: string | null;
    category?: string;
  } | null>(null);

  // Quick form states
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);

  // Client notes form states
  const [newClientNoteTitle, setNewClientNoteTitle] = useState('');
  const [newClientNoteText, setNewClientNoteText] = useState('');
  const [addingClientNote, setAddingClientNote] = useState(false);
  const [editingClientNoteId, setEditingClientNoteId] = useState<string | null>(null);
  const [editingClientNoteText, setEditingClientNoteText] = useState('');
  const [savingClientNoteEdit, setSavingClientNoteEdit] = useState(false);

  // Quotation edit modal
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editingQuoteAmount, setEditingQuoteAmount] = useState<number | ''>('');
  const [editingQuoteNumber, setEditingQuoteNumber] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);

  // In-Dashboard Document Viewer Modal state
  const [viewingDocument, setViewingDocument] = useState<CoreDocument | null>(null);

  // New Deadline inline
  const [newDlTitle, setNewDlTitle] = useState('');
  const [newDlDate, setNewDlDate] = useState('');
  const [newDlType, setNewDlType] = useState('STATUTORY');
  const [newDlOwner, setNewDlOwner] = useState('');
  const [newDlBackup, setNewDlBackup] = useState('');
  const [addingDl, setAddingDl] = useState(false);

  // New Party inline
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartySide, setNewPartySide] = useState<'OURS' | 'OPPOSITE' | 'OTHER'>('OPPOSITE');
  const [newPartyRole, setNewPartyRole] = useState('Defendant No. 1');
  const [newPartyCounsel, setNewPartyCounsel] = useState('');
  const [addingParty, setAddingParty] = useState(false);

  // Connected Matters & Universal Inter-Project Linking state
  const [newIpRef, setNewIpRef] = useState('');
  const [newIpRelation, setNewIpRelation] = useState<'ENFORCES' | 'DEFENDS' | 'CHALLENGES' | 'OTHER'>('ENFORCES');
  const [selectedProjectCodeId, setSelectedProjectCodeId] = useState('');
  const [allProjectCodes, setAllProjectCodes] = useState<CoreProjectCode[]>([]);
  const [addingIp, setAddingIp] = useState(false);

  // Stage Expenses state
  const [expenses, setExpenses] = useState<StageExpenseRecord[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<StageExpenseRecord | null>(null);

  // Document upload state
  const [uploadCategory, setUploadCategory] = useState<string>('Pleadings');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Master Timeline: Only actual progressed case dates (hearings, orders, filing if set, completed deadlines).
  // Strictly zero entry dates or database insertion timestamps.
  // Must be called at top of component to respect React Rules of Hooks (cannot be after conditional returns).
  const progressEvents = React.useMemo(() => {
    if (!theCase) return [];
    const events: {
      id: string;
      date: string;
      title: string;
      detail?: string | null;
      category: 'FILING' | 'HEARING' | 'ORDER' | 'DEADLINE' | 'MILESTONE';
      badge: string;
      badgeColor: string;
      actor?: string | null;
    }[] = [];

    // 1. Filing Date: ONLY if explicitly set and non-empty. Never default to entry date.
    const fDate = typeof theCase.filing_date === 'string' ? theCase.filing_date.trim() : '';
    if (fDate) {
      const caseTypeDisplay = (theCase.case_type || 'Matter').replace(/_/g, ' ');
      events.push({
        id: `filing-${theCase.id}`,
        date: fDate,
        title: 'Case / Suit Filed in Court',
        detail: `${theCase.cause_title || 'Court Case'} formally instituted before ${theCase.court || 'Court'}${theCase.bench ? ` (${theCase.bench})` : ''}. Case Type: ${caseTypeDisplay}${theCase.case_number ? ` • Case No: ${theCase.case_number}` : ''}`,
        category: 'FILING',
        badge: 'CASE FILED',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
        actor: theCase.lead_user?.display_name,
      });
    }

    // 2. Hearings Progressed: by hearing_date
    hearings.forEach((h) => {
      if (!h.hearing_date) return;
      events.push({
        id: `hearing-${h.id}`,
        date: h.hearing_date,
        title: `Court Hearing: ${h.purpose || 'Proceedings'}`,
        detail: h.outcome
          ? `Outcome: ${h.outcome}${h.next_date ? ` (Next hearing scheduled: ${clock.formatDisplay(h.next_date)})` : ''}`
          : `Hearing scheduled${h.next_purpose ? ` for ${h.next_purpose}` : ''}. Outcome pending record.`,
        category: 'HEARING',
        badge: h.outcome ? 'HEARING COMPLETED' : 'HEARING SCHEDULED',
        badgeColor: h.outcome
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
        actor: h.attending_profile?.display_name,
      });
    });

    // 3. Orders Passed: by order_date
    orders.forEach((ord) => {
      if (!ord.order_date) return;
      events.push({
        id: `order-${ord.id}`,
        date: ord.order_date,
        title: `Court Order Passed: ${ord.order_type || 'Order'}`,
        detail: ord.summary,
        category: 'ORDER',
        badge: 'COURT ORDER',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
        actor: ord.compliance_owner_profile?.display_name,
      });
    });

    // 4. Completed Statutory Deadlines: by due_date
    deadlines
      .filter((dl) => dl.status === 'DONE' && dl.due_date)
      .forEach((dl) => {
        events.push({
          id: `deadline-${dl.id}`,
          date: dl.due_date,
          title: `Statutory Deadline Met: ${dl.title}`,
          detail: `Type: ${dl.deadline_type}. Owner: ${dl.owner_profile?.display_name || 'Assigned Counsel'}`,
          category: 'DEADLINE',
          badge: 'COMPLIANCE MET',
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
          actor: dl.owner_profile?.display_name,
        });
      });

    // 5. Genuine cross-app progress milestones (filter out synthetic case creation / entry events)
    timeline.forEach((ev) => {
      if (
        ev.event_code === 'CASE_CREATED' ||
        ev.event_code === 'ENTRY_CREATED' ||
        ev.event_code === 'SUIT_FILED' ||
        ev.title?.toLowerCase().includes('created') ||
        ev.title?.toLowerCase().includes('docket created')
      ) {
        return;
      }
      if (ev.occurred_at) {
        events.push({
          id: `timeline-${ev.id}`,
          date: ev.occurred_at,
          title: ev.title,
          detail: ev.detail,
          category: 'MILESTONE',
          badge: ev.event_code || ev.source_app || 'PROGRESS',
          badgeColor: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          actor: ev.actor_profile?.display_name,
        });
      }
    });

    // Sort strictly descending by actual progress date
    return events.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [theCase, hearings, orders, deadlines, timeline]);

  // Expenses sums
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const billableExpenses = useMemo(() => {
    return expenses.filter((e) => e.billable).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const nonBillableExpenses = useMemo(() => {
    return totalExpenses - billableExpenses;
  }, [totalExpenses, billableExpenses]);

  // Active quotation document (if any uploaded under Quotation category or file name)
  const quotationDoc = useMemo(() => {
    return (
      documents.find(
        (d) =>
          d.category?.toLowerCase() === 'quotation' ||
          d.file_name.toLowerCase().includes('quotation') ||
          d.file_name.toLowerCase().includes('quote')
      ) || null
    );
  }, [documents]);

  // Vault documents: strictly filter out quotation documents for users without quotation access
  const visibleDocuments = useMemo(() => {
    if (canViewQuotation) return documents;
    return documents.filter(
      (d) =>
        d.category?.toLowerCase() !== 'quotation' &&
        !d.file_name.toLowerCase().includes('quotation') &&
        !d.file_name.toLowerCase().includes('quote')
    );
  }, [documents, canViewQuotation]);

  const loadCase = async () => {
    if (!id) return;
    try {
      const c = await fetchCaseById(id);
      setTheCase(c);

      const [hList, oList, dList, pList, ipList, profs, allPcs] = await Promise.all([
        fetchHearings(id),
        fetchOrders(id),
        fetchDeadlines({ caseId: id }),
        fetchParties(id),
        fetchLinkedIP(id),
        fetchProfiles(),
        fetchProjectCodes().catch(() => []),
      ]);

      setHearings(hList);
      setOrders(oList);
      setDeadlines(dList);
      setParties(pList);
      setLinkedIp(ipList);
      setProfiles(profs);
      setAllProjectCodes(allPcs || []);

      if (c.project_code_id) {
        const [docs, events, cNotes, expList] = await Promise.all([
          fetchProjectDocuments(c.project_code_id),
          fetchMatterEvents(c.project_code_id),
          fetchClientNotes(c.project_code_id),
          fetchCaseExpenses(c.project_code_id),
        ]);
        setDocuments(docs);
        setTimeline(events);
        setClientNotes(cNotes);
        setExpenses(expList || []);
      }

      // Load internal notes (for internal legal team reference)
      const nList = await fetchInternalNotes(id);
      setNotes(nList);
    } catch (err: any) {
      console.error('Error loading case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading case file...</div>;
  }

  if (!theCase) {
    return (
      <div className="py-20 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 dark:text-slate-200">Matter Not Found</h3>
        <p className="text-xs text-slate-500">
          This court case does not exist or has been removed.
        </p>
        <button
          onClick={() => navigate('/cases')}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg"
        >
          Return to Cases Docket
        </button>
      </div>
    );
  }

  const handleStageChange = async (newStage: string) => {
    try {
      await updateCase(theCase.id, { current_stage: newStage as any });
      loadCase();
    } catch (e: any) {
      alert(`Could not update stage: ${e.message}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !currentUser) return;
    setAddingNote(true);
    try {
      await createInternalNote(theCase.id, newNoteText.trim(), currentUser.id);
      setNewNoteText('');
      const updatedNotes = await fetchInternalNotes(theCase.id);
      setNotes(updatedNotes);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDlTitle.trim() || !newDlDate || !newDlOwner || !newDlBackup) {
      alert('A deadline requires Title, Due Date, Owner, and Backup Owner.');
      return;
    }
    setAddingDl(true);
    try {
      await createDeadline({
        case_id: theCase.id,
        title: newDlTitle.trim(),
        due_date: newDlDate,
        deadline_type: newDlType,
        owner_user_id: newDlOwner,
        backup_user_id: newDlBackup,
      });
      setNewDlTitle('');
      setNewDlDate('');
      const updatedDl = await fetchDeadlines({ caseId: theCase.id });
      setDeadlines(updatedDl);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingDl(false);
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) return;
    setAddingParty(true);
    try {
      await createParty({
        case_id: theCase.id,
        name: newPartyName.trim(),
        side: newPartySide,
        party_role: newPartyRole.trim(),
        counsel_name: newPartyCounsel.trim() || null,
      });
      setNewPartyName('');
      setNewPartyCounsel('');
      const updatedP = await fetchParties(theCase.id);
      setParties(updatedP);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingParty(false);
    }
  };

  const handleAddLinkedIp = async (e: React.FormEvent) => {
    e.preventDefault();
    let refToUse = newIpRef.trim();
    let projectCodeIdToLink: string | null = null;

    if (selectedProjectCodeId) {
      const match = allProjectCodes.find((p) => p.id === selectedProjectCodeId);
      if (match) {
        refToUse = match.code;
        projectCodeIdToLink = match.id;
      }
    } else if (refToUse) {
      const match = allProjectCodes.find(
        (p) => p.code.toLowerCase() === refToUse.toLowerCase()
      );
      if (match) {
        projectCodeIdToLink = match.id;
      }
    }

    if (!refToUse) return;
    setAddingIp(true);
    try {
      await createLinkedIP({
        case_id: theCase.id,
        project_code_id: projectCodeIdToLink,
        ip_reference: refToUse.toUpperCase(),
        relation: newIpRelation,
      });
      setNewIpRef('');
      setSelectedProjectCodeId('');
      const updatedIp = await fetchLinkedIP(theCase.id);
      setLinkedIp(updatedIp);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingIp(false);
    }
  };

  const handleDeleteLinkedIp = async (linkId: string) => {
    if (!confirm('Are you sure you want to disconnect this matter / project?')) return;
    try {
      await deleteLinkedIP(linkId);
      const updatedIp = await fetchLinkedIP(theCase.id);
      setLinkedIp(updatedIp);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      await uploadLitigatorFile({
        file,
        category: uploadCategory,
        clientCode: theCase.project_code?.client?.client_code,
        clientName: theCase.project_code?.client?.client_name,
        projectCode: theCase.project_code?.code,
        projectCodeId: theCase.project_code_id,
        uploadedByUserId: currentUser?.id,
      });
      if (theCase.project_code_id) {
        const docs = await fetchProjectDocuments(theCase.project_code_id);
        setDocuments(docs);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const openDocument = async (doc: CoreDocument) => {
    const url = await getDocumentUrl(doc);
    window.open(url, '_blank');
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theCase?.project_code_id) return;
    setSavingQuote(true);
    try {
      await saveCaseQuotation({
        projectCodeId: theCase.project_code_id,
        clientId: theCase.project_code?.client_id || undefined,
        totalProfFee: Number(editingQuoteAmount) || 0,
        quoteNumber: editingQuoteNumber.trim() || undefined,
      });
      setQuoteModalOpen(false);
      loadCase();
    } catch (err: any) {
      alert(`Could not save quotation: ${err.message}`);
    } finally {
      setSavingQuote(false);
    }
  };

  const handleAddClientNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientNoteText.trim() || !theCase?.project_code_id) return;
    setAddingClientNote(true);
    try {
      const formattedNote = newClientNoteTitle.trim()
        ? `[${newClientNoteTitle.trim()}] ${newClientNoteText.trim()}`
        : newClientNoteText.trim();
      await createClientNote({
        projectCodeId: theCase.project_code_id,
        note: formattedNote,
        authorId: currentUser?.id || '',
      });
      setNewClientNoteText('');
      setNewClientNoteTitle('');
      const updated = await fetchClientNotes(theCase.project_code_id);
      setClientNotes(updated);
    } catch (err: any) {
      alert(`Could not save client note: ${err.message}`);
    } finally {
      setAddingClientNote(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/cases')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Court Docket</span>
        </button>
      </div>

      {/* Case Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                {theCase.project_code?.code}
              </span>
              {theCase.case_number && (
                <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {theCase.case_number}
                </span>
              )}
              {theCase.cnr_number && (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    CNR: {theCase.cnr_number}
                  </span>
                  <a
                    href="https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/cnr_index"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open official eCourts case status"
                    className="p-1 text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {theCase.cause_title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {theCase.court} {theCase.bench ? `• ${theCase.bench}` : ''}
              </span>
              <span>•</span>
              <span>
                Client: {theCase.project_code?.client?.client_name} ({theCase.client_role})
              </span>
              <span>•</span>
              <span>Lead: {theCase.lead_user?.display_name || 'Unassigned'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stage Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Stage:</span>
              {canEdit ? (
                <select
                  value={theCase.current_stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {CASE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  {theCase.current_stage}
                </span>
              )}
            </div>

            {/* Read-Only Notice for Finance Head */}
            {!canEdit && (
              <span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-600" />
                <span>Finance View (Read-Only Particulars)</span>
              </span>
            )}

            {/* Edit Case Details Action */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditCaseOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Edit Case Details</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className={`pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 ${canViewQuotation ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'} gap-4 text-xs`}>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Next Hearing</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {theCase.next_hearing_date ? (
                <span>
                  {clock.formatDisplay(theCase.next_hearing_date)} {theCase.next_purpose ? `(${theCase.next_purpose})` : ''}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">Date not fixed</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Filing Date</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {theCase.filing_date ? (
                clock.formatDisplay(theCase.filing_date)
              ) : (
                <span className="text-slate-400 font-normal">Not recorded</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Claim Value</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {theCase.claim_value ? formatINR(theCase.claim_value) : <span className="text-slate-400 font-normal">—</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Court Fee Paid</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {theCase.court_fee ? formatINR(theCase.court_fee) : <span className="text-slate-400 font-normal">—</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Receipt className="w-3 h-3 text-amber-500" />
              <span>Incurred Expenses</span>
            </div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {totalExpenses > 0 ? (
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                  {formatINR(totalExpenses)}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">₹0 logged</span>
              )}
            </div>
          </div>
          {/* 4. Quotation Document & Fee (Strictly SUPER_ADMIN and FINANCE only) */}
          {canViewQuotation && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-600" />
                  <span>Quotation Document &amp; Fee</span>
                </span>
                {(quotationDoc || theCase.quotation || theCase.quotation_amount) ? (
                  <button
                    type="button"
                    onClick={() => setQuoteModalOpen(true)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline capitalize font-semibold flex items-center gap-0.5"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>Manage</span>
                  </button>
                ) : null}
              </div>

              {quotationDoc ? (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={quotationDoc.file_name}>
                      {quotationDoc.file_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDocument(quotationDoc)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-2xs transition shrink-0"
                    title="Open quotation document directly in dashboard"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Open in Dashboard</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuoteModalOpen(true)}
                  className="text-xs text-amber-700 dark:text-amber-300 hover:underline font-medium flex items-center gap-1 py-0.5"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Quotation PDF / Document</span>
                </button>
              )}

              {(theCase.quotation?.total_prof_fee || theCase.quotation_amount) ? (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono pt-1 border-t border-amber-200/40 dark:border-amber-800/30 flex items-center justify-between">
                  <span>Fee: {formatINR(theCase.quotation?.total_prof_fee ?? theCase.quotation_amount ?? 0)}</span>
                  {theCase.quotation?.quote_number && (
                    <span className="text-[10px] text-slate-400">Ref: {theCase.quotation.quote_number}</span>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-px">
        {[
          { key: 'timeline', label: `Master Timeline (${progressEvents.length})`, icon: History },
          { key: 'parties', label: `Parties (${parties.length})`, icon: Users },
          { key: 'deadlines', label: `Deadlines (${deadlines.length})`, icon: Clock },
          { key: 'hearings', label: `Hearings (${hearings.length})`, icon: Calendar },
          { key: 'orders', label: `Orders (${orders.length})`, icon: Scale },
          { key: 'expenses', label: `Expenses Incurred (${expenses.length})`, icon: Receipt },
          { key: 'notes', label: `Internal Notes (${notes.length})`, icon: FileText },
          { key: 'client_notes', label: `Client Notes (${clientNotes.length})`, icon: MessageSquare },
          { key: 'documents', label: `Document Vault (${visibleDocuments.length})`, icon: FolderLock },
          { key: 'linked_ip', label: `Connected Matters (${linkedIp.length})`, icon: LinkIcon },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MASTER TIMELINE (Actual progressed case dates only) */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Master Case Trajectory &amp; Progression Timeline
              </h3>
              <p className="text-[11px] text-slate-500">
                Chronological record of actual court hearings, judicial orders, and filing progression ({progressEvents.length} milestones)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetMilestone(null);
                    setMilestoneModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Milestone</span>
                </button>
              )}
              <div className="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded hidden sm:block">
                Progress Dates Only
              </div>
            </div>
          </div>

          {progressEvents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                No Case Progress Dates Logged Yet
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Timeline records actual court hearings, judicial orders, and formal filing dates as proceedings advance.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTargetMilestone(null);
                  setMilestoneModalOpen(true);
                }}
                className="mt-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:underline"
              >
                + Add First Milestone
              </button>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {progressEvents.map((ev) => (
                <div key={ev.id} className="relative group">
                  <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900 group-hover:scale-125 transition" />
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {ev.title}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.badgeColor}`}>
                          {ev.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                          {clock.formatDisplay(ev.date)}
                        </span>
                      </div>
                    </div>
                    {ev.detail && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                        {ev.detail}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                      <div>
                        {ev.actor && (
                          <span className="text-slate-400">
                            Recorded / Attended by: <span className="font-medium text-slate-600 dark:text-slate-300">{ev.actor}</span>
                          </span>
                        )}
                      </div>

                      {/* Action buttons based on event category */}
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          {ev.category === 'HEARING' && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawId = ev.id.replace('hearing-', '');
                                const found = hearings.find((h) => h.id === rawId);
                                setTargetHearing(found || null);
                                setUpdateHearingOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Hearing &amp; Outcome</span>
                            </button>
                          )}

                          {ev.category === 'FILING' && (
                            <button
                              type="button"
                              onClick={() => setEditCaseOpen(true)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Filing Date</span>
                            </button>
                          )}

                          {ev.category === 'ORDER' && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawId = ev.id.replace('order-', '');
                                const found = orders.find((o) => o.id === rawId);
                                setTargetOrder(found || null);
                                setOrderModalOpen(true);
                              }}
                              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Order</span>
                            </button>
                          )}

                          {ev.category === 'DEADLINE' && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawId = ev.id.replace('deadline-', '');
                                const found = deadlines.find((d) => d.id === rawId);
                                if (found) {
                                  setTargetDeadline(found);
                                  setDeadlineModalOpen(true);
                                }
                              }}
                              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Deadline</span>
                            </button>
                          )}

                          {ev.category === 'MILESTONE' && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawId = ev.id.replace('timeline-', '');
                                setTargetMilestone({
                                  id: rawId,
                                  date: ev.date,
                                  title: ev.title,
                                  detail: ev.detail,
                                  category: ev.badge,
                                });
                                setMilestoneModalOpen(true);
                              }}
                              className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Milestone</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PARTIES */}
      {activeTab === 'parties' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Parties to Litigation &amp; Opposing Counsel
            </h3>
          </div>

          {/* Add Party Inline Form */}
          {canEdit && (
            <form onSubmit={handleAddParty} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Party</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Party Name"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <select
                  value={newPartySide}
                  onChange={(e) => setNewPartySide(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="OPPOSITE">Opposite Side</option>
                  <option value="OURS">Our Side</option>
                  <option value="OTHER">Other / Proforma</option>
                </select>
                <input
                  type="text"
                  required
                  value={newPartyRole}
                  onChange={(e) => setNewPartyRole(e.target.value)}
                  placeholder="Role (e.g. Defendant No. 1)"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  value={newPartyCounsel}
                  onChange={(e) => setNewPartyCounsel(e.target.value)}
                  placeholder="Counsel Name &amp; Contact"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingParty}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  {addingParty ? 'Adding...' : 'Add Party'}
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {parties.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Role: {p.party_role} {p.counsel_name ? `• Counsel: ${p.counsel_name}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    p.side === 'OURS'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {p.side}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetParty(p);
                        setPartyModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                      title="Edit Party"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEADLINES */}
      {activeTab === 'deadlines' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Matter Statutory &amp; Court Deadlines
            </h3>
          </div>

          {/* Quick Add Deadline Form */}
          {canEdit && (
            <form onSubmit={handleAddDeadline} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Add New Deadline (Mandatory Owner &amp; Backup Owner)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <input
                  type="text"
                  required
                  value={newDlTitle}
                  onChange={(e) => setNewDlTitle(e.target.value)}
                  placeholder="Title (e.g. 30 days to file WS)"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg lg:col-span-2"
                />
                <input
                  type="date"
                  required
                  value={newDlDate}
                  onChange={(e) => setNewDlDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <select
                  required
                  value={newDlOwner}
                  onChange={(e) => setNewDlOwner(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Owner (Required)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={newDlBackup}
                  onChange={(e) => setNewDlBackup(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Backup (Required)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingDl}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  {addingDl ? 'Saving...' : 'Add Deadline'}
                </button>
              </div>
            </form>
          )}

          {deadlines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No deadlines recorded.</div>
          ) : (
            <div className="space-y-2">
              {deadlines.map((dl) => (
                <div
                  key={dl.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{dl.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Due: {clock.formatDisplay(dl.due_date)} • Owner: {dl.owner_profile?.display_name} • Backup:{' '}
                      {dl.backup_profile?.display_name}
                      {dl.done_note ? ` • Note: ${dl.done_note}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      dl.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {dl.status}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetDeadline(dl);
                          setDeadlineModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition"
                        title="Edit Deadline"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HEARINGS */}
      {activeTab === 'hearings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Proceedings &amp; Daily Hearing Diary
              </h3>
              <p className="text-[11px] text-slate-500">
                Comprehensive record of past and upcoming court appearances
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setTargetHearing(null);
                  setUpdateHearingOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Court Hearing</span>
              </button>
            )}
          </div>

          {hearings.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>No hearings logged yet for this matter.</div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetHearing(null);
                    setUpdateHearingOpen(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  + Record First Hearing
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {hearings.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{clock.formatDisplay(h.hearing_date)}</span>
                        <span className="font-normal text-slate-500">• {h.purpose}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Attended by: {h.attending_profile?.display_name || 'Unrecorded'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.next_date && (
                        <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                          Next: {clock.formatDisplay(h.next_date)} ({h.next_purpose || 'Orders'})
                        </span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to delete the hearing on ${clock.formatDisplay(h.hearing_date)}?`)) return;
                            try {
                              await deleteHearing(h.id);
                              loadCase();
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Delete Hearing"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {h.outcome && h.outcome.trim() ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-start justify-between gap-3">
                      <div className="whitespace-pre-wrap flex-1">{h.outcome}</div>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setTargetHearing(h);
                            setUpdateHearingOpen(true);
                          }}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold shrink-0 flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Hearing &amp; Outcome</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-amber-600 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Outcome pending record</span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setTargetHearing(h);
                              setUpdateHearingOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                          >
                            Log Outcome
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {h.order_document && (
                    <button
                      onClick={() => openDocument(h.order_document as CoreDocument)}
                      className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 pt-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Attached Daily Order</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Court Orders &amp; Compliance Register
              </h3>
              <p className="text-[11px] text-slate-500">
                Track ad-interim reliefs, injunctions, directions, and decree obligations
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setTargetOrder(null);
                  setOrderModalOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Order</span>
              </button>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>No orders logged for this matter.</div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetOrder(null);
                    setOrderModalOpen(true);
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  + Record First Order
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {clock.formatDisplay(ord.order_date)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {ord.order_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ord.summary}</p>
                    {ord.compliance_required && (
                      <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                        Compliance Required by: {clock.formatDisplay(ord.compliance_due)} (Owner:{' '}
                        {ord.compliance_owner_profile?.display_name || 'Assigned Lead'})
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetOrder(ord);
                          setOrderModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                        title="Edit Order"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete order from ${clock.formatDisplay(ord.order_date)}?`)) return;
                          try {
                            await deleteOrder(ord.id);
                            loadCase();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Delete Order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: INTERNAL NOTES */}
      {activeTab === 'notes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Privileged Counsel Notes
              </h3>
              <p className="text-[11px] text-slate-500">
                Confidential strategist thoughts (RLS protected; privileged firm counsel reference)
              </p>
            </div>
          </div>

          {canEdit && (
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                required
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Record privileged trial strategies, witness assessments, or bench observations..."
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingNote}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  {addingNote ? 'Saving Note...' : 'Save Privileged Note'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3 pt-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {n.author_profile?.display_name || 'Counsel'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{clock.formatDisplay(n.created_at)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(n.id);
                          setEditingNoteText(n.note);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                        title="Edit Note"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Are you sure you want to delete this privileged note?')) return;
                          try {
                            await deleteInternalNote(n.id);
                            loadCase();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {editingNoteId === n.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingNoteEdit}
                        onClick={async () => {
                          if (!editingNoteText.trim()) return;
                          setSavingNoteEdit(true);
                          try {
                            await updateInternalNote(n.id, editingNoteText.trim());
                            setEditingNoteId(null);
                            loadCase();
                          } catch (e: any) {
                            alert(e.message);
                          } finally {
                            setSavingNoteEdit(false);
                          }
                        }}
                        className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                      >
                        {savingNoteEdit ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{n.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: CLIENT NOTES (Future Client-Facing Portal Ready) */}
      {activeTab === 'client_notes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Client Notes &amp; Portal Updates
                </h3>
                <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Client-Visible Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Status updates and progress messages curated specifically for the client. These notes will be visible on the client-side view of this dashboard.
              </p>
            </div>
          </div>

          {/* Add Client Note Form */}
          {canEdit && (
            <form onSubmit={handleAddClientNote} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Post New Client Update</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Will be surfaced to client portal
                </span>
              </div>
              <div>
                <input
                  type="text"
                  value={newClientNoteTitle}
                  onChange={(e) => setNewClientNoteTitle(e.target.value)}
                  placeholder="Subject / Update Title (e.g. Court arguments completed; Next date fixed)"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <textarea
                  required
                  rows={3}
                  value={newClientNoteText}
                  onChange={(e) => setNewClientNoteText(e.target.value)}
                  placeholder="Write plain-language client update without internal privileged counsel notes..."
                  className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingClientNote}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{addingClientNote ? 'Publishing...' : 'Add Client Note'}</span>
                </button>
              </div>
            </form>
          )}

          {/* List of client notes */}
          {clientNotes.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <MessageSquare className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Client Notes Yet</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Use the box above to publish progress briefs and status notes for the client's view.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientNotes.map((cn) => (
                <div
                  key={cn.id}
                  className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Client Status Update</span>
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded">
                        CLIENT VISIBLE
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {clock.formatDisplay(cn.created_at)}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClientNoteId(cn.id);
                            setEditingClientNoteText(cn.note);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                          title="Edit Client Note"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this client note?')) return;
                            try {
                              await deleteClientNote(cn.id);
                              loadCase();
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Delete Client Note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingClientNoteId === cn.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={3}
                        value={editingClientNoteText}
                        onChange={(e) => setEditingClientNoteText(e.target.value)}
                        className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingClientNoteId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingClientNoteEdit}
                          onClick={async () => {
                            if (!editingClientNoteText.trim()) return;
                            setSavingClientNoteEdit(true);
                            try {
                              await updateClientNote(cn.id, editingClientNoteText.trim());
                              setEditingClientNoteId(null);
                              loadCase();
                            } catch (e: any) {
                              alert(e.message);
                            } finally {
                              setSavingClientNoteEdit(false);
                            }
                          }}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                        >
                          {savingClientNoteEdit ? 'Saving...' : 'Save Update'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    cn.note && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {cn.note}
                      </p>
                    )
                  )}

                  <div className="text-[10px] text-slate-400 pt-1 border-t border-emerald-100/60 dark:border-emerald-900/40">
                    Logged by {cn.author_profile?.display_name || 'Counsel'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: DOCUMENT VAULT */}
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Pleadings, Orders &amp; Evidence Vault
              </h3>
              <p className="text-[11px] text-slate-500">
                Cloud path: {theCase.project_code?.client?.client_code} - {theCase.project_code?.client?.client_name}/{theCase.project_code?.code}/
              </p>
            </div>

            {/* Upload Selector */}
            {canEdit && (
              <div className="flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {LITIGATION_FILE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      Category: {cat}
                    </option>
                  ))}
                </select>

                <label className="cursor-pointer px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? 'Uploading...' : 'Upload Document'}</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {visibleDocuments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No documents uploaded yet in this matter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleDocuments.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{doc.file_name}</span>
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">
                        {doc.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {doc.workdrive_path || 'WorkDrive Root'} • {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingDocument(doc)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open in Dashboard</span>
                    </button>
                    <button
                      onClick={() => openDocument(doc)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                      title="Open in new window / Download"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8b: STAGE-WISE EXPENSES INCURRED */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
          {/* Header & Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Stage-Wise Expenses Incurred</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Operational and statutory outlays recorded at every stage (documentation, notary, travel, process fees, translation, court charges). Synchronized with Finance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Stage Expense</span>
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Expenses Incurred
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatINR(totalExpenses)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {expenses.length} expense record{expenses.length === 1 ? '' : 's'} across stages
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Billable to Client
              </div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {formatINR(billableExpenses)}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                Pass-through outlays recoverable on invoice
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Internal Overhead (Non-Billable)
              </div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {formatINR(nonBillableExpenses)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Internal operational firm overhead
              </div>
            </div>
          </div>

          {/* List of expenses */}
          {expenses.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No Stage Expenses Recorded Yet
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Track outlays for notary, affidavits, documentation, process fees, translation, travel, or court charges at any stage.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingExpense(null);
                  setExpenseModalOpen(true);
                }}
                className="mt-2 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record First Expense</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Itemization / Notes</th>
                    <th className="py-2.5 px-3">Billing</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {clock.formatDisplay(exp.date)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                          {exp.stage || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-slate-700 dark:text-slate-300 max-w-md line-clamp-2">
                          {exp.description || '—'}
                        </p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Logged by {exp.actor_name || 'Team Member'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {exp.billable ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Billable
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Overhead
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(exp);
                              setExpenseModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                            title="Edit Incurred Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to delete this ${formatINR(exp.amount)} expense record?`)) return;
                              try {
                                await deleteStageExpense(exp.id);
                                loadCase();
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                            title="Delete Expense Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: CONNECTED MATTERS & UNIVERSAL LINKING */}
      {activeTab === 'linked_ip' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Connected Matters &amp; Projects</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Universal relational bridge connecting this litigation matter to legal notices, agreements, court suits, or IP prosecution files (Patents/Trademarks).
              </p>
            </div>
          </div>

          {/* Add Connection Form */}
          {canEdit && (
            <form onSubmit={handleAddLinkedIp} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Connect Matter or Intellectual Property Asset
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">
                    Select Existing Firm Matter
                  </label>
                  <select
                    value={selectedProjectCodeId}
                    onChange={(e) => {
                      setSelectedProjectCodeId(e.target.value);
                      if (e.target.value) {
                        const match = allProjectCodes.find((p) => p.id === e.target.value);
                        if (match) setNewIpRef(match.code);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  >
                    <option value="">-- Choose Matter / Agreement / Case --</option>
                    {allProjectCodes
                      .filter((p) => p.id !== theCase.project_code_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} • {p.matter_type || 'Matter'} ({p.client?.client_name || 'Client'})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">
                    Or Enter Code / External Reference
                  </label>
                  <input
                    type="text"
                    value={newIpRef}
                    onChange={(e) => setNewIpRef(e.target.value)}
                    placeholder="e.g. AG-0014, LC41, or IN-PAT-2024..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">
                    Relational Context
                  </label>
                  <select
                    value={newIpRelation}
                    onChange={(e) => setNewIpRelation(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="ENFORCES">ENFORCES (Enforces Agreement / IP)</option>
                    <option value="DEFENDS">DEFENDS (Defends Against Claim)</option>
                    <option value="CHALLENGES">CHALLENGES (Rectification / Dispute)</option>
                    <option value="OTHER">OTHER (Companion / Cross-Reference)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={addingIp || (!selectedProjectCodeId && !newIpRef.trim())}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{addingIp ? 'Connecting...' : 'Connect Matter'}</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Connected Matters */}
          {linkedIp.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <LinkIcon className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No Connected Matters or IP Assets
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Connect companion court cases, underlying commercial agreements, legal notices, or patent/trademark filings to build a 360° matter view.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {linkedIp.map((item) => {
                const codeMatch = allProjectCodes.find(
                  (p) => p.id === item.project_code_id || p.code.toLowerCase() === item.ip_reference?.toLowerCase()
                );
                const code = item.ip_reference || item.project_code?.code || 'Connected Matter';
                const isAgreement = code.startsWith('AG') || codeMatch?.matter_type === 'AGREEMENT';
                const isCase = code.startsWith('LC') || codeMatch?.matter_type === 'LITIGATION';

                return (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                            {code}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-mono">
                            {item.relation}
                          </span>
                          {codeMatch && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {codeMatch.matter_type || 'Firm Project'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {codeMatch?.client?.client_name ? `Client: ${codeMatch.client.client_name}` : 'Ecosystem Link'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAgreement && (
                        <button
                          type="button"
                          onClick={() => navigate('/agreements')}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition flex items-center gap-1"
                          title="Open in Agreements Docket"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Agreement</span>
                        </button>
                      )}
                      {isCase && (
                        <button
                          type="button"
                          onClick={() => {
                            if (codeMatch?.id) navigate(`/cases/${codeMatch.id}`);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition flex items-center gap-1"
                          title="Open Case File"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Case</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLinkedIp(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Disconnect / Remove Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quotation & Document Manager Modal (SuperAdmin & Finance only) */}
      {quoteModalOpen && canViewQuotation && (
        <QuotationModal
          isOpen={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          onSuccess={loadCase}
          caseId={theCase.id}
          projectCodeId={theCase.project_code_id}
          clientCode={theCase.project_code?.client?.client_code}
          clientName={theCase.project_code?.client?.client_name}
          projectCode={theCase.project_code?.code}
          existingQuotation={theCase.quotation}
          existingQuotationAmount={theCase.quotation_amount}
          existingQuotationNumber={theCase.quotation_number}
          existingDocument={quotationDoc}
          onOpenDocumentViewer={(doc) => {
            setQuoteModalOpen(false);
            setViewingDocument(doc);
          }}
        />
      )}

      {/* In-Dashboard Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={Boolean(viewingDocument)}
        onClose={() => setViewingDocument(null)}
        document={viewingDocument}
      />

      {/* Edit Case Details Modal */}
      <EditCaseModal
        isOpen={editCaseOpen}
        onClose={() => setEditCaseOpen(false)}
        onSuccess={loadCase}
        theCase={theCase}
      />

      {/* Update / Edit Hearing Modal */}
      <UpdateHearingModal
        isOpen={updateHearingOpen}
        onClose={() => {
          setUpdateHearingOpen(false);
          setTargetHearing(null);
        }}
        onSuccess={() => {
          setUpdateHearingOpen(false);
          setTargetHearing(null);
          loadCase();
        }}
        caseId={theCase.id}
        causeTitle={theCase.cause_title}
        hearingId={targetHearing?.id}
        defaultHearingDate={targetHearing?.hearing_date || theCase.next_hearing_date || undefined}
        defaultPurpose={targetHearing?.purpose || theCase.next_purpose || undefined}
        defaultOutcome={targetHearing?.outcome || ''}
        defaultNextDate={targetHearing?.next_date || ''}
        defaultNextPurpose={targetHearing?.next_purpose || ''}
        defaultAttendedBy={targetHearing?.attended_by || ''}
        clientCode={theCase.project_code?.client?.client_code}
        clientName={theCase.project_code?.client?.client_name}
        projectCode={theCase.project_code?.code}
        projectCodeId={theCase.project_code_id}
      />

      {/* Record / Edit Order Modal */}
      <EditOrderModal
        isOpen={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setTargetOrder(null);
        }}
        onSuccess={loadCase}
        caseId={theCase.id}
        order={targetOrder}
      />

      {/* Edit Statutory / Court Deadline Modal */}
      {targetDeadline && (
        <EditDeadlineModal
          isOpen={deadlineModalOpen}
          onClose={() => {
            setDeadlineModalOpen(false);
            setTargetDeadline(null);
          }}
          onSuccess={loadCase}
          deadline={targetDeadline}
        />
      )}

      {/* Edit Litigation Party Modal */}
      {targetParty && (
        <EditPartyModal
          isOpen={partyModalOpen}
          onClose={() => {
            setPartyModalOpen(false);
            setTargetParty(null);
          }}
          onSuccess={loadCase}
          party={targetParty}
        />
      )}

      {/* Add / Edit Master Timeline Milestone Modal */}
      <AddMilestoneModal
        isOpen={milestoneModalOpen}
        onClose={() => {
          setMilestoneModalOpen(false);
          setTargetMilestone(null);
        }}
        onSuccess={loadCase}
        projectCodeId={theCase.project_code_id}
        existingMilestone={targetMilestone}
      />

      {/* Record / Edit Stage Expense Modal */}
      {theCase.project_code_id && (
        <RecordExpenseModal
          isOpen={expenseModalOpen}
          onClose={() => {
            setExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          onSuccess={loadCase}
          projectCodeId={theCase.project_code_id}
          defaultStage={theCase.current_stage || 'Hearing'}
          existingExpense={editingExpense}
        />
      )}
    </div>
  );
};
