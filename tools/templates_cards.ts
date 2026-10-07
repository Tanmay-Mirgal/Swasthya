/**
 * tools/templates_cards.ts   (run: npm run templates:cards)
 *
 * Writes one review card per exercise template to docs/template-cards/, for a physiotherapist to read and sign off.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAllMovementTemplates } from "../lib/movement/template/registry";
import { renderTemplateCard } from "../lib/movement/template/cards";

const dir = join(process.cwd(), "docs", "template-cards");
mkdirSync(dir, { recursive: true });
const templates = getAllMovementTemplates();
for (const t of templates) writeFileSync(join(dir, `${t.id}.md`), renderTemplateCard(t));
const index = [
  "# Exercise template cards",
  "",
  "Generated from the templates in `lib/movement/template/templates` by `npm run templates:cards`. Do not edit by hand.",
  "Every threshold is an engineering default until a physiotherapist signs the card off and the template is marked `physio-reviewed`.",
  "",
  ...templates.map((t) => `- [${t.name}](${t.id}.md): ${t.validity.source === "physio-reviewed" ? `reviewed by ${t.validity.reviewedBy}` : "awaiting review"}`),
  "",
].join("\n");
writeFileSync(join(dir, "README.md"), index);
console.log(`Wrote ${templates.length} cards to ${dir}`);
