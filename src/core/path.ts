/**
 * Helpers de caminho (posix, forward slashes). Sem tocar no filesystem.
 */

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

export function stripExtension(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? path : path.slice(0, idx);
}

/**
 * Resolve `spec` (ex.: `../auth/AuthService`) a partir de `fromFile`
 * (ex.: `src/gateway/Gateway.ts`) para um caminho relativo normalizado
 * (ex.: `src/auth/AuthService`).
 */
export function resolveRelative(fromFile: string, spec: string): string {
  const segments = (dirname(fromFile) ? dirname(fromFile).split("/") : []).slice();
  for (const part of spec.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}
