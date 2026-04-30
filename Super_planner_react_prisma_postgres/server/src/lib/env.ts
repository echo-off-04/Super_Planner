import { z } from "zod";

const emptyToUndefined = (value: string | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  BOKU_KUMASALA_API_URL: z.preprocess(
    (value) => emptyToUndefined(String(value ?? "")),
    z.string().url().optional()
  ),
  BOKU_KUMASALA_API_KEY: z.preprocess(
    (value) => emptyToUndefined(String(value ?? "")),
    z.string().optional()
  ),
});

export const env = envSchema.parse(process.env);