import Ajv from "ajv";

import schemaJson from "@/schema.json";
import type { UserProfile } from "@/lib/schema";

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schemaJson);

export type ValidationResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

// Validates the completed profile against `schema.json` before persistence.
export function validateUserProfile(profile: UserProfile): ValidationResult {
  const ok = validate(profile);
  if (ok) {
    return { ok: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map((e) => {
    const at = e.instancePath || "(root)";
    return `${at} ${e.message ?? "is invalid"}`.trim();
  });

  return { ok: false, errors };
}

