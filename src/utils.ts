import * as fglob from 'fast-glob';

export function resolveFiles(fileGlobs: string[], cwd: string): string[] {
  const files = fglob.sync(fileGlobs, {
    cwd: cwd,
    absolute: false,
    unique: true,
  });
  let collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  files.sort(collator.compare);
  return files;
}
