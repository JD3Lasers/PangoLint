import { randomBytes } from "node:crypto";

const REQUEST_ID_BYTES = 16;

export function createReadbackRequestId(prefix = "pangolint"): string {
  return `${prefix}-${randomBytes(REQUEST_ID_BYTES).toString("hex")}`;
}
