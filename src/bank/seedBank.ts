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

  // ---- Next year / high school readiness (a strength now + a goal for high school) ----
  entry(
    'gen-readiness-success-1',
    "One of my favorite things about you is the smile and good attitude you bring through the door every single day — never underestimate how much that lifts a room. Carry it into high school and you'll make it a better place too.",
    { type: 'success', area: 'readiness', objective: 'presence', tone: 'warm' },
  ),
  entry(
    'gen-readiness-success-2',
    "You showed up on time, ready, and dependable all year — that consistency is a real strength. It's exactly the habit that will set you apart in high school, so hold onto it.",
    { type: 'success', area: 'readiness', objective: 'consistency', tone: 'encouraging' },
  ),
  entry(
    'gen-readiness-success-3',
    'You treat people with kindness and respect, and that matters more than any grade. As you head to high school, keep being someone others can count on to do the right thing.',
    { type: 'success', area: 'readiness', objective: 'character', tone: 'warm' },
  ),
  entry(
    'gen-readiness-growth-1',
    "A goal for high school: keep building the habit of advocating for yourself — asking for help, talking to teachers, and speaking up when you need something. You're ready for it, and it's the skill that unlocks everything else.",
    { type: 'growth', area: 'readiness', objective: 'self-advocacy', tone: 'direct' },
  ),
  entry(
    'gen-readiness-growth-2',
    "As you move on to high school, work on staying organized and managing your time as the workload grows. You have the ability — strong systems for tracking your work will let it shine.",
    { type: 'growth', area: 'readiness', objective: 'organization', tone: 'warm' },
  ),
  entry(
    'gen-readiness-growth-3',
    'My hope for you in high school is that you keep taking on challenges that stretch you instead of playing it safe. You grow the most when you reach a little past comfortable — go find those moments.',
    { type: 'growth', area: 'readiness', objective: 'challenge', tone: 'encouraging' },
  ),

  // ============================================================
  // More generic comments. Some end with an OPTIONAL "{detail}" add-on sentence —
  // fill it to personalize, or skip it and the comment still reads cleanly.
  // ============================================================

  // ---- Ideas & speaking up (voice) ----
  entry(
    'gen-ideas-success-1',
    'You have great ideas and a sharp mind for this subject. When you share your thinking, it pushes the whole class forward.{detail}',
    { type: 'success', area: 'ideas', objective: 'voice', tone: 'warm' },
  ),
  entry(
    'gen-ideas-success-2',
    'Some of the most interesting thinking in class this year came from you. You make connections other students miss.{detail}',
    { type: 'success', area: 'ideas', objective: 'voice', tone: 'encouraging' },
  ),
  entry(
    'gen-ideas-skill-1',
    "You've grown into a real thinker this year — your ideas are more original and better supported than they were in the fall. Keep developing that voice.",
    { type: 'skill', area: 'ideas', objective: 'voice', tone: 'warm' },
  ),
  entry(
    'gen-ideas-growth-1',
    "You have great ideas — now the goal is to speak up and share them more in class. Your thinking deserves to be heard, so don't keep it to yourself.{detail}",
    { type: 'growth', area: 'ideas', objective: 'voice', tone: 'direct' },
  ),
  entry(
    'gen-ideas-growth-2',
    "A goal for you is to trust your ideas enough to put them out there before you're 100% sure. Some of the best class discussions start with a half-formed thought said out loud.",
    { type: 'growth', area: 'ideas', objective: 'voice', tone: 'encouraging' },
  ),

  // ---- Quality of work ----
  entry(
    'gen-quality-success-1',
    'The care you put into your work really shows. You go beyond just finishing and aim for something you can be proud of.{detail}',
    { type: 'success', area: 'quality', objective: 'craftsmanship', tone: 'warm' },
  ),
  entry(
    'gen-quality-success-2',
    'Your work this year was consistently thoughtful and thorough. You pay attention to detail in a way that sets your work apart.',
    { type: 'success', area: 'quality', objective: 'craftsmanship', tone: 'encouraging' },
  ),
  entry(
    'gen-quality-skill-1',
    "You've gotten noticeably better at revising — taking feedback and actually using it to make your next draft stronger. That's a skill a lot of adults never master.",
    { type: 'skill', area: 'quality', objective: 'revision', tone: 'warm' },
  ),
  entry(
    'gen-quality-growth-1',
    'A goal going forward: give your work a second look before you turn it in. You have the ability to do excellent work — slowing down to check it is what will get you there.{detail}',
    { type: 'growth', area: 'quality', objective: 'craftsmanship', tone: 'direct' },
  ),
  entry(
    'gen-quality-growth-2',
    "One next step is to push your work from 'done' to 'your best.' You're capable of more than the minimum, and I'd love to see you aim higher even when no one's requiring it.",
    { type: 'growth', area: 'quality', objective: 'craftsmanship', tone: 'warm' },
  ),

  // ---- Focus & engagement (skill-heavy) ----
  entry(
    'gen-focus-success-1',
    "When you're locked in, your focus is a real strength — you tune out distractions and get deep into the work. That's a powerful skill to have.",
    { type: 'success', area: 'focus', objective: 'engagement', tone: 'warm' },
  ),
  entry(
    'gen-focus-skill-1',
    "You've gotten better at managing your own attention this year — catching yourself when you drift and getting back on task. That self-awareness will serve you everywhere.",
    { type: 'skill', area: 'focus', objective: 'self-regulation', tone: 'encouraging' },
  ),
  entry(
    'gen-focus-growth-1',
    'A goal for you is to bring your focus from the very start of class instead of easing in. You do strong work once you settle — getting there faster will make a big difference.{detail}',
    { type: 'growth', area: 'focus', objective: 'engagement', tone: 'direct' },
  ),
  entry(
    'gen-focus-growth-2',
    "One next step is to notice what pulls your attention away and build a plan for it — moving seats, putting the phone away, whatever helps. You've got the ability; protecting your focus is the goal.",
    { type: 'growth', area: 'focus', objective: 'self-regulation', tone: 'warm' },
  ),

  // ---- Attendance ----
  entry(
    'gen-attendance-success-1',
    'Class was better on the days you were in it — your presence and energy added something real. Thank you for showing up and being part of this community.{detail}',
    { type: 'success', area: 'attendance', objective: 'presence', tone: 'warm' },
  ),
  entry(
    'gen-attendance-success-2',
    'Your attendance and reliability this year stood out. Being here, ready to go, day after day is a quiet strength that makes everything else possible.',
    { type: 'success', area: 'attendance', objective: 'consistency', tone: 'encouraging' },
  ),
  entry(
    'gen-attendance-growth-1',
    "When you were here, you did great work — that's exactly why I'd love to see you in class more often next year. The hardest part is just getting through the door; the rest you can handle.{detail}",
    { type: 'growth', area: 'attendance', objective: 'presence', tone: 'warm' },
  ),
  entry(
    'gen-attendance-growth-2',
    'A real goal for next year is staying on top of work when you miss class. Absences happen, but checking in and making things up quickly will keep them from snowballing — and you are fully capable of it.{detail}',
    { type: 'growth', area: 'attendance', objective: 'recovery', tone: 'direct' },
  ),
  entry(
    'gen-attendance-growth-3',
    'One thing to focus on is getting to class on time. You miss important pieces in those first few minutes, and arriving ready from the start will help you more than you might think.',
    { type: 'growth', area: 'attendance', objective: 'punctuality', tone: 'direct' },
  ),
  entry(
    'gen-attendance-growth-4',
    "It was a tough year for attendance, and I want you to know the door is always open — your spot in this class is yours. Next year, let's make getting here the first win of every day.{detail}",
    { type: 'growth', area: 'attendance', objective: 'presence', tone: 'warm' },
  ),

  // ---- More attitude / kindness skill ----
  entry(
    'gen-kindness-success-1',
    'You treat the people around you with genuine kindness, and it does not go unnoticed. That decency matters more than any grade I could give.{detail}',
    { type: 'success', area: 'attitude', objective: 'kindness', tone: 'warm' },
  ),
  entry(
    'gen-kindness-success-2',
    'You have a knack for making other people feel included and respected. That is a rare gift, and our class was warmer because of it.',
    { type: 'success', area: 'attitude', objective: 'kindness', tone: 'encouraging' },
  ),

  // ============================================================
  // SOCIAL STUDIES / U.S. HISTORY personalized comments (8th grade).
  // Slot-based (seed-*), each starts with {name}. Every new area carries a
  // strength (success/skill) AND a paired actionable growth comment.
  // Mix of end-of-year and mid-year (present-tense) phrasings for Q1–Q4 use.
  // New slots used inline: {assignment}, {unit}, {strength}, {next_step}.
  // ============================================================

  // ---- Primary-source analysis ----
  entry(
    'seed-primary-source-skill-1',
    "{name}, you've gotten sharp at reading a primary source for what it really says — on our {unit} documents you noticed the author's point of view and asked who wrote it and why. That's exactly how a historian thinks.",
    { type: 'skill', area: 'primary-source', objective: 'source-analysis', tone: 'encouraging' },
  ),
  entry(
    'seed-primary-source-success-1',
    "{name}, your analysis of the {assignment} document was excellent — you pulled a direct quote, explained what it meant in its own time, and connected it to what we were studying. I was impressed when {personal_detail}.",
    { type: 'success', area: 'primary-source', objective: 'source-analysis', tone: 'warm' },
  ),
  entry(
    'seed-primary-source-growth-1',
    "{name}, this week I noticed you summarize what a document says but stop short of asking who made it and why. Next step: before you trust a source, jot one note on the author's purpose and audience — you'll know you've got it when your analysis names a possible bias.",
    { type: 'growth', area: 'primary-source', objective: 'source-analysis', tone: 'direct' },
  ),

  // ---- DBQ writing ----
  entry(
    'seed-dbq-success-1',
    "{name}, your DBQ on {cer_topic} grouped the documents into clear categories and used each one as evidence instead of just listing them. That's a real step up in historical writing.",
    { type: 'success', area: 'dbq', objective: 'argumentation', tone: 'encouraging' },
  ),
  entry(
    'seed-dbq-growth-1',
    "{name}, your DBQ used the documents well, but a few sat in your essay without explanation. Next step: after each quote, add one sentence starting 'This shows…' — you'll know it's working when every document does a job in your argument.",
    { type: 'growth', area: 'dbq', objective: 'argumentation', tone: 'direct' },
  ),
  entry(
    'seed-dbq-growth-2',
    "{name}, right now your DBQ leans on the documents but rarely brings in outside knowledge from class. A good next step is to add one piece of evidence we learned that isn't in the packet — that's what moves a DBQ from solid to strong.",
    { type: 'growth', area: 'dbq', objective: 'evidence', tone: 'warm' },
  ),

  // ---- Thesis & claims ----
  entry(
    'seed-thesis-skill-1',
    "{name}, you've learned to write a thesis that actually takes a position instead of restating the question. On {assignment}, your opening line told me your whole argument in one sentence.",
    { type: 'skill', area: 'thesis', objective: 'argumentation', tone: 'encouraging' },
  ),
  entry(
    'seed-thesis-growth-1',
    "{name}, your thesis statements tell me your topic but not yet your stance. Next step: make your thesis answer 'so what was the most important reason?' — you'll know you've nailed it when someone could disagree with the sentence you wrote.",
    { type: 'growth', area: 'thesis', objective: 'argumentation', tone: 'direct' },
  ),

  // ---- Geography & map skills ----
  entry(
    'seed-geography-success-1',
    "{name}, your map work on {unit} was careful and accurate — you labeled clearly, used the key, and could explain how geography shaped the events we studied. Map skills like yours make history make sense.",
    { type: 'success', area: 'geography', objective: 'map-skills', tone: 'warm' },
  ),
  entry(
    'seed-geography-growth-1',
    "{name}, you can read a map well, but I'd love to see you use it to explain why events happened where they did. Next step: when you label a region, add a note on how its rivers, mountains, or coastlines shaped the story — that's geographic thinking, not just locating.",
    { type: 'growth', area: 'geography', objective: 'map-skills', tone: 'encouraging' },
  ),

  // ---- Chronology & cause-effect ----
  entry(
    'seed-chronology-skill-1',
    "{name}, you've gotten good at putting events in order and seeing how one led to the next — on our {unit} timeline you spotted a cause-and-effect chain that even tripped up the class.",
    { type: 'skill', area: 'chronology', objective: 'cause-effect', tone: 'encouraging' },
  ),
  entry(
    'seed-chronology-growth-1',
    "{name}, you can list what happened, but the next step is showing how one event caused the next. Try connecting two events with 'which led to…' in your notes — you'll know it's clicking when your timeline reads like a story, not a list of dates.",
    { type: 'growth', area: 'chronology', objective: 'cause-effect', tone: 'direct' },
  ),

  // ---- Civics & citizenship ----
  entry(
    'seed-civics-success-1',
    "{name}, in our {debate_topic} simulation you explained how the branches of government check each other clearly enough that classmates turned to you for help. You really understand how our system is built.",
    { type: 'success', area: 'civics', objective: 'civic-knowledge', tone: 'encouraging' },
  ),
  entry(
    'seed-civics-skill-1',
    "{name}, you've grown into someone who connects what we learn about government to the real world — this week you tied {personal_detail} back to a right in the Constitution. That's civic thinking in action.",
    { type: 'skill', area: 'civics', objective: 'civic-knowledge', tone: 'warm' },
  ),
  entry(
    'seed-civics-growth-1',
    "{name}, you know the facts about how government works; the next step is using them to take a reasoned position. Try answering 'what should happen and why?' in your civics responses — you'll know you're there when you back an opinion with a constitutional principle.",
    { type: 'growth', area: 'civics', objective: 'civic-reasoning', tone: 'direct' },
  ),

  // ---- Current events / connecting past to present ----
  entry(
    'seed-current-events-success-1',
    "{name}, you have a real gift for connecting history to today — this week you linked {personal_detail} to what we'd studied, and it sparked one of our best discussions of the unit.",
    { type: 'success', area: 'current-events', objective: 'relevance', tone: 'warm' },
  ),
  entry(
    'seed-current-events-growth-1',
    "{name}, you follow the news closely, which is great — the next step is backing your take with evidence the way we do with history. Try citing one source or fact when you share a current event, and you'll know it's working when classmates ask 'where'd you read that?'",
    { type: 'growth', area: 'current-events', objective: 'relevance', tone: 'encouraging' },
  ),

  // ---- Presentations ----
  entry(
    'seed-presentation-success-1',
    "{name}, your {assignment} presentation was clear and confident — you made eye contact, paced yourself, and clearly knew your material instead of reading slides. I could tell you'd prepared.",
    { type: 'success', area: 'presentation', objective: 'public-speaking', tone: 'encouraging' },
  ),
  entry(
    'seed-presentation-growth-1',
    "{name}, your presentation content was strong, but you read most of it from your notes. Next step: practice once out loud so you can look up and talk to your audience — you'll know it's better when you only glance at your notes instead of reading them.",
    { type: 'growth', area: 'presentation', objective: 'public-speaking', tone: 'warm' },
  ),

  // ---- Note-taking ----
  entry(
    'seed-note-taking-skill-1',
    "{name}, your notes have become a tool you actually use — organized, in your own words, and easy to study from. I noticed you {personal_detail}, and it's clearly paying off in your work.",
    { type: 'skill', area: 'note-taking', objective: 'organization', tone: 'warm' },
  ),
  entry(
    'seed-note-taking-growth-1',
    "{name}, right now you copy notes word for word, which makes it hard to find what matters later. Next step: try writing each main idea in your own words and starring the key term — you'll know it's working when you can study from a glance instead of rereading everything.",
    { type: 'growth', area: 'note-taking', objective: 'organization', tone: 'direct' },
  ),

  // ---- Academic vocabulary ----
  entry(
    'seed-vocabulary-success-1',
    "{name}, you've started using our history vocabulary naturally in writing and discussion — words like the ones from {unit} show up correctly in your work, not just on the quiz. That precision makes your ideas sharper.",
    { type: 'success', area: 'vocabulary', objective: 'academic-language', tone: 'encouraging' },
  ),
  entry(
    'seed-vocabulary-growth-1',
    "{name}, you know our unit vocabulary on the quiz, but it rarely shows up when you write or talk. Next step: challenge yourself to use one new term per paragraph — you'll know it's sticking when the words feel natural instead of forced.",
    { type: 'growth', area: 'vocabulary', objective: 'academic-language', tone: 'warm' },
  ),

  // ---- CER (more, mid-year + paired) ----
  entry(
    'seed-cer-success-2',
    "{name}, this week your CER on {cer_topic} had a claim I could argue with and evidence that actually backed it up. You're getting the hang of writing like a historian.",
    { type: 'success', area: 'cer', objective: 'argumentation', tone: 'encouraging' },
  ),
  entry(
    'seed-cer-growth-2',
    "{name}, your CER evidence is solid, but your reasoning often repeats the evidence instead of explaining it. Next step: after your evidence, ask yourself 'why does this prove my claim?' and write that — you'll know it's working when the reasoning says something the quote didn't.",
    { type: 'growth', area: 'cer', objective: 'reasoning', tone: 'direct' },
  ),

  // ---- Discussion (more, mid-year) ----
  entry(
    'seed-discussion-skill-1',
    "{name}, you've learned to build on what classmates say instead of just waiting your turn — in our {debate_topic} seminar you said 'building on that…' and took someone's idea further. That's true discussion.",
    { type: 'skill', area: 'discussion', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'seed-discussion-growth-2',
    "{name}, you share strong opinions in discussion; the next step is grounding them in evidence from our reading. Try starting with 'the document says…' before your opinion — you'll know it's working when classmates can see where your idea came from.",
    { type: 'growth', area: 'discussion', objective: 'evidence', tone: 'encouraging' },
  ),

  // ---- Research (more, mid-year) ----
  entry(
    'seed-research-growth-2',
    "{name}, this quarter your research on {research_topic} relied mostly on one source. Next step: find a second source that confirms or challenges the first before you write — you'll know your research is solid when two sources agree, or when you can explain why they don't.",
    { type: 'growth', area: 'research', objective: 'source-analysis', tone: 'direct' },
  ),

  // ---- Professionalism / organization (more) ----
  entry(
    'seed-professionalism-growth-2',
    "{name}, your binder and missing-work tracking slipped this quarter, which made things harder than they needed to be. Next step: do a two-minute folder check at the end of each class — you'll know it's working when you can find any assignment without searching.",
    { type: 'growth', area: 'professionalism', objective: 'organization', tone: 'warm' },
  ),
  entry(
    'seed-professionalism-success-2',
    "{name}, I want to recognize how you used class work time this quarter — focused, organized, and starting without being told. That self-management is a skill that will carry you everywhere. Reach me anytime at {teacher_email} if you want to keep building on it.",
    { type: 'success', area: 'professionalism', objective: 'self-management', tone: 'encouraging' },
  ),

  // ---- Collaboration (more, mid-year) ----
  entry(
    'seed-collaboration-skill-1',
    "{name}, during {project_name} you got better at sharing the work fairly and keeping your group on task without taking over. That balance of leading and listening is hard to do, and you're doing it.",
    { type: 'skill', area: 'collaboration', objective: 'teamwork', tone: 'warm' },
  ),

  // ---- Primary source (more, behavior of close reading) ----
  entry(
    'seed-primary-source-growth-2',
    "{name}, you read our documents quickly and miss details that change their meaning. Next step: read each source twice — once for the gist, once with a pencil to mark surprising words — and you'll know it's working when you catch something the first read hid.",
    { type: 'growth', area: 'primary-source', objective: 'close-reading', tone: 'warm' },
  ),

  // ---- Thesis (paired success) ----
  entry(
    'seed-thesis-success-1',
    "{name}, your thesis on {cer_topic} this week did real work — it took a clear side and previewed your reasons. That one strong sentence set up your whole essay.",
    { type: 'success', area: 'thesis', objective: 'argumentation', tone: 'encouraging' },
  ),

  // ---- DBQ (paired skill) ----
  entry(
    'seed-dbq-skill-1',
    "{name}, you've learned to weave documents into a real argument rather than answering them one by one. On {assignment} your essay read like a case you were making, and that's the goal.",
    { type: 'skill', area: 'dbq', objective: 'argumentation', tone: 'warm' },
  ),

  // ---- Chronology (paired success) ----
  entry(
    'seed-chronology-success-1',
    "{name}, your timeline for {unit} was accurate and clear, and you could explain not just the order of events but why they unfolded the way they did. That sense of sequence is a historian's tool.",
    { type: 'success', area: 'chronology', objective: 'cause-effect', tone: 'encouraging' },
  ),

  // ---- Geography (paired skill) ----
  entry(
    'seed-geography-skill-1',
    "{name}, you've started using maps to explain history, not just to find places — this week you connected {personal_detail} to the geography of the region. That's a big step.",
    { type: 'skill', area: 'geography', objective: 'map-skills', tone: 'warm' },
  ),

  // ---- Note-taking (paired success) ----
  entry(
    'seed-note-taking-success-1',
    "{name}, your notes this quarter were a model — organized, selective, and genuinely useful for studying. When you used them on the {assignment}, it showed.",
    { type: 'success', area: 'note-taking', objective: 'organization', tone: 'encouraging' },
  ),

  // ---- Current events (paired skill) ----
  entry(
    'seed-current-events-skill-1',
    "{name}, you've gotten good at spotting the history behind today's headlines — you brought in something you'd read and tied it straight to {cer_topic}. Keep making those connections.",
    { type: 'skill', area: 'current-events', objective: 'relevance', tone: 'warm' },
  ),

  // ---- Presentation (paired skill) ----
  entry(
    'seed-presentation-skill-1',
    "{name}, your speaking has grown a lot this year — you're calmer at the front of the room and you explain your slides instead of reading them. On {assignment} that confidence really came through.",
    { type: 'skill', area: 'presentation', objective: 'public-speaking', tone: 'encouraging' },
  ),

  // ---- Vocabulary (paired skill) ----
  entry(
    'seed-vocabulary-skill-1',
    "{name}, you've built a real bank of history vocabulary and you reach for it when you write — using the right term from {unit} made your last argument noticeably clearer.",
    { type: 'skill', area: 'vocabulary', objective: 'academic-language', tone: 'warm' },
  ),

  // ---- Civics (paired, present-tense) ----
  entry(
    'seed-civics-growth-2',
    "{name}, you have strong opinions about fairness and government, which is great — the next step is grounding them in how the system actually works. Try naming the branch or right involved when you argue a point, and you'll know it's landing when your case sounds like a citizen's, not just a complaint.",
    { type: 'growth', area: 'civics', objective: 'civic-reasoning', tone: 'encouraging' },
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
