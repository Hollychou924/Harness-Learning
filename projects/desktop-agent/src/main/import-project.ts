import { normalize, resolve } from 'node:path'

export function normalizedProjectPath(path: string): string {
  return normalize(resolve(path).normalize('NFC')).replace(/\/+$/, '') || '/'
}
