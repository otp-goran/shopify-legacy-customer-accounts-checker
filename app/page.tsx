"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StoreInput } from "@/components/checker/store-input";
import { ResultsTable } from "@/components/checker/results-table";
import type { CheckResult } from "@/lib/checker";

export default function Home() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    count: number;
  } | null>(null);

  const handleFileLoad = useCallback(
    (urls: string[], fileName: string) => {
      setFileUrls(urls);
      setFileInfo({ name: fileName, count: urls.length });
    },
    []
  );

  const handleFileClear = useCallback(() => {
    setFileUrls([]);
    setFileInfo(null);
  }, []);

  const handleCheck = useCallback(async () => {
    const textUrls = input
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    const allUrls = [...textUrls, ...fileUrls];
    if (allUrls.length === 0) return;

    setLoading(true);
    setResults([]);
    setTotalCount(allUrls.length);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: allUrls }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to check stores");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        const newResults: CheckResult[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          newResults.push(JSON.parse(line));
        }
        if (newResults.length > 0) {
          setResults((prev) => [...prev, ...newResults]);
        }
      }

      if (buffer.trim()) {
        const result: CheckResult = JSON.parse(buffer);
        setResults((prev) => [...prev, result]);
      }
    } catch {
      // Error handled by finally
    } finally {
      setLoading(false);
    }
  }, [input, fileUrls]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              Shopify Account Type Checker
            </CardTitle>
            <CardDescription>
              Check whether Shopify stores use legacy or new customer accounts.
              Enter store URLs below or upload a file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StoreInput
              value={input}
              onChange={setInput}
              onSubmit={handleCheck}
              loading={loading}
              fileInfo={fileInfo}
              onFileLoad={handleFileLoad}
              onFileClear={handleFileClear}
            />
          </CardContent>
        </Card>

        {(results.length > 0 || loading) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                Results
                {loading && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {results.length} / {totalCount.toLocaleString()} checked...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResultsTable results={results} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
