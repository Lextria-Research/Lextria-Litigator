// src/features/agreements/AgreementDetailView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Users,
  Layers,
  Clock,
  FolderLock,
  History,
  Calendar,
  ArrowLeft,
  Plus,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  FileCheck,
  Send,
  Download,
  Info,
} from 'lucide-react';
import {
  fetchAgreementById,
  updateAgreementStage,
  fetchAgreementVersions,
  addAgreementVersion,
  fetchAgreementParties,
  addAgreementParty,
  fetchDeadlines,
  createDeadline,
  markDeadlineDone,
  fetchMatterEvents,
  fetchProfiles,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatINR } from '../../lib/currency';
import {
  uploadLitigatorFile,
  fetchProjectDocuments,
  getDocumentDownloadLink,
  LITIGATION_FILE_CATEGORIES,
} from '../../lib/files';
import {
  AGREEMENT_STAGES,
  AgreementRecord,
  AgreementStage,
  AgreementVersionRecord,
  AgreementPartyRecord,
  DeadlineRecord,
  CoreMatterEvent,
  CoreProfile,
  CoreDocument,
} from '../../lib/types';

export const AgreementDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<AgreementRecord | null>(null);
  const [versions, setVersions] = useState<AgreementVersionRecord[]>([]);
  const [parties, setParties] = useState<AgreementPartyRecord[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineRecord[]>([]);
  const [documents, setDocuments] = useState<CoreDocument[]>([]);
  const [timeline, setTimeline] = useState<CoreMatterEvent[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'parties' | 'versions' | 'deadlines' | 'documents' | 'timeline'
  >('overview');

  // Stage change modal/error
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<AgreementStage | null>(null);
  const [executionDateInput, setExecutionDateInput] = useState('');

  // Modals for add party, upload version, add deadline
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [newParty, setNewParty] = useState({
    name: '',
    party_role: 'FIRST_PARTY',
    entity_type: 'PRIVATE_LIMITED',
    signatory: '',
    designation: '',
    email: '',
    address: '',
  });

  const [uploadVersionOpen, setUploadVersionOpen] = useState(false);
  const [versionSentTo, setVersionSentTo] = useState<'INTERNAL' | 'CLIENT' | 'COUNTERPARTY' | 'FINAL'>('INTERNAL');
  const [versionSummary, setVersionSummary] = useState('');
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionUploading, setVersionUploading] = useState(false);

  const [addDeadlineOpen, setAddDeadlineOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState({
    title: '',
    due_date: '',
    deadline_type: 'INTERNAL',
    basis: '',
    owner_user_id: '',
    backup_user_id: '',
  });

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const agr = await fetchAgreementById(id);
      setAgreement(agr);

      const [vers, pts, dls, evts, profs] = await Promise.all([
        fetchAgreementVersions(agr.id),
        fetchAgreementParties(agr.id),
        fetchDeadlines({ agreementId: agr.id }),
        fetchMatterEvents(agr.project_code_id),
        fetchProfiles(),
      ]);

      setVersions(vers);
      setParties(pts);
      setDeadlines(dls);
      setTimeline(evts);
      setProfiles(profs);

      // Load documents from project code
      if (agr.project_code) {
        const docs = await fetchProjectDocuments(agr.project_code.code);
        setDocuments(docs);
      }
    } catch (err) {
      console.error('Failed to load agreement detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStageChangeRequest = (st: AgreementStage) => {
    setPendingStage(st);
    setExecutionDateInput(agreement?.execution_date || clock.todayYMD());
    setStageError(null);
    setStageModalOpen(true);
  };

  const confirmStageChange = async () => {
    if (!agreement || !pendingStage) return;
    setStageError(null);
    try {
      await updateAgreementStage(agreement.id, pendingStage, {
        executionDate: pendingStage === 'EXECUTED' ? executionDateInput : undefined,
      });
      setStageModalOpen(false);
      setPendingStage(null);
      await loadData();
    } catch (err: any) {
      setStageError(err.message || 'Stage transition failed');
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreement) return;
    try {
      await addAgreementParty({
        agreement_id: agreement.id,
        name: newParty.name,
        party_role: newParty.party_role,
        entity_type: newParty.entity_type,
        signatory: newParty.signatory || null,
        designation: newParty.designation || null,
        email: newParty.email || null,
        address: newParty.address || null,
      });
      setAddPartyOpen(false);
      setNewParty({
        name: '',
        party_role: 'FIRST_PARTY',
        entity_type: 'PRIVATE_LIMITED',
        signatory: '',
        designation: '',
        email: '',
        address: '',
      });
      const updatedParties = await fetchAgreementParties(agreement.id);
      setParties(updatedParties);
    } catch (err: any) {
      alert(err.message || 'Failed to add party');
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreement) return;
    setVersionUploading(true);
    try {
      let docId: string | null = null;
      if (versionFile && agreement.project_code?.client) {
        const category = versionSentTo === 'FINAL' ? 'Final' : 'Drafts';
        const doc = await uploadLitigatorFile({
          file: versionFile,
          projectCode: agreement.project_code.code,
          clientCode: agreement.project_code.client.client_code,
          clientName: agreement.project_code.client.client_name,
          category,
        });
        docId = doc.id;
      }

      const nextVersionNo = versions.length > 0 ? Math.max(...versions.map((v) => v.version_no)) + 1 : 1;

      await addAgreementVersion({
        agreementId: agreement.id,
        versionNo: nextVersionNo,
        documentId: docId,
        sentTo: versionSentTo,
        changeSummary: versionSummary || undefined,
      });

      setUploadVersionOpen(false);
      setVersionFile(null);
      setVersionSummary('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to upload version');
    } finally {
      setVersionUploading(false);
    }
  };

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreement) return;
    try {
      await createDeadline({
        agreement_id: agreement.id,
        title: newDeadline.title,
        due_date: newDeadline.due_date,
        deadline_type: newDeadline.deadline_type,
        basis: newDeadline.basis || null,
        owner_user_id: newDeadline.owner_user_id,
        backup_user_id: newDeadline.backup_user_id,
      });
      setAddDeadlineOpen(false);
      setNewDeadline({
        title: '',
        due_date: '',
        deadline_type: 'INTERNAL',
        basis: '',
        owner_user_id: '',
        backup_user_id: '',
      });
      const dls = await fetchDeadlines({ agreementId: agreement.id });
      setDeadlines(dls);
    } catch (err: any) {
      alert(err.message || 'Failed to create deadline');
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading agreement details...</div>;
  }

  if (!agreement) {
    return (
      <div className="text-center py-20 space-y-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Agreement Not Found</h2>
        <button
          onClick={() => navigate('/agreements')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs"
        >
          Return to Agreements Vault
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/agreements"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {agreement.agreement_type}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {agreement.project_code?.code}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {agreement.title}
            </h1>
          </div>
        </div>

        {/* Stage Advancement Control */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Current Stage</div>
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {agreement.stage.replace(/_/g, ' ')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleStageChangeRequest(agreement.stage)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            Transition Stage
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview & Stamping', icon: FileText },
          { key: 'parties', label: `Parties (${parties.length})`, icon: Users },
          { key: 'versions', label: `Versions (${versions.length})`, icon: Layers },
          { key: 'deadlines', label: `Deadlines (${deadlines.length})`, icon: Clock },
          { key: 'documents', label: `Documents (${documents.length})`, icon: FolderLock },
          { key: 'timeline', label: `Timeline (${timeline.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Dates & Workflow */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Key Contractual Dates &amp; Renewal Rules
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Execution Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.execution_date || 'Pending Execution'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Effective Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.effective_date || 'Upon Execution'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Expiry Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.expiry_date || 'Perpetual / Not Set'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Renewal Type:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.renewal_type} ({agreement.notice_days ? `${agreement.notice_days}d notice` : 'No notice period'})
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold">Key Terms &amp; Scope:</div>
              <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg leading-relaxed">
                {agreement.key_terms || 'No key terms recorded.'}
              </p>
            </div>
          </div>

          {/* Stamping & Registration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              Stamp Duty &amp; Statutory Registration
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Stamp Duty Amount:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.stamp_duty ? formatINR(agreement.stamp_duty) : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">e-Stamp Certificate / Ref:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.stamp_ref || 'Unstamped'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Registration Required:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.registration_required ? 'YES (Sub-Registrar)' : 'NO'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Registration No:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {agreement.registration_no || 'Pending'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold">Governing Law &amp; Jurisdiction:</div>
              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {agreement.governing_law || 'Indian Law; Courts of New Delhi'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parties Tab */}
      {activeTab === 'parties' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Contracting Parties &amp; Authorized Signatories
            </h3>
            <button
              type="button"
              onClick={() => setAddPartyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Party
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Party Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Signatory</th>
                  <th className="py-2.5 px-3">Email &amp; Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {parties.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {p.party_role || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {p.entity_type || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{p.signatory || '—'}</div>
                      <div className="text-[10px] text-slate-400">{p.designation}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {p.email && <div>{p.email}</div>}
                      {p.address && <div className="truncate max-w-xs">{p.address}</div>}
                    </td>
                  </tr>
                ))}
                {parties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No parties added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Version History &amp; Delivery Tracking
              </h3>
              <p className="text-[11px] text-slate-400">
                Every draft sent to Client, Counterparty, or Finalized signed copy
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadVersionOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Version
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-16 text-center">Ver</th>
                  <th className="py-2.5 px-3">Recipient / Target</th>
                  <th className="py-2.5 px-3">Sent Timestamp</th>
                  <th className="py-2.5 px-3">Change Summary</th>
                  <th className="py-2.5 px-3 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      v{v.version_no}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          v.sent_to === 'FINAL'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.sent_to === 'CLIENT'
                            ? 'bg-indigo-100 text-indigo-800'
                            : v.sent_to === 'COUNTERPARTY'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {v.sent_to}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {v.sent_at ? new Date(v.sent_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {v.change_summary || 'Initial draft / No notes'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {v.document ? (
                        <a
                          href={getDocumentDownloadLink(v.document)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No file attached</span>
                      )}
                    </td>
                  </tr>
                ))}
                {versions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No versions recorded yet. Upload draft version 1 to begin stakeholder review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deadlines Tab */}
      {activeTab === 'deadlines' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Contract Deadlines &amp; Renewal Reminders
            </h3>
            <button
              type="button"
              onClick={() => setAddDeadlineOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Deadline
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Deadline Title</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Basis</th>
                  <th className="py-2.5 px-3">Owner / Backup</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {deadlines.map((dl) => (
                  <tr key={dl.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {dl.title}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {dl.deadline_type}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {dl.due_date}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {dl.basis || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      <div>{dl.owner_profile?.display_name || 'Owner'}</div>
                      <div className="text-[10px] text-slate-400">
                        Backup: {dl.backup_profile?.display_name || 'Backup'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {dl.status === 'DONE' ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          COMPLETED
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await markDeadlineDone(dl.id);
                            const updated = await fetchDeadlines({ agreementId: agreement.id });
                            setDeadlines(updated);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          Mark Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {deadlines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No deadlines currently set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Vault Documents ({agreement.project_code?.code})
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Uploaded</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {doc.file_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {doc.category || 'Drafts'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <a
                        href={getDocumentDownloadLink(doc)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                      No documents stored in this project code yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Matter Audit Timeline (core.matter_events)
          </h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            {timeline.map((evt) => (
              <div key={evt.id} className="flex gap-3 text-xs border-l-2 border-indigo-500 pl-4 py-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {evt.event_code || 'EVENT'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(evt.occurred_at).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded">
                      {evt.source_app}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {evt.title}
                  </div>
                  {evt.detail && <p className="text-slate-500 mt-0.5">{evt.detail}</p>}
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div className="py-8 text-center text-slate-400 italic">No events logged yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Stage Advance Modal */}
      {stageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Select New Stage
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Stage
                </label>
                <select
                  value={pendingStage || agreement.stage}
                  onChange={(e) => setPendingStage(e.target.value as AgreementStage)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  {AGREEMENT_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {pendingStage === 'EXECUTED' && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl space-y-2 border border-indigo-100 dark:border-indigo-900">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Execution Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={executionDateInput}
                    onChange={(e) => setExecutionDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500">
                    Required: A signed copy version marked &lsquo;sent to FINAL&rsquo; must already exist.
                  </p>
                </div>
              )}
            </div>

            {stageError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{stageError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStageModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStageChange}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      {addPartyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddParty}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Add Contracting Party
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  value={newParty.name}
                  onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                  placeholder="e.g. Acme Innovations Pvt Ltd"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Role</label>
                  <select
                    value={newParty.party_role}
                    onChange={(e) => setNewParty({ ...newParty, party_role: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="FIRST_PARTY">First Party</option>
                    <option value="SECOND_PARTY">Second Party</option>
                    <option value="CONFIRMING_PARTY">Confirming Party</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Entity Type</label>
                  <select
                    value={newParty.entity_type}
                    onChange={(e) => setNewParty({ ...newParty, entity_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="PRIVATE_LIMITED">Private Limited</option>
                    <option value="PUBLIC_LIMITED">Public Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Signatory &amp; Designation</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newParty.signatory}
                    onChange={(e) => setNewParty({ ...newParty, signatory: e.target.value })}
                    placeholder="Signatory Name"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                  <input
                    type="text"
                    value={newParty.designation}
                    onChange={(e) => setNewParty({ ...newParty, designation: e.target.value })}
                    placeholder="e.g. Director"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddPartyOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Party
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Version Modal */}
      {uploadVersionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUploadVersion}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Upload Agreement Version
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Recipient / Sent To *</label>
                <select
                  value={versionSentTo}
                  onChange={(e) => setVersionSentTo(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="INTERNAL">INTERNAL (Internal Draft / Review)</option>
                  <option value="CLIENT">CLIENT (Delivered for Client Approval)</option>
                  <option value="COUNTERPARTY">COUNTERPARTY (Sent to Counterparty Counsel)</option>
                  <option value="FINAL">FINAL (Fully Executed / Signed Copy)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Document File</label>
                <input
                  type="file"
                  onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Change Summary / Notes</label>
                <textarea
                  rows={2}
                  value={versionSummary}
                  onChange={(e) => setVersionSummary(e.target.value)}
                  placeholder="Key additions or modifications in this iteration..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUploadVersionOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={versionUploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {versionUploading ? 'Uploading...' : 'Save Version'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Deadline Modal */}
      {addDeadlineOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddDeadline}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Add Contract Deadline
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
                  placeholder="e.g. Renewal notice period window closes"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDeadline.due_date}
                    onChange={(e) => setNewDeadline({ ...newDeadline, due_date: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Type</label>
                  <select
                    value={newDeadline.deadline_type}
                    onChange={(e) => setNewDeadline({ ...newDeadline, deadline_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="RENEWAL">RENEWAL</option>
                    <option value="STATUTORY">STATUTORY</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Owner *</label>
                  <select
                    required
                    value={newDeadline.owner_user_id}
                    onChange={(e) => setNewDeadline({ ...newDeadline, owner_user_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">Select Owner</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Backup Owner *</label>
                  <select
                    required
                    value={newDeadline.backup_user_id}
                    onChange={(e) => setNewDeadline({ ...newDeadline, backup_user_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">Select Backup</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddDeadlineOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Deadline
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default AgreementDetailView;
