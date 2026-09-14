const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'data', 'results');

function ensureDir() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function save(processInstanceId, record) {
  ensureDir();
  fs.writeFileSync(
    path.join(RESULTS_DIR, `${processInstanceId}.json`),
    JSON.stringify(record, null, 2)
  );
}

function list() {
  ensureDir();
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
}

function get(processInstanceId) {
  ensureDir();
  const file = path.join(RESULTS_DIR, `${processInstanceId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

module.exports = { save, list, get };
