"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { CheckResult, AccountType } from "@/lib/checker";

const badgeConfig: Record<
  AccountType,
  { label: string; className: string }
> = {
  new: {
    label: "New Accounts",
    className: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200",
  },
  legacy: {
    label: "Legacy Accounts",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200",
  },
  "password-protected": {
    label: "Password Protected",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-200",
  },
  "not-shopify": {
    label: "Not Shopify",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200",
  },
  unknown: {
    label: "Unknown",
    className: "bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200",
  },
};

interface ResultsTableProps {
  results: CheckResult[];
  pending: string[];
}

export function ResultsTable({ results, pending }: ResultsTableProps) {
  if (results.length === 0 && pending.length === 0) return null;

  const counts = results.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Store URL</TableHead>
            <TableHead className="w-[25%]">Account Type</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => {
            const config = badgeConfig[r.type];
            return (
              <TableRow key={r.url}>
                <TableCell className="font-mono text-sm">
                  {r.url.replace(/^https?:\/\//, "")}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={config.className}>
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.note || r.error || "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {pending.map((url) => (
            <TableRow key={`pending-${url}`}>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {url.replace(/^https?:\/\//, "")}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                  Checking...
                </span>
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {results.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(counts).map(([type, count]) => {
              const config = badgeConfig[type as AccountType];
              return (
                <span key={type} className="flex items-center gap-1.5">
                  <Badge variant="secondary" className={config.className}>
                    {config.label}
                  </Badge>
                  <span className="text-muted-foreground">{count}</span>
                </span>
              );
            })}
            <span className="text-muted-foreground ml-auto">
              {results.length} total checked
            </span>
          </div>
        </>
      )}
    </div>
  );
}
