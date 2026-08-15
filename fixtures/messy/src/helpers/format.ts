import { upper } from "../utils";

export function title(s: string): string {
  return upper(s[0]) + s.slice(1);
}
