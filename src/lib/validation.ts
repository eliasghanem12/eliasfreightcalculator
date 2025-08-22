
import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Enter product name"),
  brand: z.string().optional(),
  sku: z.string().optional(),
  qty: z.number().int().positive(),
  l_mm: z.number().positive().optional(),
  w_mm: z.number().positive().optional(),
  h_mm: z.number().positive().optional(),
  weight_g: z.number().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source_url: z.string().url().optional()
});

export const parcelSchema = z.object({
  l_mm: z.number().positive(),
  w_mm: z.number().positive(),
  h_mm: z.number().positive(),
  weight_g: z.number().positive(),
});

export const quoteSchema = z.object({
  origin: z.object({ country: z.string().length(2), portId: z.string().optional() }),
  destination: z.object({ country: z.string().length(2), portId: z.string().optional() }),
  incoterm: z.enum(["EXW","FOB","CIF","CIP","DDP"]),
  mode: z.enum(["air","sea","road","courier"]),
  products: z.array(productSchema).optional(),
  parcels: z.array(parcelSchema).min(1),
  declaredValue: z.number().nonnegative(),
  currency: z.string().min(3),
  options: z.object({
    insurance:z.boolean().optional(), coo:z.boolean().optional(), coc:z.boolean().optional()
  }).optional()
});
export type QuoteFormValues = z.infer<typeof quoteSchema>;
