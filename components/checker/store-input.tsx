"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function extractUrlsFromCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const urls = new Set<string>();

  for (const line of lines) {
    const cells = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    for (const cell of cells) {
      // Skip email addresses
      if (cell.includes("@")) continue;
      // Match *.myshopify.com domains
      const match = cell.match(/([\w-]+\.myshopify\.com)/i);
      if (match) {
        urls.add(match[1].toLowerCase());
      }
    }
  }

  return [...urls];
}

interface StoreInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  fileInfo: { name: string; count: number } | null;
  onFileLoad: (urls: string[], fileName: string) => void;
  onFileClear: () => void;
}

export function StoreInput({
  value,
  onChange,
  onSubmit,
  loading,
  fileInfo,
  onFileLoad,
  onFileClear,
}: StoreInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const urls = extractUrlsFromCsv(text);
      onFileLoad(urls, file.name);
    };
    reader.readAsText(file);

    e.target.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }

  const hasInput = value.trim() || (fileInfo && fileInfo.count > 0);

  return (
    <div className="space-y-3">
      <Textarea
        placeholder={
          "Enter store URLs (one per line or comma-separated)\ne.g. fashionnova.com, gymshark.com"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        disabled={loading}
      />
      {fileInfo && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="flex-1">
            <span className="font-medium">{fileInfo.name}</span>
            {" — "}
            <span className="text-muted-foreground">
              {fileInfo.count.toLocaleString()} URLs found
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onFileClear}
            disabled={loading}
            className="h-auto px-2 py-1 text-xs"
          >
            Remove
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={loading || !hasInput}>
          {loading ? "Checking..." : "Check Stores"}
        </Button>
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
        >
          Upload CSV / Text File
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.text"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: Press Cmd+Enter (Ctrl+Enter) to submit. Upload a CSV — URLs will
        be auto-extracted from all columns.
      </p>
    </div>
  );
}
