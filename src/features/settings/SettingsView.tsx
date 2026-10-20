// src/features/settings/SettingsView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  Coins,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User,
  Building,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { fetchProfiles, createTeamUser, deleteTeamUser } from '../../lib/api';
import { getStoredUser, canManageTeam, isSuperAdmin } from '../../lib/auth';
import type { CoreProfile } from '../../lib/types';

export const SettingsView: React.FC = () => {
  const currentUser = getStoredUser();
  const isAdmin = canManageTeam(currentUser);

  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'FINANCE' | 'ASSOCIATE'>('ASSOCIATE');
  const [newDept, setNewDept] = useState<'LITIGATION' | 'FINANCE' | 'MANAGEMENT'>('LITIGATION');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfiles();
      setProfiles(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const superAdminCount = useMemo(() => {
    return profiles.filter((p) => p.role === 'SUPER_ADMIN').length;
  }, [profiles]);

  const financeCount = useMemo(() => {
    return profiles.filter((p) => p.role === 'FINANCE').length;
  }, [profiles]);

  const associateCount = useMemo(() => {
    return profiles.filter((p) => p.role === 'ASSOCIATE').length;
  }, [profiles]);

  const handleOpenAddModal = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('ASSOCIATE');
    setNewDept('LITIGATION');
    setModalError(null);
    setAddModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setModalError('Please fill in all required fields.');
      return;
    }

    if (newPassword.length < 6) {
      setModalError('Password must be at least 6 characters.');
      return;
    }

    if (newRole === 'SUPER_ADMIN' && superAdminCount >= 2) {
      setModalError('Maximum limit of 2 Super Admins reached. Only two Super Admins can exist at a time.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      await createTeamUser({
        displayName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword.trim(),
        role: newRole,
        department: newDept,
      });

      setAddModalOpen(false);
      await loadProfiles();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (profile: CoreProfile) => {
    if (profile.id === currentUser?.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (profile.role === 'SUPER_ADMIN' && superAdminCount <= 1) {
      alert('Cannot delete the last remaining Super Admin.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${profile.display_name} (${profile.email}) from the firm team?`
    );
    if (!confirmed) return;

    setDeletingId(profile.id);
    try {
      await deleteTeamUser(profile.id);
      await loadProfiles();
    } catch (err: any) {
      alert(`Could not delete user: ${err?.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Firm Settings &amp; Team Access
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure firm team member accounts, enforce role policies, and manage operational access across the portal.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        )}
      </div>

      {/* Role Policy Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Super Admin */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Super Admin</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              superAdminCount >= 2
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
            }`}>
              {superAdminCount} / 2 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Full administrative control over all court cases, hearings, pleadings, quotation documents &amp; fee agreements, and user management.
          </p>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Full case editing &amp; team management</span>
            </div>
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Quotations view, upload &amp; delete</span>
            </div>
          </div>
        </div>

        {/* Card 2: Finance Head */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Finance Head</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {financeCount} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Read-only visibility across all litigation cases, progression timelines, hearings, orders, and notes. Full control over quotation documents.
          </p>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Quotation upload, edit, delete &amp; in-dashboard view</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Read-only access to case particulars &amp; hearings</span>
            </div>
          </div>
        </div>

        {/* Card 3: Litigation Associate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Litigation Associate</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {associateCount} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Hands-on litigation operations: log and edit hearings, court orders, statutory deadlines, parties, internal notes, and document vault uploads.
          </p>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>All case entries, hearing logs &amp; document uploads</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Quotations and admin settings strictly hidden</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Active Firm Team Members ({profiles.length})
            </h2>
            <p className="text-xs text-slate-500">
              Team members configured with access to the Lextria Litigator platform
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading team members...</div>
        ) : error ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No team members found.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {profiles.map((p) => {
              const isCurrent = p.id === currentUser?.id;
              const isSuper = p.role === 'SUPER_ADMIN';
              const isFin = p.role === 'FINANCE';
              const isAssoc = p.role === 'ASSOCIATE';

              return (
                <div key={p.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60">
                      {p.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{p.display_name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{p.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                        isSuper
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                          : isFin
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isSuper ? <Shield className="w-3 h-3" /> : isFin ? <Coins className="w-3 h-3" /> : <Scale className="w-3 h-3" />}
                      <span>{p.role.replace(/_/g, ' ')}</span>
                    </span>

                    <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                      {p.department}
                    </span>

                    {isAdmin && !isCurrent && (
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDeleteUser(p)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Remove Team Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Team Member Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Add Team Member
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Provision a login and assign operational access role
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Adv. Ritu Sengupta"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. ritu@lextria.in"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Access Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const r = e.target.value as any;
                    setNewRole(r);
                    if (r === 'FINANCE') setNewDept('FINANCE');
                    else if (r === 'SUPER_ADMIN') setNewDept('MANAGEMENT');
                    else setNewDept('LITIGATION');
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="ASSOCIATE">Litigation Associate (Full litigation data &amp; doc operations)</option>
                  <option value="FINANCE">Finance Head (Read-only cases, full quotation control)</option>
                  <option value="SUPER_ADMIN" disabled={superAdminCount >= 2}>
                    Super Admin {superAdminCount >= 2 ? '(Limit reached: Max 2 allowed)' : '(Full management &amp; settings)'}
                  </option>
                </select>

                {newRole === 'SUPER_ADMIN' && superAdminCount >= 2 && (
                  <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Maximum 2 Super Admins allowed. Please choose another role.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value as any)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LITIGATION">LITIGATION</option>
                    <option value="FINANCE">FINANCE</option>
                    <option value="MANAGEMENT">MANAGEMENT</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (newRole === 'SUPER_ADMIN' && superAdminCount >= 2)}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {submitting ? 'Creating User...' : 'Create Team User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
