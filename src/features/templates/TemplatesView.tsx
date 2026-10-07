// src/features/templates/TemplatesView.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBox,
  Plus,
  Copy,
  Download,
  Search,
  Sparkles,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  fetchTemplates,
  createTemplate,
  fetchClients,
  createClient,
  fetchProjectCodes,
  createProjectCode,
  createAgreement,
  addAgreementVersion,
  fetchProfiles,
} from '../../lib/api';
import { uploadLitigatorFile, getDocumentDownloadLink } from '../../lib/files';
import {
  AGREEMENT_TYPES,
  TemplateRecord,
  CoreClient,
  CoreProjectCode,
  CoreProfile,
} from '../../lib/types';

export const TemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [startFromTemplateModal, setStartFromTemplateModal] = useState<TemplateRecord | null>(null);

  // New Template form state
  const [newTmpl, setNewTmpl] = useState({
    name: '',
    agreement_type: 'NDA',
    notes: '',
  });
  const [tmplFile, setTmplFile] = useState<File | null>(null);
  const [creatingTmpl, setCreatingTmpl] = useState(false);

  // Start from Template form state
  const [startClientId, setStartClientId] = useState('');
  const [startProjectCode, setStartProjectCode] = useState('');
  const [startTitle, setStartTitle] = useState('');
  const [startLeadId, setStartLeadId] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tmplList, clientList, profList] = await Promise.all([
        fetchTemplates(selectedType || undefined),
        fetchClients(),
        fetchProfiles(),
      ]);
      setTemplates(tmplList);
      setClients(clientList);
      setProfiles(profList);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTmpl(true);
    try {
      let docId: string | null = null;
      if (tmplFile) {
        // Upload template file to templates folder
        const uploaded = await uploadLitigatorFile({
          file: tmplFile,
          projectCode: 'LEGAL-TEMPLATES',
          clientCode: 'INTERNAL',
          clientName: 'Lextria Research',
          category: 'Drafts',
        });
        docId = uploaded.id;
      }

      await createTemplate({
        name: newTmpl.name,
        agreementType: newTmpl.agreement_type,
        documentId: docId,
        notes: newTmpl.notes || undefined,
      });

      setNewTemplateOpen(false);
      setNewTmpl({ name: '', agreement_type: 'NDA', notes: '' });
      setTmplFile(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create template');
    } finally {
      setCreatingTmpl(false);
    }
  };

  const handleStartFromTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startFromTemplateModal) return;
    setStarting(true);
    setStartError(null);
    try {
      if (!startClientId) throw new Error('Please select a client');
      if (!startProjectCode) throw new Error('Please enter a project code');
      if (!startTitle) throw new Error('Please enter an agreement title');

      // 1. Create or get Project Code
      const projectCode = await createProjectCode({
        code: startProjectCode.trim().toUpperCase(),
        clientId: startClientId,
        department: 'AGREEMENT',
        title: startTitle,
        leadAssigneeId: startLeadId || null,
      });

      // 2. Create Agreement
      const newAgr = await createAgreement({
        projectCodeId: projectCode.id,
        agreementType: startFromTemplateModal.agreement_type,
        title: startTitle,
        stage: 'DRAFTING',
        leadUserId: startLeadId || undefined,
        keyTerms: startFromTemplateModal.notes || undefined,
      });

      // 3. If template has a document_id, copy it as version 1!
      if (startFromTemplateModal.document_id) {
        await addAgreementVersion({
          agreementId: newAgr.id,
          versionNo: 1,
          documentId: startFromTemplateModal.document_id,
          sentTo: 'INTERNAL',
          changeSummary: `Generated from master template: ${startFromTemplateModal.name}`,
        });
      }

      setStartFromTemplateModal(null);
      navigate(`/agreements/${newAgr.id}`);
    } catch (err: any) {
      setStartError(err.message || 'Failed to start agreement from template');
    } finally {
      setStarting(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.name.toLowerCase().includes(s) || t.agreement_type.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <FileBox className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Standard Legal Template Library
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pre-approved contract templates, standard clauses, and 1-click &lsquo;Start from Template&rsquo; drafting
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewTemplateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search template name, agreement type..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="w-48">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          >
            <option value="">All Agreement Types</option>
            {AGREEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading templates library...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <FileBox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            No Templates in Library
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload your standard bilateral NDA, master services agreement, or employment contract to speed up matter drafting.
          </p>
          <button
            type="button"
            onClick={() => setNewTemplateOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            Upload Master Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl p-5 shadow-2xs transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {tmpl.agreement_type}
                  </span>
                  {tmpl.document && (
                    <a
                      href={getDocumentDownloadLink(tmpl.document)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Template DOCX
                    </a>
                  )}
                </div>

                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {tmpl.name}
                </h3>

                {tmpl.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {tmpl.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setStartFromTemplateModal(tmpl);
                    setStartTitle(`${tmpl.name} - `);
                    setStartProjectCode(`AGR-${new Date().getFullYear()}-`);
                    setStartError(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Start from Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start From Template Modal */}
      {startFromTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleStartFromTemplateSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Start Agreement from &ldquo;{startFromTemplateModal.name}&rdquo;
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              This will create a new matter in the Agreements Vault and seed Version 1 with the master template.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Client *</label>
                <select
                  required
                  value={startClientId}
                  onChange={(e) => setStartClientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="">Select Existing Client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_code} &bull; {c.client_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Project Code *</label>
                <input
                  type="text"
                  required
                  value={startProjectCode}
                  onChange={(e) => setStartProjectCode(e.target.value)}
                  placeholder="e.g. AGR-2026-0042"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Agreement Title *</label>
                <input
                  type="text"
                  required
                  value={startTitle}
                  onChange={(e) => setStartTitle(e.target.value)}
                  placeholder="e.g. Mutual Non-Disclosure Agreement with Acme"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Lead Drafter</label>
                <select
                  value={startLeadId}
                  onChange={(e) => setStartLeadId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  <option value="">Assign Drafter</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {startError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{startError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStartFromTemplateModal(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={starting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {starting ? 'Creating...' : 'Initialize & Open Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Template Modal */}
      {newTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTemplate}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Add New Standard Template
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={newTmpl.name}
                  onChange={(e) => setNewTmpl({ ...newTmpl, name: e.target.value })}
                  placeholder="e.g. Master Software Licence Agreement (Standard)"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Agreement Type *</label>
                <select
                  value={newTmpl.agreement_type}
                  onChange={(e) => setNewTmpl({ ...newTmpl, agreement_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  {AGREEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Standard Document File</label>
                <input
                  type="file"
                  onChange={(e) => setTmplFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Standard Notes / Clauses</label>
                <textarea
                  rows={3}
                  value={newTmpl.notes}
                  onChange={(e) => setNewTmpl({ ...newTmpl, notes: e.target.value })}
                  placeholder="Governing clauses, standard indemnity caps, warranty disclaimers..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewTemplateOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingTmpl}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {creatingTmpl ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default TemplatesView;
