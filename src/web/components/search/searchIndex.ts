/**
 * Pure, framework-free ranking over an `CodeHQSnapshot` (no React, no DOM — unit-tested
 * directly in `tests/unit/web/search-index.test.ts`). Scores are tiered rather than blended so
 * the two ranking rules from the brief hold unconditionally: exact beats prefix beats substring,
 * and a match on a "name-like" field always outranks a match on a "body" field, regardless of
 * match tier.
 */
import type { CodeHQSnapshot } from "../../api/types";

export type SearchResultKind = "workflow" | "step" | "source" | "edge-case" | "test";

export interface SearchResult {
  kind: SearchResultKind;
  /** Stable, unique across a single search's results. */
  id: string;
  workflowId: string;
  /** Present for every kind except `workflow` — the step to focus/open the drawer for. */
  stepId?: string;
  title: string;
  subtitle?: string;
  score: number;
}

export interface SearchResultGroup {
  kind: SearchResultKind;
  label: string;
  items: SearchResult[];
}

type MatchTier = "exact" | "prefix" | "substring" | "none";

function matchTier(candidate: string, query: string): MatchTier {
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  if (q.length === 0 || c.length === 0) {
    return "none";
  }
  if (c === q) {
    return "exact";
  }
  if (c.startsWith(q)) {
    return "prefix";
  }
  if (c.includes(q)) {
    return "substring";
  }
  return "none";
}

const NAME_TIER_SCORES: Record<MatchTier, number> = { exact: 1000, prefix: 800, substring: 600, none: 0 };
const BODY_TIER_SCORES: Record<MatchTier, number> = { exact: 500, prefix: 400, substring: 300, none: 0 };

/** Score for a match against a "name-like" field (workflow/step name, file path, symbol). */
function nameScore(candidate: string, query: string): number {
  return NAME_TIER_SCORES[matchTier(candidate, query)];
}

/** Score for a match against a "body" field (purpose, description, handling). */
function bodyScore(candidate: string, query: string): number {
  return BODY_TIER_SCORES[matchTier(candidate, query)];
}

function best(...scores: number[]): number {
  return Math.max(0, ...scores);
}

export const KIND_LABELS: Record<SearchResultKind, string> = {
  workflow: "Workflows",
  step: "Steps",
  source: "Source",
  "edge-case": "Edge cases",
  test: "Tests",
};

const GROUP_ORDER: SearchResultKind[] = ["workflow", "step", "source", "edge-case", "test"];

/** The empty-query default: every workflow, in snapshot order, unscored. */
export function defaultResults(snapshot: CodeHQSnapshot): SearchResult[] {
  return snapshot.workflows.map((record) => ({
    kind: "workflow",
    id: `workflow:${record.workflow.id}`,
    workflowId: record.workflow.id,
    title: record.workflow.name,
    subtitle: record.workflow.purpose,
    score: 0,
  }));
}

/**
 * Ranked search across workflow names/purposes, step names/purposes, source file paths and
 * symbols, edge case names/descriptions/handling, and test files/symbols/descriptions.
 */
export function search(snapshot: CodeHQSnapshot, query: string): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return defaultResults(snapshot);
  }

  const results: SearchResult[] = [];

  for (const record of snapshot.workflows) {
    const workflow = record.workflow;

    const workflowScore = best(nameScore(workflow.name, trimmed), bodyScore(workflow.purpose, trimmed));
    if (workflowScore > 0) {
      results.push({
        kind: "workflow",
        id: `workflow:${workflow.id}`,
        workflowId: workflow.id,
        title: workflow.name,
        subtitle: workflow.purpose,
        score: workflowScore,
      });
    }

    for (const step of workflow.steps) {
      const stepScore = best(nameScore(step.name, trimmed), bodyScore(step.purpose, trimmed));
      if (stepScore > 0) {
        results.push({
          kind: "step",
          id: `step:${workflow.id}:${step.id}`,
          workflowId: workflow.id,
          stepId: step.id,
          title: step.name,
          subtitle: workflow.name,
          score: stepScore,
        });
      }

      (step.sources ?? []).forEach((source, index) => {
        const sourceScore = best(
          nameScore(source.file, trimmed),
          source.symbol !== undefined ? nameScore(source.symbol, trimmed) : 0,
          source.description !== undefined ? bodyScore(source.description, trimmed) : 0,
        );
        if (sourceScore > 0) {
          results.push({
            kind: "source",
            id: `source:${workflow.id}:${step.id}:${index}`,
            workflowId: workflow.id,
            stepId: step.id,
            title: source.symbol !== undefined ? `${source.file} · ${source.symbol}` : source.file,
            subtitle: `${step.name} · ${workflow.name}`,
            score: sourceScore,
          });
        }
      });

      (step.edgeCases ?? []).forEach((edgeCase, index) => {
        const edgeScore = best(
          nameScore(edgeCase.name, trimmed),
          edgeCase.description !== undefined ? bodyScore(edgeCase.description, trimmed) : 0,
          edgeCase.handling !== undefined ? bodyScore(edgeCase.handling, trimmed) : 0,
        );
        if (edgeScore > 0) {
          results.push({
            kind: "edge-case",
            id: `edge-case:${workflow.id}:${step.id}:${index}`,
            workflowId: workflow.id,
            stepId: step.id,
            title: edgeCase.name,
            subtitle: `${step.name} · ${workflow.name}`,
            score: edgeScore,
          });
        }
      });

      (step.tests ?? []).forEach((test, index) => {
        const testScore = best(
          nameScore(test.file, trimmed),
          test.symbol !== undefined ? nameScore(test.symbol, trimmed) : 0,
          test.description !== undefined ? bodyScore(test.description, trimmed) : 0,
        );
        if (testScore > 0) {
          results.push({
            kind: "test",
            id: `test:${workflow.id}:${step.id}:${index}`,
            workflowId: workflow.id,
            stepId: step.id,
            title: test.symbol !== undefined ? `${test.file} · ${test.symbol}` : test.file,
            subtitle: `${step.name} · ${workflow.name}`,
            score: testScore,
          });
        }
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** Buckets already-ranked results by kind, preserving relative order, in a fixed display order. */
export function groupResults(results: SearchResult[]): SearchResultGroup[] {
  const byKind = new Map<SearchResultKind, SearchResult[]>();
  for (const result of results) {
    const bucket = byKind.get(result.kind);
    if (bucket === undefined) {
      byKind.set(result.kind, [result]);
    } else {
      bucket.push(result);
    }
  }
  return GROUP_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    items: byKind.get(kind) ?? [],
  }));
}
