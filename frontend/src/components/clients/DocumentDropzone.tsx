import { useRef, useState, type DragEvent } from "react";
import { FileText, Loader2, ScanSearch, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface DocumentDropzoneProps {
  fileName: string | null;
  extracting: boolean;
  hasRequirements: boolean;
  onFile: (fileName: string) => void;
  onExtractFile: () => void;
  onExtractText: (text: string) => void;
}

export function DocumentDropzone({
  fileName,
  extracting,
  hasRequirements,
  onFile,
  onExtractFile,
  onExtractText,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file.name);
  }

  const extractLabel = extracting ? (
    <>
      <Loader2 className="animate-spin" aria-hidden="true" />
      Extracting
    </>
  ) : (
    <>
      <ScanSearch aria-hidden="true" />
      {hasRequirements ? "Extract again" : "Extract requirements"}
    </>
  );

  return (
    <Tabs defaultValue="upload" className="space-y-4">
      <TabsList className="rounded-xl bg-slate-100 p-1">
        <TabsTrigger value="upload" className="rounded-lg text-xs font-semibold">
          Upload PDF
        </TabsTrigger>
        <TabsTrigger value="paste" className="rounded-lg text-xs font-semibold">
          Paste text
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-0 space-y-3">
        <div
          data-active={active}
          onDragOver={(e) => {
            e.preventDefault();
            setActive(true);
          }}
          onDragLeave={() => setActive(false)}
          onDrop={onDrop}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-50/20 sm:flex-row sm:text-left"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-indigo-200/60 bg-indigo-50 text-indigo-600 shadow-2xs">
            <UploadCloud className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Drop the client&rsquo;s AP / vendor guide PDF
            </p>
            <p className="mt-0.5 text-xs text-slate-500">PDF up to 20 MB.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            id="ap-doc-upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f.name);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-slate-800">
              {fileName ?? "No document yet"}
            </span>
          </div>
          <Button type="button" onClick={onExtractFile} disabled={!fileName || extracting}>
            {extractLabel}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="paste" className="mt-0 space-y-3">
        <label htmlFor="ap-doc-text" className="text-sm font-medium text-foreground">
          Paste the AP guide or email text
        </label>
        <Textarea
          id="ap-doc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="All invoices must reference a valid PO number. Invoices are paid Net 30..."
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => onExtractText(text)}
            disabled={!text.trim() || extracting}
          >
            {extractLabel}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
