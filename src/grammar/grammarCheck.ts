// src/grammar/grammarCheck.ts

export type GrammarIssueKind =
  | 'double-word'
  | 'homophone'
  | 'passive-voice'
  | 'run-on';

export interface GrammarIssue {
  kind: GrammarIssueKind;
  message: string;
  excerpt: string;
}

const WORD_RE = /\b[\w']+\b/g;

function findDoubleWords(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    if (prev.toLowerCase() === cur.toLowerCase() && /^[a-z']+$/i.test(cur)) {
      issues.push({
        kind: 'double-word',
        message: `Repeated word: "${cur.toLowerCase()}"`,
        excerpt: `${prev} ${cur}`,
      });
    }
  }
  return issues;
}

// Heuristic: flag a homophone word only when it appears to be used
// in a context that usually wants a different spelling.
const HOMOPHONE_RULES: Array<{ word: string; nextIs: RegExp; note: string }> = [
  // "their going" -> probably "they're going"
  { word: 'their', nextIs: /^(going|here|not|coming|the|a)$/i, note: 'their/there/they\'re' },
  // "there going" -> probably "they're going"
  { word: 'there', nextIs: /^(going|coming|not)$/i, note: 'their/there/they\'re' },
  // "your" before a verb-ish word -> probably "you're"
  { word: 'your', nextIs: /^(going|doing|the|a|not)$/i, note: 'your/you\'re' },
];

function findHomophones(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 0; i < words.length - 1; i++) {
    const cur = words[i].toLowerCase();
    const next = words[i + 1];
    for (const rule of HOMOPHONE_RULES) {
      if (cur === rule.word && rule.nextIs.test(next)) {
        issues.push({
          kind: 'homophone',
          message: `Possible ${rule.note} confusion near "${words[i]} ${next}"`,
          excerpt: `${words[i]} ${next}`,
        });
      }
    }
  }
  return issues;
}


// Append to src/grammar/grammarCheck.ts

// Passive voice: a "to be" verb followed (within 2 words) by a past participle.
const BE_VERBS = ['is', 'are', 'was', 'were', 'be', 'been', 'being'];
// Crude past-participle test: ends in "ed" or a small irregular set.
const IRREGULAR_PARTICIPLES = new Set([
  'completed', 'given', 'taken', 'written', 'done', 'made', 'seen', 'shown',
]);

function isParticiple(word: string): boolean {
  const w = word.toLowerCase();
  return w.endsWith('ed') || IRREGULAR_PARTICIPLES.has(w);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function findPassiveVoice(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  for (const sentence of splitSentences(text)) {
    const words = sentence.match(WORD_RE) ?? [];
    for (let i = 0; i < words.length - 1; i++) {
      if (BE_VERBS.includes(words[i].toLowerCase())) {
        // look at the next two words for a participle
        const window = words.slice(i + 1, i + 3);
        const hit = window.find(isParticiple);
        if (hit) {
          issues.push({
            kind: 'passive-voice',
            message: `Possible passive voice near "${words[i]} ${hit}"`,
            excerpt: `${words[i]} ${hit}`,
          });
          break; // one flag per sentence is enough
        }
      }
    }
  }
  return issues;
}

// Run-on: a single sentence over 40 words OR with 3+ coordinating "and/but/so"
// joins and no internal terminal punctuation.
function findRunOns(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  for (const sentence of splitSentences(text)) {
    const words = sentence.match(WORD_RE) ?? [];
    const conj = words.filter((w) => /^(and|but|so)$/i.test(w)).length;
    if (words.length > 40 || (words.length > 25 && conj >= 3)) {
      issues.push({
        kind: 'run-on',
        message: `Possible run-on sentence (${words.length} words)`,
        excerpt: sentence.slice(0, 60) + (sentence.length > 60 ? '…' : ''),
      });
    }
  }
  return issues;
}

// Replace the existing grammarCheck export body with:
export function grammarCheck(text: string): GrammarIssue[] {
  return [
    ...findDoubleWords(text),
    ...findHomophones(text),
    ...findPassiveVoice(text),
    ...findRunOns(text),
  ];
}

