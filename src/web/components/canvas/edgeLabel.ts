/** The text a connection would actually render as a label (mirrors `WorkflowEdge.tsx`'s own
 * `showLabel` check: `label`, falling back to `condition`, and only when non-blank). */
export function connectionLabelText(connection: { label?: string | undefined; condition?: string | undefined }): string | undefined {
  const text = connection.label ?? connection.condition;
  return text !== undefined && text.trim().length > 0 ? text : undefined;
}
