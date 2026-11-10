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
    <Tabs defaultValue="upload" className="space-y-3">
      <TabsList>
        <TabsTrigger value="upload">Upload PDF</TabsTrigger>
        <TabsTrigger value="paste">Paste text</TabsTrigger>
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
          className="dropzone flex flex-col items-center gap-3 rounded-xl bg-background px-6 py-7 text-center transition-colors sm:flex-row sm:text-left"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Drop the client&rsquo;s AP / vendor guide PDF
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">PDF up to 20 MB.</p>
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

        <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm text-foreground">
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
