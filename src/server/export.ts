/**
 * Server-side export helper: sanitizes a `WorkflowRecord` into an `ExportPayload`, then
 * inlines that payload together with the pre-built export-viewer JS/CSS into a single
 * self-contained HTML file that renders an interactive, offline workflow snapshot.
 *
 * Machine-local data (repository root, observatory directory, absolute paths, the workflow
 * file's own path) is stripped. The workflow's repository-relative source paths are kept
 * (they are part of the agent-authored description) but source file *contents* are never
 * included — the payload only carries the already-validated `Workflow` JSON and the
 * `sourceChecks` status map.
 */
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "@core/source-check";
import type { WorkflowRecord } from "@core/types";

export interface ExportPayload {
  workflow: Workflow;
  sourceChecks: Record<string, SourceStatus>;
  workflowName: string;
  workflowId: string;
  /** ISO timestamp of when the export was generated. */
  exportedAt: string;
  /** Repository display name only — never the root path or observatory directory. */
  repositoryName: string;
}

/**
 * Strips machine-local data from a `WorkflowRecord` and its repository context, producing
 * the minimal payload the export viewer needs. `record.file` (the workflow JSON's own path,
 * which reveals the `.observatory` directory layout) is intentionally dropped — only the
 * workflow's internal source references (already validated as repository-relative) survive.
 */
export function sanitizeExportPayload(record: WorkflowRecord, repositoryName: string, exportedAt?: string): ExportPayload {
  return {
    workflow: record.workflow,
    sourceChecks: record.sourceChecks,
    workflowName: record.workflow.name,
    workflowId: record.id,
    exportedAt: exportedAt ?? new Date().toISOString(),
    repositoryName,
  };
}

/**
 * Sanitizes a workflow name into a safe, stable filename component: ASCII alphanumerics,
 * hyphens, and underscores only, lowercased, whitespace collapsed to single hyphens.
 */
export function sanitizeFilename(name: string): string {
  const slug = name
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return slug.length > 0 ? slug : "workflow";
}

/** Escapes a JSON string so it is safe to embed inside `<script type="application/json">`. */
function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Escapes a JS string so it is safe to inline inside a `<script>` tag. */
function escapeScriptContent(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface BuildExportHtmlOptions {
  payload: ExportPayload;
  viewerJs: string;
  viewerCss: string;
}

/**
 * Assembles the final self-contained HTML: inline `<style>` with the export viewer's CSS,
 * an `<script type="application/json">` payload, and an inline `<script>` with the IIFE
 * viewer bundle. No external `src`, `href`, `link`, or CDN references — the file works
 * offline from `file://`.
 */
export function buildExportHtml({ payload, viewerJs, viewerCss }: BuildExportHtmlOptions): string {
  const payloadJson = escapeJsonForScript(JSON.stringify(payload));
  const title = `${payload.workflowName} — Code Observatory Export`;

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${viewerCss}
</style>
<script>(function(){try{var r=localStorage.getItem("code-observatory.ui");if(r){var p=JSON.parse(r);var t=p&&p.state&&p.state.theme;if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}}catch(e){}})();</script>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="observatory-export-payload">${payloadJson}</script>
<script>
${escapeScriptContent(viewerJs)}
</script>
</body>
</html>`;
}

/** Builds the Content-Disposition header value for a download. */
export function buildContentDisposition(workflowName: string): string {
  const slug = sanitizeFilename(workflowName);
  const filename = `${slug}-code-observatory.html`;
  return `attachment; filename="${filename}"`;
}
