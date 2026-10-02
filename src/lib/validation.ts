import { z } from "zod";

export const productSchema = z.object({
  name: z.string().default(""),
  sku: z.string().optional(),
  qty: z.number().int().positive().default(1),
  itemType: z.enum(["hardware", "software"]).default("hardware"),
  l_mm: z.number().positive().optional(),
  w_mm: z.number().positive().optional(),
  h_mm: z.number().positive().optional(),
  weight_g: z.number().nonnegative().optional(),
  dimSource: z.string().optional(),
});

export const quoteSchema = z.object({
  origin: z.object({ country: z.string().length(2), portId: z.string().optional() }),
  destination: z.object({ country: z.string().length(2), portId: z.string().optional() }),
  incoterm: z.enum(["EXW", "FOB", "CIF", "CIP", "DDP"]),
  mode: z.enum(["air", "sea", "road", "courier"]),
  products: z.array(productSchema).default([]),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;
export type ProductRow = z.infer<typeof productSchema>;
