"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Wand2,
  Download,
  RotateCcw,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type DataType = "transactions" | "customers" | "revenue" | "all";
type StepId = 1 | 2 | 3 | 4 | 5;

interface ParsedRow {
  [key: string]: string;
}

interface ValidationIssue {
  row: number;
  column: string;
  severity: "error" | "warning";
  message: string;
}

interface ImportHistoryEntry {
  id: string;
  timestamp: Date;
  fileName: string;
  dataType: DataType;
  recordsImported: number;
  status: "Success" | "Partial" | "Failed";
}

// ── Required / optional field definitions ────────────────────────────────────

const REQUIRED_FIELDS = [
  { key: "customerName",  label: "Customer Name",       required: true  },
  { key: "arrivalDate",   label: "Arrival Date & Time", required: true  },
  { key: "weight",        label: "Weight (kg)",         required: true  },
  { key: "washType",      label: "Wash Type",           required: true  },
  { key: "fee",           label: "Fee",                 required: true  },
  { key: "status",        label: "Status",              required: true  },
  { key: "phone",         label: "Phone Number",        required: false },
  { key: "addons",        label: "Add-ons",             required: false },
  { key: "notes",         label: "Notes",               required: false },
];

const AUTO_MATCH_HINTS: Record<string, string[]> = {
  customerName:  ["customer", "name", "client", "customer name", "full name"],
  arrivalDate:   ["date", "arrival", "drop", "dropoff", "drop-off", "drop off", "datetime", "time"],
  weight:        ["weight", "kg", "kilos", "mass"],
  washType:      ["wash", "type", "service", "wash type", "service type"],
  fee:           ["fee", "amount", "price", "cost", "charge", "total"],
  status:        ["status", "state", "stage"],
  phone:         ["phone", "mobile", "contact", "number", "cell"],
  addons:        ["addon", "add-on", "extras", "additional"],
  notes:         ["note", "notes", "remarks", "comment"],
};

// ── CSV Template content ──────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "Customer Name,Arrival Date & Time,Weight (kg),Wash Type,Fee,Status,Phone Number,Add-ons,Notes",
  "Juan Dela Cruz,2025-01-15 08:30,5.2,Wash & Dry,150,Claimed,09171234567,Fabric Softener,Handle with care",
  "Maria Santos,2025-01-15 09:00,3.8,Wash Only,95,Claimed,09281234567,,",
].join("\n");

const EXCEL_TEMPLATE_HEADERS = "Customer Name\tArrival Date & Time\tWeight (kg)\tWash Type\tFee\tStatus\tPhone Number\tAdd-ons\tNotes";
const EXCEL_TEMPLATE_EXAMPLE = "Juan Dela Cruz\t2025-01-15 08:30\t5.2\tWash & Dry\t150\tClaimed\t09171234567\tFabric Softener\tHandle with care";

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Data Type"  },
  { id: 2, label: "Upload"     },
  { id: 3, label: "Map"        },
  { id: 4, label: "Preview"    },
  { id: 5, label: "Complete"   },
];

function StepIndicator({ current }: { current: StepId }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {STEPS.map((step, idx) => {
        const done    = step.id < current;
        const active  = step.id === current;
        return (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  done   && "bg-primary border-primary text-white",
                  active && "bg-white border-primary text-primary",
                  !done && !active && "bg-muted border-border text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : step.id}
              </div>
              <span className={cn(
                "text-[10px] font-medium hidden sm:block",
                active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                "w-10 sm:w-16 h-0.5 mx-1 transition-colors",
                done ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DataImportProps {
  onViewTransactions: () => void;
}

export default function DataImportPage({ onViewTransactions }: DataImportProps) {
  // Wizard state
  const [step, setStep]           = useState<StepId>(1);
  const [dataType, setDataType]   = useState<DataType | null>(null);

  // File state
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  // Parsed data state
  const [headers, setHeaders]     = useState<string[]>([]);
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Column mapping state
  const [mapping, setMapping]     = useState<Record<string, string>>({});

  // Validation state
  const [issues, setIssues]       = useState<ValidationIssue[]>([]);
  const [skipErrors, setSkipErrors] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "overwrite" | null>(null);
  const [duplicateCount]          = useState(3); // simulated

  // Import progress state
  const [importing, setImporting]      = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone]    = useState(false);
  const [importResult, setImportResult] = useState({ total: 0, skipped: 0, dupsSkipped: 0, seconds: 0 });

  // History
  const [history, setHistory]          = useState<ImportHistoryEntry[]>([
    {
      id: "h1",
      timestamp: new Date(2025, 2, 10, 9, 15),
      fileName: "march_records.csv",
      dataType: "transactions",
      recordsImported: 312,
      status: "Success",
    },
    {
      id: "h2",
      timestamp: new Date(2025, 1, 14, 14, 30),
      fileName: "feb_customers.xlsx",
      dataType: "customers",
      recordsImported: 88,
      status: "Partial",
    },
  ]);

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseCSV = (text: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQ  = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      result.push(cur.trim());
      return result;
    };
    const hdrs = parseRow(lines[0]);
    const parsed = lines.slice(1).filter(Boolean).map((line) => {
      const vals = parseRow(line);
      const obj: ParsedRow = {};
      hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    return { headers: hdrs, rows: parsed };
  };

  const handleFile = (f: File) => {
    setParseError(null);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      setParseError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setParseError("File exceeds the 10MB size limit.");
      return;
    }
    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers: hdrs, rows: parsed } = parseCSV(text);
        if (!hdrs.length) { setParseError("Could not parse CSV. Ensure it has a header row."); return; }
        setHeaders(hdrs);
        setRows(parsed);
        setFile(f);
        setMapping({});
      };
      reader.readAsText(f);
    } else {
      // For Excel files: accept them visually but simulate with placeholder data
      setHeaders(["Customer Name", "Arrival Date", "Weight", "Wash Type", "Fee", "Status", "Phone"]);
      setRows([
        { "Customer Name": "Juan Dela Cruz", "Arrival Date": "2025-03-01", Weight: "5.2", "Wash Type": "Wash & Dry", Fee: "150", Status: "Claimed", Phone: "09171234567" },
        { "Customer Name": "Maria Santos",   "Arrival Date": "2025-03-02", Weight: "3.8", "Wash Type": "Wash Only",  Fee: "95",  Status: "Claimed", Phone: "09281234567" },
        { "Customer Name": "Pedro Reyes",    "Arrival Date": "2025-03-03", Weight: "7.0", "Wash Type": "Dry Only",   Fee: "120", Status: "Ready",   Phone: "" },
      ]);
      setFile(f);
      setMapping({});
    }
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  // ── Auto-match ──────────────────────────────────────────────────────────────

  const autoMatch = () => {
    const newMap: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(({ key }) => {
      const hints = AUTO_MATCH_HINTS[key] ?? [];
      const matched = headers.find((h) =>
        hints.some((hint) => h.toLowerCase().includes(hint))
      );
      if (matched) newMap[key] = matched;
    });
    setMapping(newMap);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const found: ValidationIssue[] = [];
    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-based, +1 for header

      const dateVal = row[mapping["arrivalDate"] ?? ""];
      if (dateVal && isNaN(Date.parse(dateVal))) {
        found.push({ row: rowNum, column: "Arrival Date & Time", severity: "error",   message: "Date format not recognized" });
      }

      const wt = parseFloat(row[mapping["weight"] ?? ""] ?? "");
      if (mapping["weight"] && (isNaN(wt) || wt <= 0)) {
        found.push({ row: rowNum, column: "Weight (kg)", severity: mapping["weight"] ? "error" : "warning", message: "Weight value is missing or invalid" });
      }

      const fee = parseFloat(row[mapping["fee"] ?? ""] ?? "");
      if (mapping["fee"] && isNaN(fee)) {
        found.push({ row: rowNum, column: "Fee", severity: "error", message: "Fee is not a valid number" });
      }

      const name = row[mapping["customerName"] ?? ""];
      if (mapping["customerName"] && !name?.trim()) {
        found.push({ row: rowNum, column: "Customer Name", severity: "warning", message: "Customer name is empty" });
      }
    });
    setIssues(found);
  };

  // ── Template download ────────────────────────────────────────────────────────

  const downloadCSVTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "laundrytrack_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const content = `${EXCEL_TEMPLATE_HEADERS}\n${EXCEL_TEMPLATE_EXAMPLE}`;
    const blob    = new Blob([content], { type: "application/vnd.ms-excel" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = "laundrytrack_import_template.xls";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import simulation ────────────────────────────────────────────────────────

  const runImport = () => {
    const errRows   = issues.filter((i) => i.severity === "error").map((i) => i.row);
    const uniqueErr = new Set(errRows).size;
    const valid     = rows.length - (skipErrors ? uniqueErr : 0);
    const dupsSkip  = duplicateAction === "skip" ? duplicateCount : 0;
    const toImport  = Math.max(0, valid - dupsSkip);

    setImporting(true);
    setImportProgress(0);
    const start = Date.now();

    const tick = (progress: number) => {
      setImportProgress(progress);
      if (progress < 100) {
        setTimeout(() => tick(Math.min(100, progress + Math.random() * 18 + 8)), 120);
      } else {
        const elapsed = Math.round((Date.now() - start) / 1000);
        setImportResult({ total: toImport, skipped: skipErrors ? uniqueErr : 0, dupsSkipped: dupsSkip, seconds: elapsed });
        setImporting(false);
        setImportDone(true);
        setStep(5);

        // Add to history
        setHistory((prev) => [
          {
            id: `h${Date.now()}`,
            timestamp: new Date(),
            fileName: file?.name ?? "unknown",
            dataType: dataType ?? "transactions",
            recordsImported: toImport,
            status: uniqueErr > 0 ? "Partial" : "Success",
          },
          ...prev,
        ]);
      }
    };
    tick(0);
  };

  // ── Navigation ───────────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 3) validate();
    setStep((s) => Math.min(5, s + 1) as StepId);
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1) as StepId);

  const resetWizard = () => {
    setStep(1);
    setDataType(null);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setIssues([]);
    setSkipErrors(true);
    setDuplicateAction(null);
    setImporting(false);
    setImportProgress(0);
    setImportDone(false);
    setParseError(null);
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const requiredMapped = REQUIRED_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);
  const errorRows      = new Set(issues.filter((i) => i.severity === "error").map((i) => i.row));
  const warningRows    = new Set(issues.filter((i) => i.severity === "warning").map((i) => i.row));
  const validCount     = rows.length - (skipErrors ? errorRows.size : 0) - (duplicateAction === "skip" ? duplicateCount : 0);

  const dataTypeOptions: { value: DataType; label: string; icon: string }[] = [
    { value: "transactions", label: "Transactions / Service Records", icon: "📋" },
    { value: "customers",    label: "Customer List",                  icon: "👤" },
    { value: "revenue",      label: "Revenue Records",               icon: "💰" },
    { value: "all",          label: "All of the above (separate files)", icon: "📦" },
  ];

  const fileIcon = file?.name.endsWith(".csv")
    ? <FileText className="w-5 h-5 text-green-600" />
    : <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;

  const formatBytes = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Import Historical Data</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Upload your existing records from Excel or CSV files to include historical data in your analytics and reports.
        </p>
      </div>

      {/* Wizard card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <StepIndicator current={step} />

        {/* ── Step 1: Data Type ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">What data are you importing?</h2>
              <p className="text-sm text-muted-foreground">Select the type of records you want to bring in.</p>
            </div>
            <div className="grid gap-3">
              {dataTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDataType(opt.value)}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border-2 px-4 py-3.5 text-left transition-all",
                    dataType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    dataType === opt.value ? "border-primary" : "border-muted-foreground/40"
                  )}>
                    {dataType === opt.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={goNext} disabled={!dataType} className="gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Upload File ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">Upload your file</h2>
              <p className="text-sm text-muted-foreground">Drag and drop or browse for your data file.</p>
            </div>

            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
                )}
              >
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drag and drop your file here</p>
                  <p className="text-xs text-muted-foreground mt-1">Supported formats: .xlsx .csv .xls</p>
                </div>
                <Button variant="outline" size="sm" className="mt-1 pointer-events-none">
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            ) : (
              <div className="border border-border rounded-lg p-4 flex items-center gap-3 bg-muted/20">
                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  {fileIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(file.size)} &middot; {file.name.split(".").pop()?.toUpperCase()} file &middot; {rows.length} rows detected
                  </p>
                </div>
                <button
                  onClick={() => { setFile(null); setHeaders([]); setRows([]); setParseError(null); }}
                  className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {parseError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{parseError}</p>
            )}

            {/* Template downloads */}
            <div className="border border-border rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Download templates to get the correct column format:</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={downloadExcelTemplate}>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Download Excel Template
                  <Download className="w-3 h-3 text-muted-foreground" />
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={downloadCSVTemplate}>
                  <FileText className="w-3.5 h-3.5 text-green-600" />
                  Download CSV Template
                  <Download className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goNext} disabled={!file} className="gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Map Columns ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Match your columns</h2>
                <p className="text-sm text-muted-foreground">
                  Match the columns from your file to the correct fields in the system.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0 text-xs" onClick={autoMatch}>
                <Wand2 className="w-3.5 h-3.5" />
                Auto Match
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-1/2">System Field</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-1/2">Your Column</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUIRED_FIELDS.map((field, idx) => (
                    <tr key={field.key} className={cn("border-b border-border last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{field.label}</span>
                        {field.required
                          ? <span className="ml-1.5 text-destructive font-bold text-xs">*</span>
                          : <span className="ml-1.5 text-[11px] text-muted-foreground">(optional)</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={mapping[field.key] ?? "__none__"}
                          onValueChange={(v) =>
                            setMapping((m) => ({ ...m, [field.key]: v === "__none__" ? "" : v }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select column…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">— not mapped —</span>
                            </SelectItem>
                            {headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="text-destructive font-bold">*</span> Required fields must be mapped before proceeding.
            </p>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goNext} disabled={!requiredMapped} className="gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Preview & Validate ─────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">Preview Import Data</h2>
              <p className="text-sm text-muted-foreground">Review the first rows and fix any issues before importing.</p>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-10">#</th>
                    {REQUIRED_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <th key={f.key} className="px-3 py-2 text-left text-muted-foreground font-semibold whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, idx) => {
                    const rowNum = idx + 2;
                    const hasErr  = errorRows.has(rowNum);
                    const hasWarn = warningRows.has(rowNum);
                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-border last:border-0",
                          hasErr  ? "bg-red-50"    :
                          hasWarn ? "bg-yellow-50" :
                          idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                        )}
                      >
                        <td className="px-3 py-2 text-muted-foreground font-mono">{rowNum}</td>
                        {REQUIRED_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate">
                            {row[mapping[f.key]] || <span className="text-muted-foreground italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 5 && (
                <div className="px-3 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground text-center">
                  Showing 5 of {rows.length} rows
                </div>
              )}
            </div>

            {/* Validation summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-700">Valid rows</p>
                  <p className="text-lg font-bold text-green-800">{rows.length - errorRows.size}</p>
                </div>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-yellow-700">Warnings</p>
                  <p className="text-lg font-bold text-yellow-800">{warningRows.size}</p>
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2.5">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Errors</p>
                  <p className="text-lg font-bold text-red-800">{errorRows.size}</p>
                </div>
              </div>
            </div>

            {/* Issues list */}
            {issues.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">Issue Details</p>
                </div>
                <div className="divide-y divide-border max-h-40 overflow-y-auto">
                  {issues.map((issue, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                      {issue.severity === "error"
                        ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                      }
                      <span className="text-xs text-foreground">
                        <span className="font-medium">Row {issue.row}</span>
                        {" — "}{issue.column}: {issue.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3">
              {errorRows.size > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={skipErrors}
                    onCheckedChange={(v) => setSkipErrors(Boolean(v))}
                    id="skipErrors"
                  />
                  <Label htmlFor="skipErrors" className="text-sm cursor-pointer">
                    Skip rows with errors <span className="text-muted-foreground">({errorRows.size} rows will be skipped)</span>
                  </Label>
                </label>
              )}

              {/* Duplicate detection */}
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                  <p className="text-sm font-medium text-yellow-800">
                    {duplicateCount} duplicate records detected — skip or overwrite?
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={duplicateAction === "skip" ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => setDuplicateAction("skip")}
                  >
                    Skip Duplicates
                  </Button>
                  <Button
                    size="sm"
                    variant={duplicateAction === "overwrite" ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => setDuplicateAction("overwrite")}
                  >
                    Overwrite Duplicates
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={runImport}
                disabled={importing || duplicateAction === null}
                className="gap-2"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  : <>Import {Math.max(0, validCount)} valid records <ArrowRight className="w-4 h-4" /></>
                }
              </Button>
            </div>

            {/* Progress bar during import */}
            {importing && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importing records…</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Complete ───────────────────────────────────────────── */}
        {step === 5 && importDone && (
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Import Complete!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your historical data has been successfully imported.</p>
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border border-border overflow-hidden text-left">
              <div className="bg-muted/40 px-5 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Import Summary</p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: "Total records imported", value: importResult.total,       color: "text-green-700 font-bold" },
                  { label: "Records skipped (errors)", value: importResult.skipped,   color: "text-muted-foreground" },
                  { label: "Duplicates skipped",       value: importResult.dupsSkipped, color: "text-muted-foreground" },
                  { label: "Time taken",               value: `${importResult.seconds}s`, color: "text-muted-foreground" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-foreground">{row.label}</span>
                    <span className={cn("text-sm", row.color)}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onViewTransactions} className="gap-2">
                View Imported Data <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={resetWizard} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Import Another File
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Import History ─────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Import History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Date & Time", "File Name", "Data Type", "Records", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => {
                  const withinUndo = Date.now() - entry.timestamp.getTime() < 24 * 60 * 60 * 1000;
                  return (
                    <tr key={entry.id} className={cn("border-b border-border last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(entry.timestamp, "MMM d, yyyy h:mm a")}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate" title={entry.fileName}>
                        {entry.fileName}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{entry.dataType}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{entry.recordsImported.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            "text-[10px] font-semibold border-0",
                            entry.status === "Success" && "bg-green-100 text-green-700",
                            entry.status === "Partial" && "bg-yellow-100 text-yellow-700",
                            entry.status === "Failed"  && "bg-red-100 text-red-700",
                          )}
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!withinUndo}
                          className="text-xs h-7 gap-1.5"
                          onClick={() => setHistory((prev) => prev.filter((e) => e.id !== entry.id))}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo Import
                        </Button>
                        {!withinUndo && (
                          <span className="ml-2 text-[11px] text-muted-foreground">Expired</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
