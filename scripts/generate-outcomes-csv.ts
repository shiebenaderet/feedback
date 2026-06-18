/**
 * Generate a Canvas-importable Outcomes CSV from the WA Social Studies standards.
 *
 * Format: https://developerdocs.instructure.com/services/canvas/outcomes/file.outcomes_csv
 *   - Rows are either object_type="group" or object_type="outcome".
 *   - Groups nest via space-separated `parent_guids` (referencing earlier groups).
 *   - Rating tiers are the FINAL columns, alternating points,label in DECREASING order.
 *
 * Structure produced:
 *   Strand group (Civics, Economics, …)  →  Standard group (C1, SSS4, …)  →  Outcome (component)
 *
 * Scope: by default the Grade 8 / U.S. History course (grade '8' components + the
 * all-grades Skills strand). Pass `--all` to emit the full 6–8 band.
 *
 * Rating scale: the district's 4-point proficiency scale (mastery = 3 / Proficient).
 *
 * Run:  npx tsx scripts/generate-outcomes-csv.ts [--all] > outcomes.csv
 */
import { STANDARDS, type StandardGrade } from '../src/standards/standards';

interface Rating {
  points: number;
  label: string;
}

// District 4-level proficiency scale, highest → lowest (Canvas requires decreasing).
const RATINGS: Rating[] = [
  { points: 4, label: 'Exemplary — exceeds expectations at this time' },
  { points: 3, label: 'Proficient — meets expectations at this time' },
  { points: 2, label: 'Progressing — approaching expectations at this time' },
  { points: 1, label: 'Beginning — below expectations at this time' },
];
const MASTERY_POINTS = 3; // Proficient
const CALCULATION_METHOD = 'highest'; // intuitive for standards-based grading; change if desired

const STRAND_LABEL: Record<string, string> = {
  civics: 'Civics',
  economics: 'Economics',
  geography: 'Geography',
  history: 'History',
  skills: 'Social Studies Skills',
};

const includeAllGrades = process.argv.includes('--all');
const inScope = (grade: StandardGrade): boolean =>
  includeAllGrades || grade === '8' || grade === 'all';

function esc(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Fixed leading columns; rating columns trail after mastery_points.
const LEADING = [
  'vendor_guid',
  'object_type',
  'title',
  'description',
  'display_name',
  'calculation_method',
  'calculation_int',
  'workflow_state',
  'parent_guids',
  'mastery_points',
] as const;

type Row = {
  vendor_guid: string;
  object_type: 'group' | 'outcome';
  title: string;
  description?: string;
  display_name?: string;
  calculation_method?: string;
  calculation_int?: string;
  workflow_state?: string;
  parent_guids?: string;
  mastery_points?: string;
  ratings?: Rating[];
};

const rows: Row[] = [];
const strandGuid = (strand: string) => `WA-SS-${strand.toUpperCase()}`;

// Group strands in a stable, readable order.
const STRAND_ORDER = ['civics', 'economics', 'geography', 'history', 'skills'];
const strandsPresent = STRAND_ORDER.filter((st) =>
  STANDARDS.some((s) => s.strand === st && s.components.some((c) => inScope(c.grade))),
);

for (const strand of strandsPresent) {
  rows.push({
    vendor_guid: strandGuid(strand),
    object_type: 'group',
    title: STRAND_LABEL[strand] ?? strand,
    workflow_state: 'active',
  });

  for (const std of STANDARDS.filter((s) => s.strand === strand)) {
    const comps = std.components.filter((c) => inScope(c.grade));
    if (comps.length === 0) continue;

    // Standard-level group, e.g. "SSS4: Creates a product…"
    rows.push({
      vendor_guid: std.code,
      object_type: 'group',
      title: `${std.code}: ${std.title}`,
      workflow_state: 'active',
      parent_guids: strandGuid(strand),
    });

    for (const c of comps) {
      const desc = c.sub && c.sub.length ? `${c.text} ${c.sub.join('; ')}` : c.text;
      rows.push({
        vendor_guid: c.code,
        object_type: 'outcome',
        title: c.code,
        description: desc,
        display_name: c.code,
        calculation_method: CALCULATION_METHOD,
        workflow_state: 'active',
        parent_guids: std.code,
        mastery_points: String(MASTERY_POINTS),
        ratings: RATINGS,
      });
    }
  }
}

// Header: leading columns + a "ratings" column followed by blanks for the
// remaining alternating points/label cells.
const maxRatingCells = Math.max(0, ...rows.map((r) => (r.ratings?.length ?? 0) * 2));
const ratingHeader = ['ratings', ...Array(Math.max(0, maxRatingCells - 1)).fill('')];
const header = [...LEADING, ...ratingHeader];

const lines: string[] = [header.map(esc).join(',')];
for (const r of rows) {
  const cells: (string | number)[] = [
    r.vendor_guid,
    r.object_type,
    r.title,
    r.description ?? '',
    r.display_name ?? '',
    r.calculation_method ?? '',
    r.calculation_int ?? '',
    r.workflow_state ?? 'active',
    r.parent_guids ?? '',
    r.mastery_points ?? '',
  ];
  if (r.ratings) for (const rt of r.ratings) cells.push(rt.points, rt.label);
  // Pad to full width so every row has the same column count.
  while (cells.length < header.length) cells.push('');
  lines.push(cells.map(esc).join(','));
}

process.stdout.write(lines.join('\n') + '\n');
