// src/components/common/ClientSearchSelect.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react';
import type { CoreClient } from '../../lib/types';

export interface ClientSearchSelectProps {
  clients: CoreClient[];
  value: string;
  onChange: (clientId: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  allowAllOption?: boolean;
  allOptionLabel?: string;
}

export const ClientSearchSelect: React.FC<ClientSearchSelectProps> = ({
  clients,
  value,
  onChange,
  required = false,
  placeholder = 'Search & select client...',
  disabled = false,
  className = '',
  allowClear = false,
  allowAllOption = false,
  allOptionLabel = 'All Clients...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected client record
  const selectedClient = useMemo(() => {
    if (!value) return null;
    return clients.find((c) => c.id === value) || null;
  }, [clients, value]);

  // Filter clients based on search query (matches name or code)
  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.client_code.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = (allowAllOption ? 1 : 0) + filteredClients.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < totalItems ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allowAllOption && highlightedIndex === 0) {
        onChange('');
        setIsOpen(false);
      } else {
        const clientIndex = allowAllOption ? highlightedIndex - 1 : highlightedIndex;
        const target = filteredClients[clientIndex];
        if (target) {
          onChange(target.id);
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelectClient = (clientId: string) => {
    onChange(clientId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-lg transition text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-500'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 pr-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {selectedClient ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="px-1.5 py-0.5 font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded shrink-0">
                {selectedClient.client_code}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {selectedClient.client_name}
              </span>
            </div>
          ) : allowAllOption && !value ? (
            <span className="font-medium text-slate-700 dark:text-slate-300">{allOptionLabel}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1 text-slate-400">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Clear client selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}
          />
        </div>
      </button>

      {/* Hidden input for HTML form requirement validation if needed */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Type name or code (e.g. VKVIS, Robust)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
              <span>
                Showing {filteredClients.length} of {clients.length} clients
              </span>
              <span className="font-mono">Use ↑↓ &amp; Enter</span>
            </div>
          </div>

          {/* Client Options List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-800/60">
            {allowAllOption && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectClient('')}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                  highlightedIndex === 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{allOptionLabel}</span>
                {!value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
              </div>
            )}

            {filteredClients.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                No clients found matching <span className="font-semibold text-slate-600 dark:text-slate-300">"{searchQuery}"</span>
              </div>
            ) : (
              filteredClients.map((c, idx) => {
                const itemIndex = allowAllOption ? idx + 1 : idx;
                const isSelected = value === c.id;
                const isHighlighted = highlightedIndex === itemIndex;

                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectClient(c.id)}
                    onMouseEnter={() => setHighlightedIndex(itemIndex)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                      isHighlighted
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100'
                        : isSelected
                        ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                        {c.client_code}
                      </span>
                      <span className="truncate font-medium">{c.client_name}</span>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
