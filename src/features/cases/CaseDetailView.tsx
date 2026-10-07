// src/features/cases/CaseDetailView.tsx
import React, { useState, useEffect } from 'react';
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
  EyeOff,
} from 'lucide-react';
import {
  fetchCaseById,
  updateCase,
  fetchHearings,
  fetchOrders,
  fetchParties,
  fetchInternalNotes,
  createInternalNote,
  fetchLinkedIP,
  createLinkedIP,
  fetchDeadlines,
  createDeadline,
  fetchMatterEvents,
  fetchProfiles,
  createOrder,
  createParty,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatINR, formatINRShort } from '../../lib/currency';
import {
  uploadLitigatorFile,
  fetchProjectDocuments,
  getDocumentUrl,
  LITIGATION_FILE_CATEGORIES,
} from '../../lib/files';
import { getStoredUser, canModifyEthicalWall, isFinance } from '../../lib/auth';
import {
  CASE_STAGES,
  CaseRecord,
  HearingRecord,
  OrderRecord,
  CasePartyRecord,
  InternalNoteRecord,
  LinkedIPRecord,
  DeadlineRecord,
  CoreMatterEvent,
  CoreProfile,
  CoreDocument,
} from '../../lib/types';
import { UpdateHearingModal } from './UpdateHearingModal';

type TabKey =
  | 'hearings'
  | 'orders'
  | 'deadlines'
  | 'parties'
  | 'documents'
  | 'linked_ip'
  | 'notes'
  | 'timeline';

export const CaseDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const [theCase, setTheCase] = useState<CaseRecord | null>(null);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('hearings');

  // Sub-entity data states
  const [hearings, setHearings] = useState<HearingRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineRecord[]>([]);
  const [parties, setParties] = useState<CasePartyRecord[]>([]);
  const [documents, setDocuments] = useState<CoreDocument[]>([]);
  const [linkedIp, setLinkedIp] = useState<LinkedIPRecord[]>([]);
  const [notes, setNotes] = useState<InternalNoteRecord[]>([]);
  const [timeline, setTimeline] = useState<CoreMatterEvent[]>([]);

  // Update hearing modal state
  const [updateHearingOpen, setUpdateHearingOpen] = useState(false);
  const [targetHearing, setTargetHearing] = useState<HearingRecord | null>(null);

  // Quick form states
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

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

  // Linked IP inline
  const [newIpRef, setNewIpRef] = useState('');
  const [newIpRelation, setNewIpRelation] = useState<'ENFORCES' | 'DEFENDS' | 'CHALLENGES' | 'OTHER'>('ENFORCES');
  const [addingIp, setAddingIp] = useState(false);

  // Document upload state
  const [uploadCategory, setUploadCategory] = useState<string>('Pleadings');
  const [uploadingFile, setUploadingFile] = useState(false);

  const loadCase = async () => {
    if (!id) return;
    try {
      const c = await fetchCaseById(id);
      setTheCase(c);

      const [hList, oList, dList, pList, ipList, profs] = await Promise.all([
        fetchHearings(id),
        fetchOrders(id),
        fetchDeadlines({ caseId: id }),
        fetchParties(id),
        fetchLinkedIP(id),
        fetchProfiles(),
      ]);

      setHearings(hList);
      setOrders(oList);
      setDeadlines(dList);
      setParties(pList);
      setLinkedIp(ipList);
      setProfiles(profs);

      if (c.project_code_id) {
        const [docs, events] = await Promise.all([
          fetchProjectDocuments(c.project_code_id),
          fetchMatterEvents(c.project_code_id),
        ]);
        setDocuments(docs);
        setTimeline(events);
      }

      // Load internal notes only if not finance
      if (!isFinance(currentUser)) {
        const nList = await fetchInternalNotes(id);
        setNotes(nList);
      }
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
        <h3 className="font-bold text-slate-800 dark:text-slate-200">Matter Restricted or Not Found</h3>
        <p className="text-xs text-slate-500">
          This matter does not exist, or is protected by an active Ethical Wall.
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

  const handleToggleEthicalWall = async () => {
    if (!canModifyEthicalWall(currentUser)) {
      alert('Interns and Finance cannot modify ethical wall settings.');
      return;
    }
    try {
      await updateCase(theCase.id, { ethical_wall: !theCase.ethical_wall });
      loadCase();
    } catch (e: any) {
      alert(`Could not toggle ethical wall: ${e.message}`);
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
    if (!newIpRef.trim()) return;
    setAddingIp(true);
    try {
      await createLinkedIP({
        case_id: theCase.id,
        ip_reference: newIpRef.trim(),
        relation: newIpRelation,
      });
      setNewIpRef('');
      const updatedIp = await fetchLinkedIP(theCase.id);
      setLinkedIp(updatedIp);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingIp(false);
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

          {/* Action buttons & Ethical wall */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stage Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Stage:</span>
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
            </div>

            {/* Ethical Wall Toggle */}
            <button
              type="button"
              onClick={handleToggleEthicalWall}
              title={
                theCase.ethical_wall
                  ? 'Ethical Wall Active: Restricted access to team members only'
                  : 'Click to enable Ethical Wall restriction'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                theCase.ethical_wall
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {theCase.ethical_wall ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ethical Wall ON</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ethical Wall OFF</span>
                </>
              )}
            </button>

            {/* Update Hearing Action */}
            <button
              type="button"
              onClick={() => {
                setTargetHearing(null);
                setUpdateHearingOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Update Hearing</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Next Hearing</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {clock.formatDisplay(theCase.next_hearing_date)} {theCase.next_purpose ? `(${theCase.next_purpose})` : ''}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Filing Date</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {clock.formatDisplay(theCase.filing_date)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Claim Value</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {formatINR(theCase.claim_value)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Court Fee Paid</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {formatINR(theCase.court_fee)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-px">
        {[
          { key: 'hearings', label: `Hearings (${hearings.length})`, icon: Calendar },
          { key: 'orders', label: `Orders (${orders.length})`, icon: Scale },
          { key: 'deadlines', label: `Deadlines (${deadlines.length})`, icon: Clock },
          { key: 'parties', label: `Parties (${parties.length})`, icon: Users },
          { key: 'documents', label: `Document Vault (${documents.length})`, icon: FolderLock },
          { key: 'linked_ip', label: `Linked IP (${linkedIp.length})`, icon: LinkIcon },
          ...(!isFinance(currentUser)
            ? [{ key: 'notes', label: `Internal Notes (${notes.length})`, icon: FileText }]
            : []),
          { key: 'timeline', label: `Matter Timeline (${timeline.length})`, icon: History },
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

      {/* TAB 1: HEARINGS */}
      {activeTab === 'hearings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Proceedings &amp; Daily Hearing Diary
            </h3>
            <button
              onClick={() => {
                setTargetHearing(null);
                setUpdateHearingOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Hearing Outcome</span>
            </button>
          </div>

          {hearings.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No hearings logged yet. Use "Update Hearing" to record court appearances.
            </div>
          ) : (
            <div className="space-y-3">
              {hearings.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{clock.formatDisplay(h.hearing_date)}</span>
                        <span className="font-normal text-slate-500">• {h.purpose}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Attended by: {h.attending_profile?.display_name || 'Unrecorded'}
                      </div>
                    </div>
                    {h.next_date && (
                      <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                        Next Date: {clock.formatDisplay(h.next_date)} ({h.next_purpose || 'Orders'})
                      </span>
                    )}
                  </div>

                  {h.outcome ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                      {h.outcome}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Outcome pending record</span>
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

      {/* TAB 2: ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Court Orders &amp; Compliance Register
            </h3>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No orders logged for this matter.
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
                    <p className="text-xs text-slate-700 dark:text-slate-300">{ord.summary}</p>
                    {ord.compliance_required && (
                      <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                        Compliance Required by: {clock.formatDisplay(ord.compliance_due)} (Owner:{' '}
                        {ord.compliance_owner_profile?.display_name || 'Assigned Lead'})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    dl.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {dl.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PARTIES */}
      {activeTab === 'parties' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Parties to Litigation &amp; Opposing Counsel
            </h3>
          </div>

          {/* Add Party Inline Form */}
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
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  p.side === 'OURS'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {p.side}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENT VAULT */}
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
          </div>

          {documents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No documents uploaded yet in this matter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.map((doc) => (
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

                  <button
                    onClick={() => openDocument(doc)}
                    className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition"
                  >
                    View / Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: LINKED IP */}
      {activeTab === 'linked_ip' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Linked IP Bridge
              </h3>
              <p className="text-[11px] text-slate-500">
                Relational bridge linking court enforcement to IP prosecution filings (Patents, Trademarks)
              </p>
            </div>
          </div>

          {/* Add Linked IP Form */}
          <form onSubmit={handleAddLinkedIp} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Attach IP Reference</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={newIpRef}
                onChange={(e) => setNewIpRef(e.target.value)}
                placeholder="IP Application / Reg No. (e.g. IN-PAT-20244100202)"
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg sm:col-span-2 font-mono"
              />
              <select
                value={newIpRelation}
                onChange={(e) => setNewIpRelation(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="ENFORCES">ENFORCES (Patent/TM Infringement)</option>
                <option value="DEFENDS">DEFENDS</option>
                <option value="CHALLENGES">CHALLENGES (Rectification/Revocation)</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingIp}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              >
                {addingIp ? 'Attaching...' : 'Attach IP Asset'}
              </button>
            </div>
          </form>

          {linkedIp.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No patent or trademark assets attached to this litigation.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {linkedIp.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                      {item.ip_reference}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Relationship: <span className="font-semibold text-indigo-600">{item.relation}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400">
                    IP-BRIDGE
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: INTERNAL NOTES */}
      {activeTab === 'notes' && !isFinance(currentUser) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Privileged Counsel Notes
              </h3>
              <p className="text-[11px] text-slate-500">
                Confidential strategist thoughts (RLS protected; never visible to Finance or clients)
              </p>
            </div>
          </div>

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

          <div className="space-y-3 pt-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {n.author_profile?.display_name || 'Counsel'}
                  </span>
                  <span>{clock.formatDisplay(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: MATTER TIMELINE (CROSS-APP core.matter_events) */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Cross-App Matter Event History (core.matter_events)
            </h3>
            <p className="text-[11px] text-slate-500">
              Automatic ledger tracking events from Litigator, Office (dispatches, notices), and Finance
            </p>
          </div>

          {timeline.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No events recorded on this matter code yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {timeline.map((ev) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {ev.title}
                      </span>
                      {ev.event_code && (
                        <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                          {ev.event_code}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        {ev.source_app}
                      </span>
                    </div>
                    {ev.detail && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{ev.detail}</p>}
                    <div className="text-[10px] text-slate-400 mt-1">
                      {clock.formatDisplay(ev.occurred_at)} • Logged by:{' '}
                      {ev.actor_profile?.display_name || 'System / Staff'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Update Hearing Modal */}
      <UpdateHearingModal
        isOpen={updateHearingOpen}
        onClose={() => setUpdateHearingOpen(false)}
        onSuccess={() => {
          setUpdateHearingOpen(false);
          loadCase();
        }}
        caseId={theCase.id}
        causeTitle={theCase.cause_title}
        hearingId={targetHearing?.id}
        defaultHearingDate={theCase.next_hearing_date || undefined}
        defaultPurpose={theCase.next_purpose || undefined}
        clientCode={theCase.project_code?.client?.client_code}
        clientName={theCase.project_code?.client?.client_name}
        projectCode={theCase.project_code?.code}
        projectCodeId={theCase.project_code_id}
      />
    </div>
  );
};
