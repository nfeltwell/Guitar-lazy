// Bundle src/ ES modules into one self-contained HTML page (no dependencies).
// Output: dist/lazy-guitar.html (artifact body, published) and dist/index.html (full document, for tests and local use).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const ENTRY = 'app.js';

const modules = new Map();
function load(rel) {
  if (modules.has(rel)) return;
  const code = readFileSync(join(SRC, rel), 'utf8');
  modules.set(rel, null);
  const deps = [];
  const exportsList = [];
  let body = code.replace(/^import\s+(\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?\s*$/gm, (_, all, ns, names, spec) => {
    const dep = normalize(join(dirname(rel), spec)).replace(/\\/g, '/');
    deps.push(dep);
    if (ns) return `const ${ns} = __req(${JSON.stringify(dep)});`;
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = __req(${JSON.stringify(dep)});`;
  });
  if (/^\s*import\s/m.test(body)) throw new Error(`Unsupported import form in ${rel}`);
  body = body.replace(/^export\s+(async\s+function|function|class|const|let)\s+(\w+)/gm, (_, kw, name) => {
    exportsList.push(name);
    return `${kw} ${name}`;
  });
  if (/^export\s/m.test(body)) throw new Error(`Unsupported export form in ${rel}`);
  modules.set(rel, { body, exportsList });
  deps.forEach(load);
}
load(ENTRY);

let bundle = '(() => {\n"use strict";\nconst __defs = {};\nconst __cache = {};\nfunction __req(id) {\n  if (!__cache[id]) { __cache[id] = {}; Object.assign(__cache[id], __defs[id]()); }\n  return __cache[id];\n}\n';
for (const [rel, m] of modules) {
  bundle += `__defs[${JSON.stringify(rel)}] = () => {\n${m.body}\nreturn { ${m.exportsList.join(', ')} };\n};\n`;
}
bundle += `__req(${JSON.stringify(ENTRY)}).boot(document.getElementById('app'));\n})();\n`;
// Guard against a closing script tag inside the code.
bundle = bundle.replace(/<\/script/gi, '<\\/script');

const template = readFileSync(join(SRC, 'index.html'), 'utf8');
const page = template.replace('<!--SCRIPT-->', `<script>\n${bundle}</script>`);
mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist', 'lazy-guitar.html'), page);
const full = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${page}\n</body></html>\n`;
writeFileSync(join(ROOT, 'dist', 'index.html'), full);
console.log(`Built ${modules.size} modules, ${(page.length / 1024).toFixed(0)} KB -> dist/lazy-guitar.html, dist/index.html`);
void relative;
