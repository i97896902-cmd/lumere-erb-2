import React, { useState, useRef, useEffect } from 'react';
import { Building2, Check, ChevronDown, Layers } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { getCompanyInitials, PARENT_COMPANY_ID } from '../../config/companies';

interface CompanySwitcherProps {
  compact?: boolean;
  onCompanyChanged?: (companyId: string) => void;
}

export function CompanySwitcher({ compact = false, onCompanyChanged }: CompanySwitcherProps) {
  const { canSwitchCompanies } = useAuth();
  const { companies, activeCompany, activeCompanyId, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const accentColor = activeCompany?.theme?.primary || '#059669';

  const handleSelect = (companyId: string) => {
    switchCompany(companyId);
    setOpen(false);
    onCompanyChanged?.(companyId);
  };

  // Non-SUPER_ADMIN users see their locked company badge (read-only)
  if (!canSwitchCompanies) {
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/90 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2 w-full'
        }`}
        dir="rtl"
      >
        {activeCompany.logo ? (
          <img
            src={activeCompany.logo}
            alt={activeCompany.name}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg object-cover border border-neutral-200 shrink-0"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            {getCompanyInitials(activeCompany.name)}
          </div>
        )}
        <div className="min-w-0 flex-1 text-right">
          <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
            {activeCompany.name}
          </p>
          {!compact && (
            <p className="text-[10px] text-neutral-500 truncate leading-tight">
              {activeCompany.arabicName || activeCompany.businessSector}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${compact ? '' : 'w-full'}`} dir="rtl">
      <button
        type="button"
        id="company-switcher-trigger"
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center justify-between gap-2.5 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer ${
          compact ? 'px-2.5 py-1.5 min-w-[180px]' : 'px-3 py-2 w-full'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {activeCompany.logo ? (
            <img
              src={activeCompany.logo}
              alt={activeCompany.name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-lg object-cover border border-neutral-200 shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {activeCompany.type === 'parent' ? (
                <Layers className="w-3.5 h-3.5" />
              ) : (
                getCompanyInitials(activeCompany.name)
              )}
            </div>
          )}

          <div className="min-w-0 text-right">
            <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
              {activeCompany.name}
            </p>
            <p className="text-[10px] text-neutral-500 truncate leading-tight">
              {activeCompany.id === PARENT_COMPANY_ID
                ? 'إدارة المجموعة المركزية'
                : activeCompany.arabicName || activeCompany.businessSector || 'شركة تابعة'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-xl border border-neutral-200 shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-neutral-100 bg-neutral-50/70">
            <p className="text-[11px] font-bold text-neutral-700">تبديل مساحة عمل الشركة</p>
            <p className="text-[10px] text-neutral-500">
              انتقل بين الإدارة المركزية أو أي شركة تابعة
            </p>
          </div>

          <div className="p-1.5 max-h-80 overflow-y-auto space-y-1">
            {companies.map(company => {
              const isSelected = company.id === activeCompanyId;
              const isParent = company.type === 'parent';
              const companyAccent = company.theme?.primary || (isParent ? '#059669' : '#334155');
              const isInactive = company.status === 'inactive';

              return (
                <button
                  key={company.id}
                  type="button"
                  id={`switch-company-${company.id}`}
                  onClick={() => handleSelect(company.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-right transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover border border-neutral-200 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: companyAccent }}
                      >
                        {isParent ? (
                          <Layers className="w-3.5 h-3.5" />
                        ) : (
                          getCompanyInitials(company.name)
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-neutral-900 truncate">
                          {company.name}
                        </span>
                        {isParent && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            · القابضة
                          </span>
                        )}
                        {isInactive && (
                          <span className="text-[10px] text-rose-600 font-semibold">
                            · متوقفة
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {company.arabicName || company.businessSector || 'شركة تابعة'}
                      </p>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
