"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StoreInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function StoreInput({
  value,
  onChange,
  onSubmit,
  loading,
}: StoreInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      onChange(value ? value + "\n" + text : text);
    };
    reader.readAsText(file);

    // Reset so same file can be re-uploaded
    e.target.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder={"Enter store URLs (one per line or comma-separated)\ne.g. fashionnova.com, gymshark.com"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        disabled={loading}
      />
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={loading || !value.trim()}>
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
        Tip: Press Cmd+Enter (Ctrl+Enter) to submit. Max 100 URLs per check.
      </p>
    </div>
  );
}
