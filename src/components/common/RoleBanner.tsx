// src/components/common/RoleBanner.tsx
import React from 'react';
import { Shield, Eye } from 'lucide-react';
import { getViewAsRole, Role, setViewAsRole, UserProfile } from '../../lib/auth';

interface RoleBannerProps {
  currentUser: UserProfile | null;
  onRoleChange: () => void;
}

export const RoleBanner: React.FC<RoleBannerProps> = ({ currentUser, onRoleChange }) => {
  const activeViewRole = getViewAsRole();

  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return null;
  }

  const handleClear = () => {
    setViewAsRole(null);
    onRoleChange();
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Role | '';
    setViewAsRole(val ? (val as Role) : null);
    onRoleChange();
  };

  return (
    <div className="bg-indigo-900 text-indigo-100 px-4 py-1.5 text-xs flex items-center justify-between z-50">
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-semibold text-white">Super Admin Mode</span>
        <span className="hidden sm:inline text-indigo-300">
          (Simulate permissions and ethical wall visibility for other staff roles)
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Eye className="w-3.5 h-3.5 text-indigo-300" />
        <span className="text-indigo-200">View as:</span>
        <select
          value={activeViewRole || ''}
          onChange={handleChange}
          className="bg-indigo-800 text-white border border-indigo-700 rounded px-2 py-0.5 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="">Actual (SUPER_ADMIN)</option>
          <option value="DEPT_ADMIN">Litigation Head (DEPT_ADMIN)</option>
          <option value="ASSOCIATE">Associate</option>
          <option value="INTERN">Intern (Walled/Team Only)</option>
          <option value="FINANCE">Finance (Read-only, No Notes)</option>
        </select>
        {activeViewRole && (
          <button
            onClick={handleClear}
            className="text-[11px] underline text-indigo-300 hover:text-white ml-1"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
