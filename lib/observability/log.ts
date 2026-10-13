import "server-only";
import { operationalLog } from "./record";
export function logOperation(...args: Parameters<typeof operationalLog>) {
  const record = operationalLog(...args);
  console.info(JSON.stringify(record));
}
