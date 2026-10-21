// src/features/cases/EditCaseModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Scale, Calendar, Coins } from 'lucide-react';
import { updateCase, fetchProfiles, saveCaseQuotation } from '../../lib/api';
import { uploadLitigatorFile } from '../../lib/files';
import { getStoredUser, isSuperAdminOrFinance, formatProfileRole } from '../../lib/auth';
import { CASE_STAGES, CaseRecord, CaseType, ClientRole, CoreProfile } from '../../lib/types';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  theCase: CaseRecord;
}

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: 'COMMERCIAL_SUIT', label: 'Commercial Suit' },
  { value: 'CIVIL_SUIT', label: 'Civil Suit' },
  { value: 'IP_INFRINGEMENT', label: 'IP Infringement / Trademark Suit' },
  { value: 'WRIT', label: 'Writ Petition' },
  { value: 'APPEAL', label: 'Appeal' },
  { value: 'ARBITRATION', label: 'Arbitration / Sec 9 / Sec 34' },
  { value: 'CONSUMER', label: 'Consumer Dispute' },
  { value: 'CRIMINAL_COMPLAINT', label: 'Criminal Complaint / NI Act 138' },
  { value: 'PRE_LITIGATION', label: 'Pre-Litigation / Legal Notice' },
  { value: 'OTHER', label: 'Other Court Matter' },
];

const CLIENT_ROLES: { value: ClientRole; label: string }[] = [
  { value: 'PLAINTIFF', label: 'Plaintiff' },
  { value: 'DEFENDANT', label: 'Defendant' },
  { value: 'PETITIONER', label: 'Petitioner' },
  { value: 'RESPONDENT', label: 'Respondent' },
  { value: 'APPELLANT', label: 'Appellant' },
  { value: 'COMPLAINANT', label: 'Complainant' },
  { value: 'OTHER', label: 'Other' },
];

export const EditCaseModal: React.FC<EditCaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  theCase,
}) => {
  const currentUser = getStoredUser();
  const canManageQuotation = isSuperAdminOrFinance(currentUser);

  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [causeTitle, setCauseTitle] = useState(theCase.cause_title || '');
  const [caseType, setCaseType] = useState<CaseType>(theCase.case_type || 'COMMERCIAL_SUIT');
  const [court, setCourt] = useState(theCase.court || '');
  const [bench, setBench] = useState(theCase.bench || '');
  const [caseNumber, setCaseNumber] = useState(theCase.case_number || '');
  const [cnrNumber, setCnrNumber] = useState(theCase.cnr_number || '');
  const [filingDate, setFilingDate] = useState(theCase.filing_date || '');
  const [clientRole, setClientRole] = useState<ClientRole>(theCase.client_role || 'PLAINTIFF');
  const [currentStage, setCurrentStage] = useState(theCase.current_stage || 'Suit filed');
  const [leadUserId, setLeadUserId] = useState(theCase.lead_user_id || '');
  const [claimValue, setClaimValue] = useState<number | ''>(theCase.claim_value ?? '');
  const [courtFee, setCourtFee] = useState<number | ''>(theCase.court_fee ?? '');
  const [nextHearingDate, setNextHearingDate] = useState(theCase.next_hearing_date || '');
  const [nextPurpose, setNextPurpose] = useState(theCase.next_purpose || '');

  // Quotation fields
  const [quotationAmount, setQuotationAmount] = useState<number | ''>(
    theCase.quotation?.total_prof_fee ?? theCase.quotation_amount ?? ''
  );
  const [quotationNumber, setQuotationNumber] = useState(
    theCase.quotation?.quote_number ?? theCase.quotation_number ?? ''
  );
  const [quotationFile, setQuotationFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then(setProfiles).catch(console.error);
      setCauseTitle(theCase.cause_title || '');
      setCaseType(theCase.case_type || 'COMMERCIAL_SUIT');
      setCourt(theCase.court || '');
      setBench(theCase.bench || '');
      setCaseNumber(theCase.case_number || '');
      setCnrNumber(theCase.cnr_number || '');
      setFilingDate(theCase.filing_date || '');
      setClientRole(theCase.client_role || 'PLAINTIFF');
      setCurrentStage(theCase.current_stage || 'Suit filed');
      setLeadUserId(theCase.lead_user_id || '');
      setClaimValue(theCase.claim_value ?? '');
      setCourtFee(theCase.court_fee ?? '');
      setNextHearingDate(theCase.next_hearing_date || '');
      setNextPurpose(theCase.next_purpose || '');
      setQuotationAmount(theCase.quotation?.total_prof_fee ?? theCase.quotation_amount ?? '');
      setQuotationNumber(theCase.quotation?.quote_number ?? theCase.quotation_number ?? '');
      setError(null);
    }
  }, [isOpen, theCase]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!causeTitle.trim()) {
      setError('Please provide a Cause Title.');
      return;
    }
    if (!court.trim()) {
      setError('Please provide the Court or Forum name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateCase(theCase.id, {
        cause_title: causeTitle.trim(),
        case_type: caseType,
        court: court.trim(),
        bench: bench.trim() || null,
        case_number: caseNumber.trim() || null,
        cnr_number: cnrNumber.trim() || null,
        filing_date: filingDate.trim() || null,
        client_role: clientRole,
        current_stage: currentStage as any,
        lead_user_id: leadUserId || null,
        claim_value: claimValue ? Number(claimValue) : null,
        court_fee: courtFee ? Number(courtFee) : null,
        next_hearing_date: nextHearingDate || null,
        next_purpose: nextPurpose.trim() || null,
      });

      if (canManageQuotation && theCase.project_code_id) {
        if (quotationFile) {
          try {
            await uploadLitigatorFile({
              file: quotationFile,
              category: 'Quotation',
              clientCode: theCase.project_code?.client?.client_code,
              clientName: theCase.project_code?.client?.client_name,
              projectCode: theCase.project_code?.code,
              projectCodeId: theCase.project_code_id,
              financeOnly: true,
              uploadedByUserId: currentUser?.id,
            });
          } catch (fErr) {
            console.warn('Could not upload quotation document:', fErr);
          }
        }

        if (quotationAmount !== '') {
          try {
            await saveCaseQuotation({
              projectCodeId: theCase.project_code_id,
              clientId: theCase.project_code?.client_id,
              quoteNumber: quotationNumber.trim() || `Q-${theCase.project_code?.code || theCase.id.slice(0, 8)}`,
              totalProfFee: Number(quotationAmount),
            });
          } catch (qErr) {
            console.warn('Could not update quotation:', qErr);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update case details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                {theCase.project_code?.code || 'CASE'}
              </span>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Edit Case Information &amp; Details
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Modify court particulars, filing date, stage, claim value, or case metadata
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Matter Identification */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              <span>Matter Particulars</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cause Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={causeTitle}
                onChange={(e) => setCauseTitle(e.target.value)}
                placeholder="e.g. Acme Corp vs. Innovatech Solutions Pvt Ltd"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Case Type
                </label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as CaseType)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  {CASE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Court / Forum <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="e.g. Delhi High Court, Commercial Court"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bench / Courtroom
                </label>
                <input
                  type="text"
                  value={bench}
                  onChange={(e) => setBench(e.target.value)}
                  placeholder="e.g. Court No. 12, Division Bench II"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Case Number
                </label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g. CS(COMM) 412/2026"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CNR Number
                </label>
                <input
                  type="text"
                  value={cnrNumber}
                  onChange={(e) => setCnrNumber(e.target.value)}
                  placeholder="e.g. DLDH010023452026"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Filing
                </label>
                <input
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Reflected on Master Timeline as Filing Date
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Roles, Stage & Lead Counsel */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Roles, Stage &amp; Assignment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client Role
                </label>
                <select
                  value={clientRole}
                  onChange={(e) => setClientRole(e.target.value as ClientRole)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  {CLIENT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Stage
                </label>
                <select
                  value={currentStage}
                  onChange={(e) => setCurrentStage(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  {CASE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Counsel
                </label>
                <select
                  value={leadUserId}
                  onChange={(e) => setLeadUserId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select counsel...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({formatProfileRole(p)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Next Hearing Schedule */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Next Hearing Schedule
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Next Hearing Date
                </label>
                <input
                  type="date"
                  value={nextHearingDate}
                  onChange={(e) => setNextHearingDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Purpose / Listing Stage
                </label>
                <input
                  type="text"
                  value={nextPurpose}
                  onChange={(e) => setNextPurpose(e.target.value)}
                  placeholder="e.g. Arguments on stay application"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Financials & Quotation */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Claim Value &amp; Financials</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Claim / Suit Value (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={claimValue}
                  onChange={(e) => setClaimValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5000000"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Court Fee Paid (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={courtFee}
                  onChange={(e) => setCourtFee(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 75000"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {canManageQuotation && (
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl space-y-2">
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>Client Quotation / Professional Fee</span>
                  <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                    Visible to Superadmin &amp; Finance Only
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Professional Fee Agreed (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quotationAmount}
                      onChange={(e) =>
                        setQuotationAmount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="e.g. 250000"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Quotation Number / Ref
                    </label>
                    <input
                      type="text"
                      value={quotationNumber}
                      onChange={(e) => setQuotationNumber(e.target.value)}
                      placeholder="e.g. Q-LIT-2026-1042"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Attach Quotation PDF / Document
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setQuotationFile(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 dark:file:bg-amber-900 file:text-amber-800 dark:file:text-amber-200 hover:file:bg-amber-200 cursor-pointer"
                  />
                  {quotationFile && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                      Selected: {quotationFile.name} ({(quotationFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>Saving Changes...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Case Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
