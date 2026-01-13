import z from "zod";

export type ZodErrorTreeNode = {
  errors: string[];
  properties?: Record<string, ZodErrorTreeNode>;
  items?: (ZodErrorTreeNode | undefined | null)[];
};

// Base schema for a tree node (without recursion)
export const baseTreeNodeSchema = z.object({
  errors: z.array(z.string()),
});

// Full recursive schema for z.treeifyError output
export const zodErrorTreeSchema: z.ZodType<ZodErrorTreeNode> = baseTreeNodeSchema.extend({
  properties: z.lazy(() => z.record(z.string(), zodErrorTreeSchema)).optional(),
  items: z.lazy(() => z.array(zodErrorTreeSchema.nullable().optional())).optional(),
});