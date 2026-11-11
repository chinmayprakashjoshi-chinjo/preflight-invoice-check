import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`w-full bg-[#0B0F2A] text-white border-b border-white/5 ${className}`}>
      <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-7 desk:px-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
