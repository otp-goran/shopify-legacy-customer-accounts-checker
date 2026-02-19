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
  const [pending, setPending] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCheck = useCallback(async () => {
    const urls = input
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) return;

    setLoading(true);
    setResults([]);
    setPending(urls);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
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

        for (const line of lines) {
          if (!line.trim()) continue;
          const result: CheckResult = JSON.parse(line);
          setResults((prev) => [...prev, result]);
          setPending((prev) =>
            prev.filter((u) => {
              const normalized = u.trim().startsWith("http")
                ? u.trim()
                : `https://${u.trim()}`;
              return normalized.replace(/\/+$/, "") !== result.url;
            })
          );
        }
      }

      if (buffer.trim()) {
        const result: CheckResult = JSON.parse(buffer);
        setResults((prev) => [...prev, result]);
        setPending([]);
      }
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
      setPending([]);
    }
  }, [input]);

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
            />
          </CardContent>
        </Card>

        {(results.length > 0 || pending.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultsTable results={results} pending={pending} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
