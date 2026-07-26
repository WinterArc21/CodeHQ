import { z } from "zod";

export const severitySchema = z.enum(["error", "warning"]);

export const issueSchema = z
  .object({
    severity: severitySchema,
    file: z.string().min(1, { message: "Issue.file must not be empty." }),
    path: z.string().optional(),
    message: z.string().min(1, { message: "Issue.message must not be empty." }),
    hint: z.string().optional(),
  })
  .strict();

export const diagnosticsReportSchema = z
  .object({
    generatedAt: z.string().min(1, { message: "DiagnosticsReport.generatedAt must not be empty." }),
    valid: z.boolean(),
    issues: z.array(issueSchema),
  })
  .strict();

export type Severity = z.infer<typeof severitySchema>;
export type Issue = z.infer<typeof issueSchema>;
export type DiagnosticsReport = z.infer<typeof diagnosticsReportSchema>;
