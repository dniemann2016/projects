#!/usr/bin/env node
/** JSONL Chat → lesbares Markdown */
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) {
  console.error("Usage: node export-chat-to-md.mjs <input.jsonl> <output.md>");
  process.exit(1);
}

const lines = fs.readFileSync(src, "utf8").split("\n").filter(Boolean);
const parts = [`# Projects — Cursor Chat Export\n`, `> Quelle: \`${src}\`\n`, `> Exportiert: ${new Date().toISOString()}\n\n---\n\n`];

for (const line of lines) {
  let row;
  try { row = JSON.parse(line); } catch { continue; }
  const role = row.role === "user" ? "👤 Nutzer" : row.role === "assistant" ? "🤖 Assistent" : row.role;
  const chunks = row.message?.content || [];
  const texts = chunks.filter((c) => c.type === "text").map((c) => c.text);
  if (!texts.length) continue;
  parts.push(`## ${role}\n\n`);
  for (const t of texts) {
    parts.push(t.replace(/\r\n/g, "\n"), "\n\n");
  }
  parts.push("---\n\n");
}

fs.writeFileSync(out, parts.join(""));
console.log(`Wrote ${out} (${lines.length} Zeilen)`);
