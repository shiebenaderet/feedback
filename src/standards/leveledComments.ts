// Standards-based, leveled feedback comment bank for Grade 8 U.S. History.
//
// Covers every component returned by `courseComponents()` (Grade 8 + the
// all-grades Skills strand), four entries each, one per proficiency level.
//
// District 4-level proficiency scale:
//   4 Exemplary   — exceeds expectations at this time
//   3 Proficient  — meets expectations at this time
//   2 Progressing — approaching expectations at this time
//   1 Beginning   — below expectations at this time
//
// Each `text` is student-facing, starts with the {name} fill slot, names the
// skill/content of that specific standard, and is framed for growth ("at this
// time", describe the work not the child). Levels 1–3 carry a concrete
// `nextStep` toward the next level. Use only the {name} token; no Markdown.

import { isKnownStandard, courseComponents } from './standards';

export type Proficiency = 4 | 3 | 2 | 1;

export interface LeveledComment {
  /** A component code present in courseComponents(), e.g. 'SSS4.6-8.1'. */
  standardCode: string;
  level: Proficiency;
  /** 1–2 sentence, student-facing, starts with {name}; growth-framed. */
  text: string;
  /** Concrete next step toward the next level (required for levels 1–3). */
  nextStep?: string;
}

export const LEVELED_COMMENTS: LeveledComment[] = [
  // ===================== CIVICS =====================

  // C1.6-8.3 — Declaration / Constitution / Bill of Rights ideals
  {
    standardCode: 'C1.6-8.3',
    level: 4,
    text: '{name}, you not only explain founding ideals like life, liberty, separation of powers, and due process, you connect them to one another and show how they shape the way our government actually works.',
    nextStep: 'Try comparing how two of these ideals can pull in opposite directions in a real case, such as free expression versus public safety.',
  },
  {
    standardCode: 'C1.6-8.3',
    level: 3,
    text: '{name}, you clearly explain the key ideals in the Declaration, Constitution, and Bill of Rights and give an accurate example of what each one means.',
    nextStep: 'Pick one ideal, like popular sovereignty, and explain in a sentence how it changes what the government is allowed to do.',
  },
  {
    standardCode: 'C1.6-8.3',
    level: 2,
    text: '{name}, you can name several founding ideals and you are starting to say what they mean, though some explanations still mix the documents together or stay general.',
    nextStep: 'Match each ideal to its document (life and liberty to the Declaration, due process to the Bill of Rights) and write one plain-language definition for each.',
  },
  {
    standardCode: 'C1.6-8.3',
    level: 1,
    text: '{name}, this work is just beginning to identify the founding ideals, and right now the terms like rule of law or freedom of expression are listed without a clear meaning yet.',
    nextStep: 'Choose one ideal and write a single sentence in your own words that says what it protects for people.',
  },

  // C1.6-8.4 — Evaluate efforts to reduce gaps between ideals and reality
  {
    standardCode: 'C1.6-8.4',
    level: 4,
    text: '{name}, you weigh how well specific efforts closed the gap between our ideals and reality, and you judge their success with evidence instead of just describing them.',
    nextStep: 'Push further by comparing an effort that mostly succeeded with one that fell short and explain what made the difference.',
  },
  {
    standardCode: 'C1.6-8.4',
    level: 3,
    text: '{name}, you describe a real effort to close the gap between an American ideal and how people were actually treated, and you make a clear judgment about whether it worked.',
    nextStep: 'Strengthen your judgment by pointing to one specific result that shows how much the gap actually shrank.',
  },
  {
    standardCode: 'C1.6-8.4',
    level: 2,
    text: '{name}, you can describe a gap between an ideal and reality, and you are beginning to look at efforts to fix it, but the evaluation of how well it worked is still missing.',
    nextStep: 'After you name an effort, add one sentence that says whether it succeeded and how you can tell.',
  },
  {
    standardCode: 'C1.6-8.4',
    level: 1,
    text: '{name}, this work is starting to notice that ideals and real life did not always match, and the next move is to connect that gap to a specific effort to change it.',
    nextStep: 'Name one group or law that tried to make reality match an ideal, then say what it was trying to fix.',
  },

  // C2.6-8.3 — Structure and powers of national government
  {
    standardCode: 'C2.6-8.3',
    level: 4,
    text: '{name}, you explain the three branches and their powers precisely and show how the design of the national government distributes and limits power on purpose.',
    nextStep: 'Extend this by tracing one power, such as making war or spending money, across more than one branch.',
  },
  {
    standardCode: 'C2.6-8.3',
    level: 3,
    text: '{name}, you accurately describe the structure of the national government and the main powers of the legislative, executive, and judicial branches.',
    nextStep: 'Add depth by explaining why a power was given to one branch and not another.',
  },
  {
    standardCode: 'C2.6-8.3',
    level: 2,
    text: '{name}, you can name the three branches, and you are beginning to match powers to them, though some powers are still placed in the wrong branch.',
    nextStep: 'Make a quick three-column chart and list one job for each branch before you write.',
  },
  {
    standardCode: 'C2.6-8.3',
    level: 1,
    text: '{name}, this work is just starting to identify the parts of the national government, and the branches and their powers are not yet sorted out.',
    nextStep: 'Name the three branches of the federal government and one thing each one does.',
  },

  // C2.6-8.4 — Use knowledge of government to address a political issue
  {
    standardCode: 'C2.6-8.4',
    level: 4,
    text: '{name}, you use what you know about how government works to analyze a political issue and propose a realistic action that fits the right level or branch of government.',
    nextStep: 'Sharpen it by predicting one obstacle your proposed action would face and how government could handle it.',
  },
  {
    standardCode: 'C2.6-8.4',
    level: 3,
    text: '{name}, you connect a political issue to how government actually functions and suggest a reasonable way the government could respond.',
    nextStep: 'Name the specific branch or level of government that would act, and say why that is the right one.',
  },
  {
    standardCode: 'C2.6-8.4',
    level: 2,
    text: '{name}, you identify a political issue and have an opinion about it, and you are beginning to link it to government, though the connection to how government works is still loose.',
    nextStep: 'Ask yourself which part of government has the power to act on your issue, and write that part into your answer.',
  },
  {
    standardCode: 'C2.6-8.4',
    level: 1,
    text: '{name}, this work names a political issue, and the next step is to bring in what government can actually do about it.',
    nextStep: 'Pick one issue and write one sentence about an action a government could take on it.',
  },

  // C2.6-8.5 — Evaluate checks and balances using an event
  {
    standardCode: 'C2.6-8.5',
    level: 4,
    text: '{name}, you use a specific event to judge how well checks and balances worked and back your verdict with what each branch did and how the others responded.',
    nextStep: 'Take it further by asking whether the system worked as the founders intended or in an unexpected way.',
  },
  {
    standardCode: 'C2.6-8.5',
    level: 3,
    text: '{name}, you use a real event to show checks and balances in action and make a clear judgment about how effective the system was.',
    nextStep: 'Strengthen your verdict by naming the exact check one branch used on another.',
  },
  {
    standardCode: 'C2.6-8.5',
    level: 2,
    text: '{name}, you can describe an event and you know checks and balances exist, but the work does not yet evaluate how well the checks actually worked.',
    nextStep: 'After describing the event, add one sentence saying whether a branch successfully checked another and how you know.',
  },
  {
    standardCode: 'C2.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to recognize that branches can limit each other, and the next move is to tie that idea to an actual event.',
    nextStep: 'Choose one event and name which two branches were involved in it.',
  },

  // C2.6-8.6 — U.S. government is both a democracy and a republic
  {
    standardCode: 'C2.6-8.6',
    level: 4,
    text: '{name}, you show clearly that the U.S. blends democracy and republic, using specific features like voting and elected representatives, and you explain why both ideas are needed.',
    nextStep: 'Extend this by explaining a tension between direct rule by the people and rule through representatives.',
  },
  {
    standardCode: 'C2.6-8.6',
    level: 3,
    text: '{name}, you demonstrate that the U.S. government has features of both a democracy and a republic and give an accurate example of each.',
    nextStep: 'Add one sentence explaining why the founders chose to combine the two.',
  },
  {
    standardCode: 'C2.6-8.6',
    level: 2,
    text: '{name}, you can define democracy or republic, and you are starting to apply the terms to the U.S., though the two ideas still get blended together.',
    nextStep: 'Write one example of the people ruling directly and one example of the people ruling through representatives.',
  },
  {
    standardCode: 'C2.6-8.6',
    level: 1,
    text: '{name}, this work is just beginning to work with the terms democracy and republic, and their meanings are not yet clear.',
    nextStep: 'Write a one-sentence definition of either democracy or republic in your own words.',
  },

  // C3.6-8.5 — Early examples of U.S. foreign policy
  {
    standardCode: 'C3.6-8.5',
    level: 4,
    text: '{name}, you identify early examples of U.S. foreign policy and explain what the young nation was trying to gain or avoid in dealing with other countries.',
    nextStep: 'Compare two early foreign-policy choices and explain what they reveal about the nation’s priorities.',
  },
  {
    standardCode: 'C3.6-8.5',
    level: 3,
    text: '{name}, you correctly identify an early example of foreign policy between the United States and another nation and describe what it involved.',
    nextStep: 'Add a sentence explaining what the United States hoped to get out of that decision.',
  },
  {
    standardCode: 'C3.6-8.5',
    level: 2,
    text: '{name}, you can name an early event involving the U.S. and another country, and you are starting to see it as foreign policy, though the purpose is still unclear.',
    nextStep: 'For your example, write one sentence on which two countries were involved and what the U.S. wanted.',
  },
  {
    standardCode: 'C3.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to look at how the early U.S. dealt with other nations, and the next step is to pin down a specific example.',
    nextStep: 'Name one early treaty, alliance, or policy between the U.S. and another country.',
  },

  // C3.6-8.6 — How the U.S. has interacted with other countries
  {
    standardCode: 'C3.6-8.6',
    level: 4,
    text: '{name}, you analyze how the United States has interacted with other countries and explain the motives and consequences behind those interactions, not just what happened.',
    nextStep: 'Push further by judging whether an interaction helped or hurt U.S. relationships in the long run.',
  },
  {
    standardCode: 'C3.6-8.6',
    level: 3,
    text: '{name}, you describe an interaction between the U.S. and another country and explain at least one cause or effect of it.',
    nextStep: 'Add a second cause or effect so your analysis shows more than one side of the interaction.',
  },
  {
    standardCode: 'C3.6-8.6',
    level: 2,
    text: '{name}, you can describe what happened between the U.S. and another country, and you are beginning to ask why, though the causes and effects are still thin.',
    nextStep: 'After you describe the interaction, add one sentence answering why it happened.',
  },
  {
    standardCode: 'C3.6-8.6',
    level: 1,
    text: '{name}, this work is starting to identify a moment when the U.S. dealt with another country, and the next move is to explain it rather than just name it.',
    nextStep: 'Pick one interaction and write one sentence describing what each country did.',
  },

  // C4.6-8.4 — How a claim balances individual rights and common good
  {
    standardCode: 'C4.6-8.4',
    level: 4,
    text: '{name}, you analyze how a claim tries to balance individual rights against the common good and you weigh whether the balance it strikes is fair.',
    nextStep: 'Extend this by proposing where you would set the balance and defending it.',
  },
  {
    standardCode: 'C4.6-8.4',
    level: 3,
    text: '{name}, you explain how a claim on an issue weighs individual rights against the common good and you point to both sides of the trade-off.',
    nextStep: 'Add a sentence judging whether the claim leans more toward rights or the common good.',
  },
  {
    standardCode: 'C4.6-8.4',
    level: 2,
    text: '{name}, you can identify a claim about an issue, and you are starting to see that rights and the common good are both involved, though only one side is developed.',
    nextStep: 'For your issue, name one individual right at stake and one benefit to the whole community.',
  },
  {
    standardCode: 'C4.6-8.4',
    level: 1,
    text: '{name}, this work is beginning to take a position on an issue, and the next step is to notice the tension between personal rights and what is good for everyone.',
    nextStep: 'Write your claim, then add one person or group it would affect.',
  },

  // C4.6-8.5 — Strategies for civic involvement on a national issue
  {
    standardCode: 'C4.6-8.5',
    level: 4,
    text: '{name}, you choose realistic strategies for acting on a national issue and explain why each strategy fits the issue and could make a difference.',
    nextStep: 'Sharpen it by sequencing your strategies into a short plan and predicting the first response you would get.',
  },
  {
    standardCode: 'C4.6-8.5',
    level: 3,
    text: '{name}, you identify a national issue and propose a workable strategy for getting involved, such as petitioning, contacting officials, or organizing.',
    nextStep: 'Explain in a sentence why that strategy fits a national issue rather than a local one.',
  },
  {
    standardCode: 'C4.6-8.5',
    level: 2,
    text: '{name}, you can name a national issue you care about, and you are starting to suggest ways to act, though the strategy is still vague.',
    nextStep: 'Replace a general idea like "spread awareness" with one specific action and who you would direct it to.',
  },
  {
    standardCode: 'C4.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to identify a national issue, and the next step is to think about what a citizen could actually do about it.',
    nextStep: 'Name one concrete action a person could take to influence a national issue.',
  },

  // ===================== ECONOMICS =====================

  // E1.6-8.3 — Profit and personal values in economic choices
  {
    standardCode: 'E1.6-8.3',
    level: 4,
    text: '{name}, you analyze how people weighed profit against personal values in an economic choice and explain how that tension shaped what they decided.',
    nextStep: 'Extend this by comparing two people or groups who balanced profit and values differently.',
  },
  {
    standardCode: 'E1.6-8.3',
    level: 3,
    text: '{name}, you give an example of an economic choice and show that both profit and personal values were part of the decision.',
    nextStep: 'Add a sentence saying which one, profit or values, mattered more in your example and how you can tell.',
  },
  {
    standardCode: 'E1.6-8.3',
    level: 2,
    text: '{name}, you can describe an economic choice, and you are beginning to mention either profit or values, but not yet both together.',
    nextStep: 'For your example, name the money motive and the values motive in the same answer.',
  },
  {
    standardCode: 'E1.6-8.3',
    level: 1,
    text: '{name}, this work is starting to identify an economic choice, and the next move is to ask what reasons were behind it.',
    nextStep: 'Pick one choice and write one sentence about why the person or group made it.',
  },

  // E2.6-8.5 — Supply and demand on production/distribution/consumption in the U.S.
  {
    standardCode: 'E2.6-8.5',
    level: 4,
    text: '{name}, you analyze how supply and demand shaped the way goods were produced, distributed, and consumed in the U.S., and you trace the chain of effects clearly.',
    nextStep: 'Push further by explaining what happened when supply or demand suddenly shifted.',
  },
  {
    standardCode: 'E2.6-8.5',
    level: 3,
    text: '{name}, you explain how supply and demand affected production, distribution, or consumption in the U.S. with a clear and accurate example.',
    nextStep: 'Connect a second stage so you show, for example, how demand changed both production and consumption.',
  },
  {
    standardCode: 'E2.6-8.5',
    level: 2,
    text: '{name}, you can define supply and demand, and you are starting to apply them to the U.S. economy, though the link to a real example is still loose.',
    nextStep: 'Pick one product and write what happened to its price when supply or demand changed.',
  },
  {
    standardCode: 'E2.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to use the terms supply and demand, and their meanings are not yet steady.',
    nextStep: 'Write a one-sentence definition of supply and one of demand in your own words.',
  },

  // E2.6-8.6 — Supply and demand on U.S. international trade
  {
    standardCode: 'E2.6-8.6',
    level: 4,
    text: '{name}, you analyze how supply and demand have shaped U.S. trade with other countries and explain how shortages or surpluses pushed trade in a certain direction.',
    nextStep: 'Extend this by showing how a change abroad affected supply or demand at home.',
  },
  {
    standardCode: 'E2.6-8.6',
    level: 3,
    text: '{name}, you explain how supply and demand affected international trade for the U.S. with a clear example of a good that was traded.',
    nextStep: 'Add a sentence on how the other country’s needs or resources fit into the trade.',
  },
  {
    standardCode: 'E2.6-8.6',
    level: 2,
    text: '{name}, you can connect supply and demand to trade in general, and you are starting to apply it to the U.S. and other countries, but the example is still unclear.',
    nextStep: 'Name one good the U.S. traded and say whether other countries wanted more or less of it.',
  },
  {
    standardCode: 'E2.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to connect supply and demand to trade between countries, and the next step is to ground it in a real good.',
    nextStep: 'Name one product the U.S. has traded with another country.',
  },

  // E3.6-8.3 — Influence of U.S. taxation, currency, and tariffs
  {
    standardCode: 'E3.6-8.3',
    level: 4,
    text: '{name}, you analyze how taxation, currency, or tariffs influenced the U.S. economy and explain who benefited and who was hurt by the policy.',
    nextStep: 'Compare a tax or tariff that helped one group with how it affected another to show the trade-off.',
  },
  {
    standardCode: 'E3.6-8.3',
    level: 3,
    text: '{name}, you explain how a government tool like a tax, currency, or tariff affected the U.S. economy with a clear example.',
    nextStep: 'Add a sentence naming a group that was helped or hurt by that policy.',
  },
  {
    standardCode: 'E3.6-8.3',
    level: 2,
    text: '{name}, you can define tax, tariff, or currency, and you are starting to link one to the economy, though the effect is still general.',
    nextStep: 'Pick one tool and write one sentence on what it did to prices, trade, or government money.',
  },
  {
    standardCode: 'E3.6-8.3',
    level: 1,
    text: '{name}, this work is beginning to recognize that the government taxes, makes money, and sets tariffs, and the next move is to connect one of these to a result.',
    nextStep: 'Choose one term, tax or tariff or currency, and write what it means in your own words.',
  },

  // E4.6-8.5 — Distribution of wealth and sustainability of resources in the U.S.
  {
    standardCode: 'E4.6-8.5',
    level: 4,
    text: '{name}, you analyze how wealth is distributed and how sustainable resources are in the U.S., and you support your view with patterns or data rather than impressions.',
    nextStep: 'Extend this by explaining a cause behind an unequal distribution you identified.',
  },
  {
    standardCode: 'E4.6-8.5',
    level: 3,
    text: '{name}, you describe how wealth or resources are distributed in the U.S. and make an accurate point about how even or sustainable it is.',
    nextStep: 'Back your point with one specific figure, region, or group to make it concrete.',
  },
  {
    standardCode: 'E4.6-8.5',
    level: 2,
    text: '{name}, you can state that wealth and resources are not shared equally, and you are starting to describe it, though the description stays general.',
    nextStep: 'Name one group or region that has more and one that has less to anchor your point.',
  },
  {
    standardCode: 'E4.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to consider how wealth and resources are spread across the U.S., and the next step is to give an actual example.',
    nextStep: 'Write one sentence describing a difference in wealth or resources between two groups or places.',
  },

  // E4.6-8.6 — Costs and benefits of U.S. trade policies
  {
    standardCode: 'E4.6-8.6',
    level: 4,
    text: '{name}, you explain the costs and benefits of a U.S. trade policy for individuals, businesses, and society and show how the same policy can help some while hurting others.',
    nextStep: 'Take it further by deciding whether the policy was worth it overall and defending that call.',
  },
  {
    standardCode: 'E4.6-8.6',
    level: 3,
    text: '{name}, you explain both a cost and a benefit of a U.S. trade policy and name who is affected.',
    nextStep: 'Add a second group so you show the policy affecting individuals and businesses, not just one.',
  },
  {
    standardCode: 'E4.6-8.6',
    level: 2,
    text: '{name}, you can name a trade policy and either a cost or a benefit, and you are starting to see that it affects people differently.',
    nextStep: 'For your policy, list one cost and one benefit side by side.',
  },
  {
    standardCode: 'E4.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to identify a trade policy, and the next step is to ask who gains and who loses from it.',
    nextStep: 'Name one trade policy and one group it affects.',
  },

  // ===================== GEOGRAPHY =====================

  // G1.6-8.5 — Physical and cultural characteristics of U.S. places and regions
  {
    standardCode: 'G1.6-8.5',
    level: 4,
    text: '{name}, you explain and analyze the physical and cultural features of U.S. places and regions and show how the land and the people influence each other.',
    nextStep: 'Extend this by comparing two regions and explaining why their characteristics differ.',
  },
  {
    standardCode: 'G1.6-8.5',
    level: 3,
    text: '{name}, you describe both physical and cultural characteristics of a U.S. region accurately and clearly.',
    nextStep: 'Connect the two by explaining how a physical feature shaped the region’s culture or economy.',
  },
  {
    standardCode: 'G1.6-8.5',
    level: 2,
    text: '{name}, you can name features of a U.S. region, and you are starting to sort them, though physical and cultural features still get mixed.',
    nextStep: 'List two physical features (land, climate) and two cultural features (language, work, traditions) for your region.',
  },
  {
    standardCode: 'G1.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to identify a U.S. region, and the next step is to describe what it is actually like.',
    nextStep: 'Name one region and one thing about its land or its people.',
  },

  // G1.6-8.6 — Use maps/images to explain location and political/cultural/economic dynamics
  {
    standardCode: 'G1.6-8.6',
    level: 4,
    text: '{name}, you use maps, images, and other representations to explain how the location of a place connects to its political, cultural, and economic life.',
    nextStep: 'Push further by using two different sources, such as a map and a photo, that reveal different things about the same place.',
  },
  {
    standardCode: 'G1.6-8.6',
    level: 3,
    text: '{name}, you read a map or image and use it to explain a real connection between a place’s location and its political, cultural, or economic situation.',
    nextStep: 'Name the exact feature on the source, such as a river or border, that supports your explanation.',
  },
  {
    standardCode: 'G1.6-8.6',
    level: 2,
    text: '{name}, you can pull facts off a map or image, and you are starting to link location to life there, but the connection is still thin.',
    nextStep: 'After reading the map, write one sentence on how being in that location affected the people or economy.',
  },
  {
    standardCode: 'G1.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to use a map or image, and the next step is to get information from it rather than describe it in general.',
    nextStep: 'Use the legend or labels to state one specific fact the map or image shows.',
  },

  // G2.6-8.6 — Environment and people affecting each other in the U.S.
  {
    standardCode: 'G2.6-8.6',
    level: 4,
    text: '{name}, you analyze how the U.S. environment shaped people and how people changed the environment, and you show this as a two-way relationship with clear examples.',
    nextStep: 'Extend this by tracing a chain where a human change to the land caused a later effect back on people.',
  },
  {
    standardCode: 'G2.6-8.6',
    level: 3,
    text: '{name}, you give a clear example of how the environment affected people in the U.S. and how people affected the environment.',
    nextStep: 'Connect your two examples so they show cause and effect rather than standing alone.',
  },
  {
    standardCode: 'G2.6-8.6',
    level: 2,
    text: '{name}, you can describe either how the land shaped people or how people changed the land, but not yet both directions.',
    nextStep: 'Add the missing direction so you have one example each way.',
  },
  {
    standardCode: 'G2.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to notice a link between people and the environment, and the next step is to give a concrete example.',
    nextStep: 'Write one sentence about a way the land affected people or people affected the land.',
  },

  // G2.6-8.7 — Cultural diffusion in the U.S.
  {
    standardCode: 'G2.6-8.7',
    level: 4,
    text: '{name}, you explain cultural diffusion in the U.S. by tracing how an idea, food, language, or practice spread from one group to others and changed along the way.',
    nextStep: 'Extend this by explaining what made that idea spread so widely.',
  },
  {
    standardCode: 'G2.6-8.7',
    level: 3,
    text: '{name}, you give a clear example of cultural diffusion in the U.S. and show where the idea or practice came from and where it spread.',
    nextStep: 'Add a sentence on how the practice changed as it moved between groups.',
  },
  {
    standardCode: 'G2.6-8.7',
    level: 2,
    text: '{name}, you can name a cultural practice that spread, and you are starting to use the idea of diffusion, though the path of spreading is unclear.',
    nextStep: 'Name where your example started and one group it spread to.',
  },
  {
    standardCode: 'G2.6-8.7',
    level: 1,
    text: '{name}, this work is beginning to recognize that cultures share ideas, and the next step is to name a specific example.',
    nextStep: 'Name one food, word, music, or custom in the U.S. that came from another culture.',
  },

  // G2.6-8.8 — Migration as a catalyst for U.S. growth
  {
    standardCode: 'G2.6-8.8',
    level: 4,
    text: '{name}, you analyze migration as a driver of U.S. growth, explaining how the movement of people changed the population, economy, or culture of the nation.',
    nextStep: 'Push further by weighing a benefit of migration against a tension it created.',
  },
  {
    standardCode: 'G2.6-8.8',
    level: 3,
    text: '{name}, you explain how migration helped the U.S. grow and give a clear example of the change it brought.',
    nextStep: 'Add a sentence on why people migrated in your example.',
  },
  {
    standardCode: 'G2.6-8.8',
    level: 2,
    text: '{name}, you can describe a group that migrated, and you are beginning to link it to growth, though the effect on the nation is still general.',
    nextStep: 'Name one way the migrating group changed the place they moved to.',
  },
  {
    standardCode: 'G2.6-8.8',
    level: 1,
    text: '{name}, this work is beginning to identify the movement of a group of people, and the next step is to connect it to the growth of the country.',
    nextStep: 'Name one group that moved to or within the U.S. and where they went.',
  },

  // G3.6-8.3 — Geography of the U.S. helps understand global issues
  {
    standardCode: 'G3.6-8.3',
    level: 4,
    text: '{name}, you use the geography of the U.S. to explain a global issue like trade, diversity, or sustainability and show how location and resources tie the nation to the wider world.',
    nextStep: 'Extend this by connecting your U.S. example to how the same issue plays out in another country.',
  },
  {
    standardCode: 'G3.6-8.3',
    level: 3,
    text: '{name}, you explain how knowing U.S. geography helps us understand a global issue such as trade, diversity, or sustainability.',
    nextStep: 'Name the specific geographic feature, such as a resource or location, that links the U.S. to that issue.',
  },
  {
    standardCode: 'G3.6-8.3',
    level: 2,
    text: '{name}, you can name a global issue, and you are starting to tie it to U.S. geography, though the link is still loose.',
    nextStep: 'Pick one issue and write one sentence on how a U.S. resource or location connects to it.',
  },
  {
    standardCode: 'G3.6-8.3',
    level: 1,
    text: '{name}, this work is beginning to mention a global issue like trade or sustainability, and the next step is to bring U.S. geography into it.',
    nextStep: 'Name one global issue and one geographic feature of the U.S.',
  },

  // ===================== HISTORY =====================

  // H1.6-8.6 — Eras of U.S. history 1763–1877
  {
    standardCode: 'H1.6-8.6',
    level: 4,
    text: '{name}, you explain how key themes define the eras of U.S. history from 1763 to 1877 and you place events in the right era while showing how one era led into the next.',
    nextStep: 'Extend this by explaining how a development in one era set up a conflict in the following era.',
  },
  {
    standardCode: 'H1.6-8.6',
    level: 3,
    text: '{name}, you identify the main eras between 1763 and 1877, such as independence, the new nation, expansion and reform, and Civil War, and place events in the correct era.',
    nextStep: 'Add the theme that defines one era so it is more than just a set of dates.',
  },
  {
    standardCode: 'H1.6-8.6',
    level: 2,
    text: '{name}, you can name some events from 1763 to 1877, and you are starting to put them in order, though they are not yet grouped into eras.',
    nextStep: 'Sort three events you know into the era they belong to (independence, new nation, expansion, or Civil War).',
  },
  {
    standardCode: 'H1.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to recognize events from this period, and the next step is to put them in time order.',
    nextStep: 'List two events from U.S. history and write which one happened first.',
  },

  // H2.6-8.5 — Individuals and movements shaping U.S. history (1763–1877)
  {
    standardCode: 'H2.6-8.5',
    level: 4,
    text: '{name}, you analyze how individuals and movements shaped U.S. history between 1763 and 1877 and explain the difference they made, not just what they did.',
    nextStep: 'Push further by comparing the impact of an individual with the impact of a movement.',
  },
  {
    standardCode: 'H2.6-8.5',
    level: 3,
    text: '{name}, you explain how a specific person or movement helped shape U.S. history in this era and describe their impact.',
    nextStep: 'Add a sentence on how things might have gone differently without them.',
  },
  {
    standardCode: 'H2.6-8.5',
    level: 2,
    text: '{name}, you can name a person or movement from this era, and you are starting to describe what they did, though the impact is still unclear.',
    nextStep: 'After naming the person or movement, write one sentence on the change they helped cause.',
  },
  {
    standardCode: 'H2.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to identify a person or movement from this period, and the next step is to say what they actually did.',
    nextStep: 'Name one person or movement from 1763 to 1877 and one thing they were known for.',
  },

  // H2.6-8.6 — Cultures and ethnic groups contributing to U.S. history (1763–1877)
  {
    standardCode: 'H2.6-8.6',
    level: 4,
    text: '{name}, you analyze how cultures and ethnic groups contributed to U.S. history between 1763 and 1877 and show how their experiences and actions shaped the nation.',
    nextStep: 'Extend this by comparing the contributions or experiences of two different groups.',
  },
  {
    standardCode: 'H2.6-8.6',
    level: 3,
    text: '{name}, you explain how a specific cultural or ethnic group contributed to U.S. history in this era with a clear example.',
    nextStep: 'Add a sentence on how that contribution affected the wider nation.',
  },
  {
    standardCode: 'H2.6-8.6',
    level: 2,
    text: '{name}, you can name a cultural or ethnic group from this era, and you are starting to describe their role, though the contribution is still general.',
    nextStep: 'Name one specific thing the group did, made, or fought for.',
  },
  {
    standardCode: 'H2.6-8.6',
    level: 1,
    text: '{name}, this work is beginning to recognize that many groups shaped this period, and the next step is to focus on one group.',
    nextStep: 'Name one cultural or ethnic group that was part of U.S. history in this era.',
  },

  // H2.6-8.7 — Technology and ideas impacting U.S. history (1763–1877)
  {
    standardCode: 'H2.6-8.7',
    level: 4,
    text: '{name}, you analyze how a technology or idea changed U.S. history between 1763 and 1877 and trace its effects through the economy, society, or politics.',
    nextStep: 'Push further by explaining an unintended consequence of that technology or idea.',
  },
  {
    standardCode: 'H2.6-8.7',
    level: 3,
    text: '{name}, you explain how a specific technology or idea impacted U.S. history in this era and describe a clear effect.',
    nextStep: 'Add a second effect so you show the change reaching more than one part of society.',
  },
  {
    standardCode: 'H2.6-8.7',
    level: 2,
    text: '{name}, you can name a technology or idea from this era, and you are starting to link it to change, though the impact is still thin.',
    nextStep: 'After naming the technology or idea, write one sentence on what it changed.',
  },
  {
    standardCode: 'H2.6-8.7',
    level: 1,
    text: '{name}, this work is beginning to identify a technology or idea from this period, and the next step is to connect it to a result.',
    nextStep: 'Name one invention or idea from 1763 to 1877 and one thing it affected.',
  },

  // H3.6-8.4 — Interpret historical materials from a variety of perspectives (1763–1877)
  {
    standardCode: 'H3.6-8.4',
    level: 4,
    text: '{name}, you analyze historical materials from several perspectives and explain how each viewpoint and its source shape the story we get of this era.',
    nextStep: 'Extend this by explaining whose perspective is missing from the sources and why that matters.',
  },
  {
    standardCode: 'H3.6-8.4',
    level: 3,
    text: '{name}, you interpret a historical source and recognize the perspective behind it, showing that different people saw the same event differently.',
    nextStep: 'Compare two sources and name a point where their perspectives disagree.',
  },
  {
    standardCode: 'H3.6-8.4',
    level: 2,
    text: '{name}, you can summarize what a source says, and you are starting to ask who made it, though the perspective is not yet part of your interpretation.',
    nextStep: 'For one source, write a sentence on who created it and how that shaped their view.',
  },
  {
    standardCode: 'H3.6-8.4',
    level: 1,
    text: '{name}, this work is beginning to read a historical source, and the next step is to notice that it comes from a particular point of view.',
    nextStep: 'For one source, write who made it and one thing they thought.',
  },

  // H3.6-8.5 — Multiple causal factors to take positions on major events (1763–1877)
  {
    standardCode: 'H3.6-8.5',
    level: 4,
    text: '{name}, you weigh several causes of a major event from 1763 to 1877 and build a position that explains which causes mattered most and why.',
    nextStep: 'Push further by considering a cause that works against your position and answering it.',
  },
  {
    standardCode: 'H3.6-8.5',
    level: 3,
    text: '{name}, you use more than one cause to support a clear position about a major event in this era.',
    nextStep: 'Rank your causes so it is clear which one you think mattered most.',
  },
  {
    standardCode: 'H3.6-8.5',
    level: 2,
    text: '{name}, you can name a cause of an event and state a position, and you are starting to support it, though you are leaning on a single cause.',
    nextStep: 'Add a second cause so your position rests on more than one reason.',
  },
  {
    standardCode: 'H3.6-8.5',
    level: 1,
    text: '{name}, this work is beginning to identify an event and form an opinion, and the next step is to back it with a cause.',
    nextStep: 'State your position on an event and write one reason it happened.',
  },

  // H4.6-8.3 — How a historical event helps us understand a contemporary issue
  {
    standardCode: 'H4.6-8.3',
    level: 4,
    text: '{name}, you analyze how an event in U.S. history helps explain a present-day issue and draw a clear, well-reasoned connection between then and now.',
    nextStep: 'Extend this by noting one important way the past and present situations differ.',
  },
  {
    standardCode: 'H4.6-8.3',
    level: 3,
    text: '{name}, you connect a historical event to a contemporary issue and explain what the past helps us understand about today.',
    nextStep: 'Name the specific lesson or pattern that carries from the event to the present.',
  },
  {
    standardCode: 'H4.6-8.3',
    level: 2,
    text: '{name}, you can name a historical event and a current issue, and you are starting to link them, though the connection is still general.',
    nextStep: 'Write one sentence on what the historical event teaches us about the current issue.',
  },
  {
    standardCode: 'H4.6-8.3',
    level: 1,
    text: '{name}, this work is beginning to name a historical event, and the next step is to pair it with an issue we face today.',
    nextStep: 'Name one historical event and one present-day issue it reminds you of.',
  },

  // ===================== SOCIAL STUDIES SKILLS =====================

  // SSS1.6-8.1 — Analyze positions and evidence on an issue or event
  {
    standardCode: 'SSS1.6-8.1',
    level: 4,
    text: '{name}, you lay out the positions on an issue and examine the evidence behind each one, showing how strong or weak the support actually is.',
    nextStep: 'Extend this by identifying which position has the strongest evidence and explaining why.',
  },
  {
    standardCode: 'SSS1.6-8.1',
    level: 3,
    text: '{name}, you identify the different positions on an issue and point to the evidence each side uses.',
    nextStep: 'Add a sentence judging whether the evidence for one position really supports it.',
  },
  {
    standardCode: 'SSS1.6-8.1',
    level: 2,
    text: '{name}, you can state a position on an issue, and you are starting to mention evidence, though only one side is shown.',
    nextStep: 'Add the opposing position and one piece of evidence it relies on.',
  },
  {
    standardCode: 'SSS1.6-8.1',
    level: 1,
    text: '{name}, this work is beginning to identify an issue, and the next step is to spell out a position someone takes on it.',
    nextStep: 'Write one position on the issue and one fact that supports it.',
  },

  // SSS1.6-8.2 — Evaluate the logic of reasons for a position
  {
    standardCode: 'SSS1.6-8.2',
    level: 4,
    text: '{name}, you evaluate the logic behind reasons for a position, spotting whether they actually lead to the conclusion and catching gaps or weak links in the reasoning.',
    nextStep: 'Extend this by rewriting a weak reason so the logic holds up better.',
  },
  {
    standardCode: 'SSS1.6-8.2',
    level: 3,
    text: '{name}, you look at the reasons behind a position and judge whether the logic makes sense.',
    nextStep: 'Name the specific reason that is strongest or weakest and explain what makes it so.',
  },
  {
    standardCode: 'SSS1.6-8.2',
    level: 2,
    text: '{name}, you can restate the reasons given for a position, and you are starting to react to them, but you are not yet testing whether the logic holds.',
    nextStep: 'For one reason, ask whether it truly proves the point, and write yes or no with why.',
  },
  {
    standardCode: 'SSS1.6-8.2',
    level: 1,
    text: '{name}, this work is beginning to notice that a position has reasons, and the next step is to identify what those reasons are.',
    nextStep: 'Write down one reason someone gives for their position.',
  },

  // SSS2.6-8.1 — Create and use research questions to guide inquiry
  {
    standardCode: 'SSS2.6-8.1',
    level: 4,
    text: '{name}, you write focused research questions that drive your inquiry and you refine them as you learn, so your search stays on target.',
    nextStep: 'Extend this by turning your main question into smaller sub-questions that organize your research.',
  },
  {
    standardCode: 'SSS2.6-8.1',
    level: 3,
    text: '{name}, you create a clear research question and use it to guide what you look for about an issue or event.',
    nextStep: 'Sharpen your question so it cannot be answered with a simple yes or no.',
  },
  {
    standardCode: 'SSS2.6-8.1',
    level: 2,
    text: '{name}, you can choose a topic, and you are starting to form a question, though it is still broad or easy to answer in one word.',
    nextStep: 'Rewrite your question to start with how or why so it pushes for explanation.',
  },
  {
    standardCode: 'SSS2.6-8.1',
    level: 1,
    text: '{name}, this work is beginning to pick a topic, and the next step is to turn it into a question to research.',
    nextStep: 'Write one question you want to answer about your topic.',
  },

  // SSS2.6-8.2 — Evaluate breadth, reliability, and credibility of sources
  {
    standardCode: 'SSS2.6-8.2',
    level: 4,
    text: '{name}, you evaluate sources for reliability, credibility, and range, and you recognize when you need additional or better sources to answer your question fully.',
    nextStep: 'Extend this by explaining why one source is more trustworthy than another on the same topic.',
  },
  {
    standardCode: 'SSS2.6-8.2',
    level: 3,
    text: '{name}, you check whether your sources are reliable and credible and notice when you need more information.',
    nextStep: 'Add a note on who created each source and whether that affects how much to trust it.',
  },
  {
    standardCode: 'SSS2.6-8.2',
    level: 2,
    text: '{name}, you can gather sources, and you are starting to ask if they are trustworthy, but you are not yet judging them closely.',
    nextStep: 'Before you trust a source, jot one sentence on who made it and why.',
  },
  {
    standardCode: 'SSS2.6-8.2',
    level: 1,
    text: '{name}, this work is beginning to find sources, and the next step is to start asking whether they can be trusted.',
    nextStep: 'For one source, write where it came from (the author or website).',
  },

  // SSS3.6-8.1 — Discussion, analyzing multiple viewpoints on public issues
  {
    standardCode: 'SSS3.6-8.1',
    level: 4,
    text: '{name}, you take part in discussion by analyzing several viewpoints fairly, building on others’ ideas, and moving the group’s thinking forward on a public issue.',
    nextStep: 'Extend this by drawing a quieter classmate into the discussion or summarizing the group’s disagreement.',
  },
  {
    standardCode: 'SSS3.6-8.1',
    level: 3,
    text: '{name}, you join the discussion and consider more than one viewpoint on a public issue, responding to what others say.',
    nextStep: 'Try restating someone else’s view before adding your own to show you really heard it.',
  },
  {
    standardCode: 'SSS3.6-8.1',
    level: 2,
    text: '{name}, you share your own view in discussion, and you are starting to listen to others, though you mostly stay with your own side.',
    nextStep: 'In the next discussion, name one viewpoint different from yours before you respond.',
  },
  {
    standardCode: 'SSS3.6-8.1',
    level: 1,
    text: '{name}, this work is beginning to take part in discussion, and the next step is to share a clear view on the public issue.',
    nextStep: 'In the next discussion, say one sentence stating what you think about the issue.',
  },

  // SSS4.6-8.1 — Formulate a thesis from sources, avoiding plagiarism
  {
    standardCode: 'SSS4.6-8.1',
    level: 4,
    text: '{name}, you pull together several factors and sources into a focused, original thesis, and you use the sources to support your own argument in your own words.',
    nextStep: 'Extend this by weaving a source that complicates your thesis into the argument rather than ignoring it.',
  },
  {
    standardCode: 'SSS4.6-8.1',
    level: 3,
    text: '{name}, you form a clear thesis supported by sources and you put the information in your own words to avoid plagiarism.',
    nextStep: 'Tighten your thesis so it makes one specific, arguable claim rather than a general statement.',
  },
  {
    standardCode: 'SSS4.6-8.1',
    level: 2,
    text: '{name}, you gather information and state a main idea, and you are starting to build a thesis, though it still reads as a summary or stays close to the sources’ wording.',
    nextStep: 'Turn your main idea into a sentence that takes a position someone could argue against.',
  },
  {
    standardCode: 'SSS4.6-8.1',
    level: 1,
    text: '{name}, this work is beginning to collect facts on a topic, and the next step is to shape them into a main point of your own.',
    nextStep: 'Write one sentence saying what you want to prove, in your own words.',
  },

  // SSS4.6-8.2 — Cite sources in essay, presentation, and reference page
  {
    standardCode: 'SSS4.6-8.2',
    level: 4,
    text: '{name}, you cite your sources accurately and consistently in both the body of your work and the reference page, so a reader could find every source you used.',
    nextStep: 'Extend this by double-checking that every in-text citation has a matching entry on your reference page and vice versa.',
  },
  {
    standardCode: 'SSS4.6-8.2',
    level: 3,
    text: '{name}, you cite your sources in the correct format both within your work and on a reference page.',
    nextStep: 'Check that each citation includes all the required parts, such as author, title, and date.',
  },
  {
    standardCode: 'SSS4.6-8.2',
    level: 2,
    text: '{name}, you include some citations, and you are starting to use the format, though pieces are missing or the in-text and reference entries do not yet match.',
    nextStep: 'Use the citation format guide to add the missing parts to one source as a model for the rest.',
  },
  {
    standardCode: 'SSS4.6-8.2',
    level: 1,
    text: '{name}, this work is beginning to mention where information came from, and the next step is to record sources so they can be cited.',
    nextStep: 'For each source, write down the author, title, and where you found it.',
  },
];

// ── Lookups ────────────────────────────────────────────────────────────────

const BY_KEY = new Map<string, LeveledComment>();
for (const c of LEVELED_COMMENTS) BY_KEY.set(`${c.standardCode}|${c.level}`, c);

/** All four leveled comments for a component code, sorted 4 → 1. */
export function commentsForStandard(code: string): LeveledComment[] {
  return LEVELED_COMMENTS.filter((c) => c.standardCode === code).sort(
    (a, b) => b.level - a.level,
  );
}

/** The single comment for a component code at a given proficiency level. */
export function leveledComment(
  code: string,
  level: Proficiency,
): LeveledComment | undefined {
  return BY_KEY.get(`${code}|${level}`);
}

// Guard against accidentally shipping a bank that drifts from the standards
// module. Kept out of the public surface; used only by the test, but exported
// so it can be reused if needed.
export function _courseComponentCodes(): string[] {
  return courseComponents().map((c) => c.code);
}

export { isKnownStandard };
