import { z } from "zod";

const sourceLinkModeSchema = z.enum(["editor", "github", "none"]);

const projectSettingsSchema = z
  .object({
    defaultWorkflowId: z.string().min(1).optional(),
    sourceLinkMode: sourceLinkModeSchema.optional(),
  })
  .strict();

const projectInfoSchema = z
  .object({
    id: z.string().min(1, { message: "project.id must not be empty." }),
    name: z.string().min(1, { message: "project.name must not be empty." }),
    description: z.string().optional(),
  })
  .strict();

export const codeHQProjectSchema = z
  .object({
    schemaVersion: z.literal("0.1", { message: 'CodeHQProject.schemaVersion must be "0.1".' }),
    project: projectInfoSchema,
    settings: projectSettingsSchema.optional(),
  })
  .strict();

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type ProjectInfo = z.infer<typeof projectInfoSchema>;
export type CodeHQProject = z.infer<typeof codeHQProjectSchema>;
