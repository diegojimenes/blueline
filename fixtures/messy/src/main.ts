import title from "./helpers/format";
import { upper } from "./utils";

export default function run(): string {
  const x = upper("abc");
  const y = title("xyz");
  missingGlobal(x);
  return x + y;
}

export const appVersion = "1.0.0";
