// src/bank/seedBank.ts
import type { BankEntry, Slot } from '../types';
import { extractSlots } from './extractSlots';

// Build a BankEntry from text + tags, deriving slots from the {tokens} in the text
// so the declared slots can never drift from the template. id must be unique & stable.
function entry(
  id: string,
  templateText: string,
  tags: BankEntry['tags'],
): BankEntry {
  const slots: Slot[] = extractSlots(templateText);
  return { id, templateText, slots, tags };
}

// area codes: cer | discussion | research | collaboration | professionalism
// type codes: success | growth | behavior | skill
export const SEED_BANK: BankEntry[] = [
  // ---- CERs & Argumentation ----
  entry(
    'seed-cer-success-1',
    "{name}, your CER on {cer_topic} was one of the strongest in class — your claim was sharp and you backed it with solid evidence from the documents. I was especially impressed when {personal_detail}.",
    { type: 'success', area: 'cer', objective: 'argumentation', tone: 'encouraging' },
  ),
  entry(
    'seed-cer-skill-1',
    "{name}, you've really grown at using reasoning to connect your evidence back to your claim. When I read your work on {cer_topic}, I could follow exactly why your evidence mattered.",
    { type: 'skill', area: 'cer', objective: 'reasoning', tone: 'warm' },
  ),
  entry(
    'seed-cer-growth-1',
    "{name}, a goal for next year: push your reasoning a step further. Your claims and evidence are strong — I'd love to see you explain {growth_detail} so the reader feels the full weight of your argument.",
    { type: 'growth', area: 'cer', objective: 'reasoning', tone: 'direct' },
  ),

  // ---- Discussion & Debate ----
  entry(
    'seed-discussion-success-1',
    "{name}, you brought real energy to our discussions this year. In our debate on {debate_topic}, you listened closely and then made a point that moved the whole conversation forward.",
    { type: 'success', area: 'discussion', objective: 'participation', tone: 'encouraging' },
  ),
  entry(
    'seed-discussion-growth-1',
    "{name}, one thing to keep building is speaking up earlier in our debates — when you do jump in, your points land, so I'd love to hear from you sooner. You can always reach me at {teacher_email} if you'd like to talk it through.",
    { type: 'growth', area: 'discussion', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'seed-discussion-behavior-1',
    "{name}, I noticed how respectfully you disagreed during our Socratic seminars — you challenged ideas without ever putting anyone down. That's exactly the kind of citizen our classroom needs.",
    { type: 'behavior', area: 'discussion', objective: 'respectful-disagreement', tone: 'warm' },
  ),

  // ---- Research & Sources ----
  entry(
    'seed-research-skill-1',
    "{name}, you've become a careful researcher. On {research_topic} you didn't just grab the first source — you checked whether it was reliable and weighed primary against secondary sources.",
    { type: 'skill', area: 'research', objective: 'source-analysis', tone: 'encouraging' },
  ),
  entry(
    'seed-research-success-1',
    "{name}, your research this year stood out. I saw you {personal_detail}, and it showed me you're ready for the kind of source work high school will ask of you.",
    { type: 'success', area: 'research', objective: 'source-analysis', tone: 'warm' },
  ),
  entry(
    'seed-research-growth-1',
    "{name}, to grow next year: slow down and cross-check your sources before you build on them. You have great instincts — {growth_detail} will make your research airtight.",
    { type: 'growth', area: 'research', objective: 'source-analysis', tone: 'direct' },
  ),

  // ---- Collaboration & Projects ----
  entry(
    'seed-collaboration-behavior-1',
    "{name}, you were a teammate others could count on. During {project_name} you did your share and helped your group stay on track — that reliability matters more than you know.",
    { type: 'behavior', area: 'collaboration', objective: 'reliability', tone: 'warm' },
  ),
  entry(
    'seed-collaboration-success-1',
    "{name}, watching you in our group work and station activities was a highlight. You {personal_detail}, and your group was better for having you in it.",
    { type: 'success', area: 'collaboration', objective: 'teamwork', tone: 'encouraging' },
  ),
  entry(
    'seed-collaboration-growth-1',
    "{name}, a next step in group work: trust your own voice a little more. You have good ideas — sharing them sooner with your team, like when {growth_detail}, will make you a leader, not just a contributor.",
    { type: 'growth', area: 'collaboration', objective: 'leadership', tone: 'warm' },
  ),

  // ---- Professionalism ----
  entry(
    'seed-professionalism-behavior-1',
    "{name}, thank you for coming in on time and ready to learn, day after day. It's a quiet habit that made our classroom run, and it will carry you a long way.",
    { type: 'behavior', area: 'professionalism', objective: 'readiness', tone: 'warm' },
  ),
  entry(
    'seed-professionalism-success-1',
    "{name}, I want to recognize how you handled missing work this year — when you were out, you checked in and made it up without me having to chase you. That's real responsibility.",
    { type: 'success', area: 'professionalism', objective: 'responsibility', tone: 'encouraging' },
  ),
  entry(
    'seed-professionalism-growth-1',
    "{name}, one habit to build next year: communicate with your teacher early when you're stuck or behind. I'm always glad to help — reach me at {teacher_email} — and the students who ask are the ones who grow fastest.",
    { type: 'growth', area: 'professionalism', objective: 'self-advocacy', tone: 'direct' },
  ),
  entry(
    'seed-professionalism-skill-1',
    "{name}, you came prepared — materials out, assignment ready, focused from the bell. That self-management is a skill, and you've clearly worked at it.",
    { type: 'skill', area: 'professionalism', objective: 'self-management', tone: 'warm' },
  ),
];

// Stable identity for idempotent install: the entry's own id.
export function seedKeyOf(e: BankEntry): string {
  return e.id;
}

// Idempotent installer. `existingIds` are the ids already in the teacher's bank;
// `write` persists one entry. Returns how many new entries were installed.
export async function installSeedBank(
  existingIds: Set<string>,
  write: (e: BankEntry) => Promise<void>,
): Promise<number> {
  let installed = 0;
  for (const e of SEED_BANK) {
    if (existingIds.has(seedKeyOf(e))) continue;
    await write(e);
    installed += 1;
  }
  return installed;
}
