import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, run } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const sourceFiles = [
  'iecs_professors.json',
  'ee_professors.json',
  'ece_professors.json',
  '電子工程.json',
  'gemini-code-1781418556573.json',
];

await fs.mkdir(path.join(projectRoot, 'server', 'data'), { recursive: true });
await initializeDatabase();

let inserted = 0;
let skipped = 0;

for (const sourceFile of sourceFiles) {
  const filePath = path.join(projectRoot, sourceFile);
  const content = await fs.readFile(filePath, 'utf8');
  const professors = JSON.parse(content);

  for (const professor of professors) {
    const result = await run(`
      INSERT OR IGNORE INTO professors (
        original_id,
        name,
        department,
        description,
        tags,
        source_file
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      professor.id ?? null,
      normalizeText(professor.name) || '未命名教授',
      normalizeText(professor.department),
      normalizeText(professor.description),
      normalizeText(professor.tags),
      sourceFile,
    ]);

    if (result.changes > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }
}

console.log(`Import completed. Inserted: ${inserted}, skipped duplicates: ${skipped}`);

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}
