interface ReportExportActionsProps {
  onPdfExport: () => void;
  onExcelExport: () => void;
}

// Compact shared report-export controls shown beside the calculator tabs.
export function ReportExportActions({ onPdfExport, onExcelExport }: ReportExportActionsProps) {
  const buttonClass = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPdfExport}
        className={`${buttonClass} bg-slate-800 text-white hover:bg-slate-700`}
      >
        <i className="fa-solid fa-file-pdf text-sky-300" aria-hidden="true" />
        PDF
      </button>
      <button
        type="button"
        onClick={onExcelExport}
        className={`${buttonClass} bg-sky-700 text-white hover:bg-sky-600`}
      >
        <i className="fa-solid fa-file-excel text-emerald-200" aria-hidden="true" />
        Excel
      </button>
    </div>
  );
}
