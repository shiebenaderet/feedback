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

  // ============================================================
  // GENERIC, slot-free comments — fast to use across a whole roster.
  // Each area has STRENGTH (type: success) and GROWTH (type: growth) versions.
  // No {tokens}, so they drop straight in with nothing to fill.
  // ============================================================

  // ---- Class contributions ----
  entry(
    'gen-contribution-success-1',
    'You were a consistent, thoughtful contributor to our class this quarter. When you share your thinking, it raises the level of the whole room — keep it up.',
    { type: 'success', area: 'contribution', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'gen-contribution-success-2',
    'Thank you for the energy you bring to class. You volunteer your ideas, build on what others say, and help our discussions actually go somewhere.',
    { type: 'success', area: 'contribution', objective: 'participation', tone: 'encouraging' },
  ),
  entry(
    'gen-contribution-success-3',
    'Your voice matters in this class. You speak up when it counts and your comments are almost always worth the room stopping to think about.',
    { type: 'success', area: 'contribution', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'gen-contribution-growth-1',
    "A goal going forward: share your thinking out loud more often. You clearly have ideas worth hearing, and the class is better when you put them on the table — don't wait to be called on.",
    { type: 'growth', area: 'contribution', objective: 'participation', tone: 'direct' },
  ),
  entry(
    'gen-contribution-growth-2',
    "One next step is to contribute a little earlier in our discussions. When you do jump in your points land well, so I'd love to hear from you sooner rather than at the very end.",
    { type: 'growth', area: 'contribution', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'gen-contribution-growth-3',
    'To grow as a contributor, try aiming for one solid comment or question every class. You have the ideas — building the habit of sharing them will make you a leader in discussions.',
    { type: 'growth', area: 'contribution', objective: 'participation', tone: 'encouraging' },
  ),

  // ---- Attitude ----
  entry(
    'gen-attitude-success-1',
    'Your attitude this quarter was a real strength. You showed up ready to learn, stayed positive even on the hard days, and made this a better class to be part of.',
    { type: 'success', area: 'attitude', objective: 'mindset', tone: 'warm' },
  ),
  entry(
    'gen-attitude-success-2',
    'I appreciate the positive energy you bring. You take feedback well, you keep an open mind, and you treat new challenges as something to figure out rather than something to avoid.',
    { type: 'success', area: 'attitude', objective: 'mindset', tone: 'encouraging' },
  ),
  entry(
    'gen-attitude-success-3',
    "You have a great learning attitude — curious, willing to be wrong, and quick to bounce back. That mindset will take you a long way, in this class and beyond.",
    { type: 'success', area: 'attitude', objective: 'mindset', tone: 'warm' },
  ),
  entry(
    'gen-attitude-growth-1',
    "A goal for next quarter: bring your best attitude even when the work feels hard or boring. You're at your best when you stay open — try to hold onto that energy on the tough days too.",
    { type: 'growth', area: 'attitude', objective: 'mindset', tone: 'direct' },
  ),
  entry(
    'gen-attitude-growth-2',
    'One thing to work on is treating setbacks as part of learning rather than a reason to shut down. When something is frustrating, take a breath and stay in it — that resilience is a skill worth building.',
    { type: 'growth', area: 'attitude', objective: 'mindset', tone: 'warm' },
  ),
  entry(
    'gen-attitude-growth-3',
    "To grow, keep working on staying focused and engaged from the start of class. You do great work when you're locked in — the goal is to get there a little faster each day.",
    { type: 'growth', area: 'attitude', objective: 'focus', tone: 'encouraging' },
  ),

  // ---- Working with others ----
  entry(
    'gen-collaboration-success-1',
    'You work really well with others. You listen, you share the load, and your group can count on you to do your part — that reliability matters more than you know.',
    { type: 'success', area: 'collaboration', objective: 'teamwork', tone: 'warm' },
  ),
  entry(
    'gen-collaboration-success-2',
    'You make the people around you better. In group work you include everyone, keep your team on track, and handle disagreements with respect.',
    { type: 'success', area: 'collaboration', objective: 'teamwork', tone: 'encouraging' },
  ),
  entry(
    'gen-collaboration-success-3',
    'You are a teammate others want to work with. You bring ideas without taking over, and you give your group members room to contribute too.',
    { type: 'success', area: 'collaboration', objective: 'teamwork', tone: 'warm' },
  ),
  entry(
    'gen-collaboration-growth-1',
    'A next step in group work is to trust your own voice a little more. You have good ideas — sharing them sooner with your team will make you a leader, not just a contributor.',
    { type: 'growth', area: 'collaboration', objective: 'leadership', tone: 'warm' },
  ),
  entry(
    'gen-collaboration-growth-2',
    "One goal is to make sure everyone in your group gets a turn. You have strong ideas, and the best collaborators pull others in instead of carrying the whole thing themselves.",
    { type: 'growth', area: 'collaboration', objective: 'teamwork', tone: 'direct' },
  ),
  entry(
    'gen-collaboration-growth-3',
    'To grow as a teammate, work on staying patient when a group moves slower than you would. Helping others get there — not just getting there first — is what real leadership looks like.',
    { type: 'growth', area: 'collaboration', objective: 'leadership', tone: 'encouraging' },
  ),

  // ---- Asking great questions ----
  entry(
    'gen-questions-success-1',
    'You ask genuinely great questions. The kind that make the whole class think harder and often take our discussion somewhere better than I had planned.',
    { type: 'success', area: 'questions', objective: 'curiosity', tone: 'warm' },
  ),
  entry(
    'gen-questions-success-2',
    "Your curiosity is a real strength. You're not satisfied with the surface answer — you dig for the why, and that pushes everyone's thinking forward.",
    { type: 'success', area: 'questions', objective: 'curiosity', tone: 'encouraging' },
  ),
  entry(
    'gen-questions-success-3',
    "I love that you ask questions when something doesn't add up. That takes courage and it's exactly how strong thinkers learn — never lose that.",
    { type: 'success', area: 'questions', objective: 'curiosity', tone: 'warm' },
  ),
  entry(
    'gen-questions-growth-1',
    "A goal going forward: ask more of the questions you're already wondering about. When you're confused or curious, say so — your questions are usually ones other students have too.",
    { type: 'growth', area: 'questions', objective: 'curiosity', tone: 'direct' },
  ),
  entry(
    'gen-questions-growth-2',
    "One next step is to push past your first question to a deeper one. You ask good 'what' questions — challenge yourself to ask 'why' and 'what if' more often.",
    { type: 'growth', area: 'questions', objective: 'curiosity', tone: 'warm' },
  ),
  entry(
    'gen-questions-growth-3',
    "To grow, try asking a question when you're stuck instead of waiting it out. Asking for help early isn't a weakness — the students who ask are the ones who grow the fastest.",
    { type: 'growth', area: 'questions', objective: 'self-advocacy', tone: 'encouraging' },
  ),

  // ---- Pushing through challenges ----
  entry(
    'gen-perseverance-success-1',
    "You don't give up when the work gets hard, and that's one of the most important things I can say about a student. You push through, and your effort shows in your growth.",
    { type: 'success', area: 'perseverance', objective: 'effort', tone: 'warm' },
  ),
  entry(
    'gen-perseverance-success-2',
    'I watched you stick with tough problems this quarter instead of quitting. That persistence — trying again, asking for help, keeping at it — is exactly what learning takes.',
    { type: 'success', area: 'perseverance', objective: 'effort', tone: 'encouraging' },
  ),
  entry(
    'gen-perseverance-success-3',
    'Your grit really stands out. When something is challenging you slow down and work through it rather than shutting down, and that habit will serve you for the rest of your life.',
    { type: 'success', area: 'perseverance', objective: 'effort', tone: 'warm' },
  ),
  entry(
    'gen-perseverance-growth-1',
    "A goal for you is to keep going when the work gets frustrating instead of stepping back. You're capable of more than you think — the breakthrough usually comes right after the hard part.",
    { type: 'growth', area: 'perseverance', objective: 'effort', tone: 'direct' },
  ),
  entry(
    'gen-perseverance-growth-2',
    "One next step is to try a tough task a second way before deciding it's too hard. You have the ability — building the habit of pushing through is what will unlock it.",
    { type: 'growth', area: 'perseverance', objective: 'effort', tone: 'warm' },
  ),
  entry(
    'gen-perseverance-growth-3',
    'To grow, work on asking for help as a tool rather than giving up when you hit a wall. Persistence and reaching out go together — the strongest students do both.',
    { type: 'growth', area: 'perseverance', objective: 'self-advocacy', tone: 'encouraging' },
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
