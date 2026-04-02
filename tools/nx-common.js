const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const REPORT_DIR = path.join(ROOT_DIR, 'reports');
const DIST_ZIP_PATH = path.join(ROOT_DIR, 'dist.zip');
const ERROR_CODE_PATH = path.join(__dirname, '..', 'error-codes.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else {
        out.push(abs);
      }
    }
  }
  return out;
}

function getDistFiles() {
  return walkFiles(DIST_DIR).map((abs) => ({
    abs,
    rel: toPosixPath(path.relative(DIST_DIR, abs)),
  }));
}

function readDistFile(relPath) {
  const abs = path.join(DIST_DIR, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function parseIndexRefs(indexText) {
  const scriptRegex = /<script[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
  const linkRegex = /<link[^>]+href=['"]([^'"]+)['"][^>]*>/gi;
  const refs = [];
  for (const match of indexText.matchAll(scriptRegex)) refs.push(match[1] || '');
  for (const match of indexText.matchAll(linkRegex)) refs.push(match[1] || '');
  return refs;
}

function extractInlineScriptContents(indexText) {
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  for (const match of indexText.matchAll(scriptRegex)) {
    const attrs = String(match[1] || '');
    const content = String(match[2] || '').trim();
    if (!content) continue;
    if (/\bsrc\s*=/.test(attrs)) continue;
    scripts.push(content);
  }
  return scripts;
}

function normalizeRefPath(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed)) return null;
  const noHash = trimmed.split('#', 1)[0] || '';
  const noQuery = noHash.split('?', 1)[0] || '';
  const normalized = toPosixPath(path.posix.normalize(noQuery.replace(/^[./]+/, '')));
  return normalized || null;
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function makeIssue(errorCode, phase, severity, detail, suggestion, pathValue) {
  return {
    errorCode,
    phase,
    severity,
    detail,
    suggestion,
    path: pathValue || '',
  };
}

function loadErrorDictionary() {
  return readJsonSafe(ERROR_CODE_PATH, {});
}

module.exports = {
  ROOT_DIR,
  DIST_DIR,
  DIST_ZIP_PATH,
  REPORT_DIR,
  ensureDir,
  readJsonSafe,
  writeJson,
  toPosixPath,
  walkFiles,
  getDistFiles,
  readDistFile,
  parseIndexRefs,
  extractInlineScriptContents,
  normalizeRefPath,
  computeSha256,
  makeIssue,
  loadErrorDictionary,
};
