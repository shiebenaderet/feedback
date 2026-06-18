// Washington Social Studies Learning Standards (2019), Grades 6–8.
// Source: OSPI strand documents (Civics, Economics, Geography, History, SS Skills)
// + OSPI Recommended Scope & Sequence (2020).
//
// grade: '6' = World (end of 6th), '7' = WA State (end of 7th),
//        '8' = U.S. History (end of 8th), 'all' = Skills strand (all grades 6–8).
//
// This is reference data for tagging feedback to curriculum standards. Mr. B's
// course is Grade 8 / U.S. History, so `grade: '8'` and the `'all'` Skills
// components are the ones that map to this classroom (see COURSE_GRADE).

export type Strand = 'civics' | 'economics' | 'geography' | 'history' | 'skills';
export type StandardGrade = '6' | '7' | '8' | 'all';

/** The grade band this app's course teaches (used for default filtering). */
export const COURSE_GRADE: StandardGrade = '8';

export interface StandardComponent {
  /** e.g. "C1.6-8.3" */
  code: string;
  grade: StandardGrade;
  text: string;
  /** Optional sub-bullets (e.g. era lists). */
  sub?: string[];
}

export interface Standard {
  /** Short strand code, e.g. "C1", "SSS4". */
  code: string;
  strand: Strand;
  title: string;
  components: StandardComponent[];
}

export const STANDARDS: Standard[] = [
  /* ===================== CIVICS ===================== */
  {
    code: 'C1',
    strand: 'civics',
    title:
      'Understands key ideals and principles of the United States, including those in the Declaration of Independence, Constitution, and other foundational documents.',
    components: [
      { code: 'C1.6-8.1', grade: '6', text: 'Explain how early works such as the Code of Justinian or the Magna Carta contributed to foundational documents of the United States.' },
      { code: 'C1.6-8.2', grade: '7', text: 'Explain the structure of and key ideals set forth in fundamental documents, including the Washington state constitution and tribal treaties with the United States government.' },
      { code: 'C1.6-8.3', grade: '8', text: 'Explain key ideals and principles outlined in the Declaration of Independence, including life, liberty, and the pursuit of happiness; the U.S. Constitution, including the rule of law, separation of powers, representative government, and popular sovereignty; and, the Bill of Rights, including due process and freedom of expression.' },
      { code: 'C1.6-8.4', grade: '8', text: 'Evaluate efforts to reduce discrepancies between key ideals and reality in the United States.' },
    ],
  },
  {
    code: 'C2',
    strand: 'civics',
    title: 'Understands the purposes, organization, and function of governments, laws, and political systems.',
    components: [
      { code: 'C2.6-8.1', grade: '6', text: 'Explain a variety of forms of government from the past or present.' },
      { code: 'C2.6-8.2', grade: '7', text: 'Distinguish the structure, organization, powers, and limits of government at the local, state, and tribal levels.' },
      { code: 'C2.6-8.3', grade: '8', text: 'Analyze the structure and powers of government at the national level.' },
      { code: 'C2.6-8.4', grade: '8', text: 'Use knowledge of the function of government to analyze and address a political issue.' },
      { code: 'C2.6-8.5', grade: '8', text: 'Evaluate the effectiveness of the system of checks and balances in the United States based on an event.' },
      { code: 'C2.6-8.6', grade: '8', text: 'Demonstrate that the U.S. government includes concepts of both a democracy and a republic.' },
    ],
  },
  {
    code: 'C3',
    strand: 'civics',
    title: 'Understands the purposes and organization of tribal and international relationships and U.S. foreign policy.',
    components: [
      { code: 'C3.6-8.1', grade: '6', text: 'Analyze how societies have interacted with one another.' },
      { code: 'C3.6-8.2', grade: '7', text: 'Analyze how international agreements have affected Washington state.' },
      { code: 'C3.6-8.3', grade: '7', text: 'Recognize that, according to the United States Constitution, treaties are “the supreme law of the land;” consequently, treaty rights supersede most state laws.' },
      { code: 'C3.6-8.4', grade: '7', text: 'Explain elements of the agreements contained in one or more treaty agreements between Washington tribes and the United States.' },
      { code: 'C3.6-8.5', grade: '8', text: 'Identify early examples of foreign policy between the United States and other nations.' },
      { code: 'C3.6-8.6', grade: '8', text: 'Analyze how the United States has interacted with other countries.' },
    ],
  },
  {
    code: 'C4',
    strand: 'civics',
    title: 'Understands civic involvement.',
    components: [
      { code: 'C4.6-8.1', grade: '6', text: 'Describe the historical origins of civic involvement.' },
      { code: 'C4.6-8.2', grade: '7', text: 'Describe the relationship between the actions of people in Washington state and the ideals outlined in the Washington state constitution.' },
      { code: 'C4.6-8.3', grade: '7', text: 'Employ strategies for civic involvement that address a state or local issue.' },
      { code: 'C4.6-8.4', grade: '8', text: 'Analyze how a claim on an issue attempts to balance individual rights and the common good.' },
      { code: 'C4.6-8.5', grade: '8', text: 'Employ strategies for civic involvement that address a national issue.' },
    ],
  },
  /* ===================== ECONOMICS ===================== */
  {
    code: 'E1',
    strand: 'economics',
    title: 'Understands that people have to make choices between wants and needs and evaluates the outcomes of those choices.',
    components: [
      { code: 'E1.6-8.1', grade: '6', text: 'Analyze the costs and benefits of economic choices made by groups and individuals in the past or present.' },
      { code: 'E1.6-8.2', grade: '7', text: 'Evaluate alternative approaches or solutions to current economic issues of Washington state in terms of costs and benefits for different groups.' },
      { code: 'E1.6-8.3', grade: '8', text: 'Analyze examples of how groups and individuals have considered profit and personal values in making economic choices in the past or present.' },
    ],
  },
  {
    code: 'E2',
    strand: 'economics',
    title: 'Understands how economic systems function.',
    components: [
      { code: 'E2.6-8.1', grade: '6', text: 'Describe the production, distribution, and consumption of goods, services, and resources in societies from the past or in the present.' },
      { code: 'E2.6-8.2', grade: '6', text: 'Explain how scarce resources have affected international trade in the past or present.' },
      { code: 'E2.6-8.3', grade: '7', text: 'Analyze the production, distribution, and consumption of goods, services, and resources in societies from the past or in the present.' },
      { code: 'E2.6-8.4', grade: '7', text: 'Analyze how the forces of supply and demand have affected international trade in Washington state in the past or present.' },
      { code: 'E2.6-8.5', grade: '8', text: 'Analyze how the forces of supply and demand have affected the production, distribution, and consumption of goods, services, and resources in the United States in the past or present.' },
      { code: 'E2.6-8.6', grade: '8', text: 'Analyze how the forces of supply and demand have affected international trade in the United States in the past or present.' },
    ],
  },
  {
    code: 'E3',
    strand: 'economics',
    title: 'Understands the government’s role in the economy.',
    components: [
      { code: 'E3.6-8.1', grade: '6', text: 'Explain the role of government in the world’s economies through the creation of money, taxation, and spending in the past or present.' },
      { code: 'E3.6-8.2', grade: '7', text: 'Analyze the role of government in the economy of Washington state through taxation, spending, and policy setting in the past or present.' },
      { code: 'E3.6-8.3', grade: '8', text: 'Analyze the influence of the U.S. government’s taxation, creation of currency, and tariffs in the past or present.' },
    ],
  },
  {
    code: 'E4',
    strand: 'economics',
    title: 'Understands the economic issues and problems that all societies face.',
    components: [
      { code: 'E4.6-8.1', grade: '6', text: 'Explain the distribution of wealth and sustainability of resources in the world.' },
      { code: 'E4.6-8.2', grade: '6', text: 'Explain barriers to trade and how those barriers influence trade among nations.' },
      { code: 'E4.6-8.3', grade: '7', text: 'Analyze the distribution of wealth and sustainability of resources in Washington state.' },
      { code: 'E4.6-8.4', grade: '7', text: 'Explain the costs and benefits of trade policies to individuals, businesses, and society in Washington state.' },
      { code: 'E4.6-8.5', grade: '8', text: 'Analyze the distribution of wealth and sustainability of resources in the United States.' },
      { code: 'E4.6-8.6', grade: '8', text: 'Explain the costs and benefits of trade policies to individuals, businesses, and society in the United States.' },
    ],
  },
  /* ===================== GEOGRAPHY ===================== */
  {
    code: 'G1',
    strand: 'geography',
    title: 'Understands the physical characteristics, cultural characteristics, and location of places, regions, and spatial patterns on the Earth’s surface.',
    components: [
      { code: 'G1.6-8.1', grade: '6', text: 'Construct and analyze maps using scale, direction, symbols, legends, and projections to gather information.' },
      { code: 'G1.6-8.2', grade: '6', text: 'Identify the location of places and regions in the world and understand their physical and cultural characteristics.' },
      { code: 'G1.6-8.3', grade: '7', text: 'Analyze maps and charts from a specific time period to understand an issue or event.' },
      { code: 'G1.6-8.4', grade: '7', text: 'Explain how human spatial patterns have emerged from natural processes and human activities.' },
      { code: 'G1.6-8.5', grade: '8', text: 'Explain and analyze physical and cultural characteristics of places and regions in the United States.' },
      { code: 'G1.6-8.6', grade: '8', text: 'Use maps, satellite images, photographs, and other representations to explain relationships between the locations of places and regions and their political, cultural, and economic dynamics.' },
    ],
  },
  {
    code: 'G2',
    strand: 'geography',
    title: 'Understands human interaction with the environment.',
    components: [
      { code: 'G2.6-8.1', grade: '6', text: 'Explain and analyze how the environment has affected people and how people have affected the environment in world history.' },
      { code: 'G2.6-8.2', grade: '6', text: 'Explain the geographic factors that influence the movement of groups of people in world history.' },
      { code: 'G2.6-8.3', grade: '7', text: 'Explain and analyze how the environment has affected people and how human actions modify the physical environment, and in turn, how the physical environment limits or promotes human activities in Washington state in the past or present.' },
      { code: 'G2.6-8.4', grade: '7', text: 'Explain the role of immigration in shaping societies in the past or present.' },
      { code: 'G2.6-8.5', grade: '7', text: 'Explain examples of cultural diffusion in the world from the past or present.' },
      { code: 'G2.6-8.6', grade: '8', text: 'Analyze how the environment has affected people and how people have affected the environment in the United States in the past or present.' },
      { code: 'G2.6-8.7', grade: '8', text: 'Explain cultural diffusion in the United States from the past or in the present.' },
      { code: 'G2.6-8.8', grade: '8', text: 'Explain and analyze migration as a catalyst for the growth of the United States in the past or present.' },
    ],
  },
  {
    code: 'G3',
    strand: 'geography',
    title: 'Understands the geographic context of global issues and events.',
    components: [
      { code: 'G3.6-8.1', grade: '6', text: 'Explain how learning about the geography of the world helps us understand global issues such as diversity, sustainability, and trade.' },
      { code: 'G3.6-8.2', grade: '7', text: 'Explain how learning about the geography of Washington state helps us understand global issues such as diversity, sustainability, and trade.' },
      { code: 'G3.6-8.3', grade: '8', text: 'Explain how learning about the geography of the United States helps us understand global issues such as diversity, trade, and sustainability.' },
    ],
  },
  /* ===================== HISTORY ===================== */
  {
    code: 'H1',
    strand: 'history',
    title: 'Understands historical chronology.',
    components: [
      { code: 'H1.6-8.1', grade: '6', text: 'Analyze different cultural measurements of time.' },
      { code: 'H1.6-8.2', grade: '6', text: 'Explain how the rise of civilizations defines eras in world history in two or more regions of the world.' },
      { code: 'H1.6-8.3', grade: '6', text: 'Explain how the rise of civilizations defines two or more eras, such as:', sub: ['8,000 BCE to 500 BCE', '500 BCE to 500 CE', '500 CE to 1600 CE'] },
      { code: 'H1.6-8.4', grade: '7', text: 'Analyze a major historical event and how it is represented on timelines from different cultural perspectives, including those of indigenous people.' },
      { code: 'H1.6-8.5', grade: '7', text: 'Explain how themes and developments have defined eras in Washington state history from 1854 to the present:', sub: ['Territory and treaty-making (1854-1889)', 'Railroads, reform, immigration, and labor (1889-1930)', 'Turmoil and triumph (1930-1974)', 'New technologies and industries in contemporary Washington (1975-present)'] },
      { code: 'H1.6-8.6', grade: '8', text: 'Explain how themes and developments help to define eras in United States history from 1763 to 1877, including:', sub: ['Fighting for independence (1763-1783)', 'Establishing the new nation (1781-1815)', 'Slavery, expansion, removal, and reform (1801-1850)', 'Civil War and Reconstruction (1850-1877)'] },
    ],
  },
  {
    code: 'H2',
    strand: 'history',
    title: 'Understands and analyzes causal factors that have shaped major events in history.',
    components: [
      { code: 'H2.6-8.1', grade: '6', text: 'Explain and analyze how individuals, movements, cultural and ethnic groups, and technology from past civilizations have shaped world history.' },
      { code: 'H2.6-8.2', grade: '7', text: 'Explain and analyze how individuals and movements have shaped Washington state history since statehood.' },
      { code: 'H2.6-8.3', grade: '7', text: 'Explain and analyze how cultures and ethnic groups contributed to Washington state history since statehood.' },
      { code: 'H2.6-8.4', grade: '7', text: 'Explain and analyze how technology and ideas have impacted Washington state history since statehood.' },
      { code: 'H2.6-8.5', grade: '8', text: 'Explain and analyze how individuals and movements have shaped United States history (1763-1877).' },
      { code: 'H2.6-8.6', grade: '8', text: 'Explain and analyze how cultures and cultural and ethnic groups have contributed to United States history (1763-1877).' },
      { code: 'H2.6-8.7', grade: '8', text: 'Explain and analyze how technology and ideas have impacted United States history (1763-1877).' },
    ],
  },
  {
    code: 'H3',
    strand: 'history',
    title: 'Understands that there are multiple perspectives and interpretations of historical events.',
    components: [
      { code: 'H3.6-8.1', grade: '6', text: 'Analyze and interpret historical materials from a variety of perspectives in world history.' },
      { code: 'H3.6-8.2', grade: '6', text: 'Analyze multiple causal factors to create and support a claim about major events in world history.' },
      { code: 'H3.6-8.3', grade: '7', text: 'Explain, analyze, and develop an argument about how Washington state has been impacted by:', sub: ['Individuals and movements.', 'Cultures and cultural groups.', 'Technology and ideas.'] },
      { code: 'H3.6-8.4', grade: '8', text: 'Analyze and interpret historical materials from a variety of perspectives in United States history (1763-1877).' },
      { code: 'H3.6-8.5', grade: '8', text: 'Analyze multiple causal factors to create positions on major events in United States history (1763-1877).' },
    ],
  },
  {
    code: 'H4',
    strand: 'history',
    title: 'Understands how historical events inform analysis of contemporary issues and events.',
    components: [
      { code: 'H4.6-8.1', grade: '6', text: 'Analyze how a historical event in world history helps us to understand contemporary issues and events.' },
      { code: 'H4.6-8.2', grade: '7', text: 'Analyze how a historical event in Washington state history helps us to understand contemporary issues and events.' },
      { code: 'H4.6-8.3', grade: '8', text: 'Analyze how a historical event in United States history helps us to understand contemporary issues and events.' },
    ],
  },
  /* ===================== SOCIAL STUDIES SKILLS (all grades 6–8) ===================== */
  {
    code: 'SSS1',
    strand: 'skills',
    title: 'Uses critical reasoning skills to analyze and evaluate claims.',
    components: [
      { code: 'SSS1.6-8.1', grade: 'all', text: 'Analyze positions and evidence supporting an issue or an event.' },
      { code: 'SSS1.6-8.2', grade: 'all', text: 'Evaluate the logic of reasons for a position on an issue or event.' },
    ],
  },
  {
    code: 'SSS2',
    strand: 'skills',
    title: 'Uses inquiry-based research.',
    components: [
      { code: 'SSS2.6-8.1', grade: 'all', text: 'Create and use research questions to guide inquiry on an issue or event.' },
      { code: 'SSS2.6-8.2', grade: 'all', text: 'Evaluate the breadth, reliability, and credibility of primary and secondary sources to determine the need for new or additional information when researching an issue or event.' },
    ],
  },
  {
    code: 'SSS3',
    strand: 'skills',
    title: 'Deliberates public issues.',
    components: [
      { code: 'SSS3.6-8.1', grade: 'all', text: 'Engage in discussion, analyzing multiple viewpoints on public issues.' },
    ],
  },
  {
    code: 'SSS4',
    strand: 'skills',
    title: 'Creates a product that uses social studies content to support a thesis, and presents the product in an appropriate manner to a meaningful audience.',
    components: [
      { code: 'SSS4.6-8.1', grade: 'all', text: 'Analyze multiple factors, make generalizations, and interpret sources to formulate a thesis in a paper or presentation, while observing rules related to plagiarism and copyright.' },
      { code: 'SSS4.6-8.2', grade: 'all', text: 'Use appropriate format to cite sources within an essay, presentation, and reference page.' },
    ],
  },
];

// ── Lookups ────────────────────────────────────────────────────────────────

const STANDARD_BY_CODE = new Map(STANDARDS.map((s) => [s.code, s]));
const COMPONENT_BY_CODE = new Map<string, StandardComponent>();
for (const s of STANDARDS) for (const c of s.components) COMPONENT_BY_CODE.set(c.code, c);

/** The parent Standard for a strand code (e.g. "C1") or a component code (e.g. "C1.6-8.3"). */
export function standardByCode(code: string): Standard | undefined {
  if (STANDARD_BY_CODE.has(code)) return STANDARD_BY_CODE.get(code);
  // Component code → strand prefix before the first dot.
  const strandCode = code.split('.')[0];
  return STANDARD_BY_CODE.get(strandCode);
}

/** A single component by its full code (e.g. "SSS4.6-8.1"). */
export function componentByCode(code: string): StandardComponent | undefined {
  return COMPONENT_BY_CODE.get(code);
}

/** All standards in a strand. */
export function standardsByStrand(strand: Strand): Standard[] {
  return STANDARDS.filter((s) => s.strand === strand);
}

/** Every component, flattened, optionally limited to a grade ('all' always included). */
export function components(grade?: StandardGrade): StandardComponent[] {
  const all = STANDARDS.flatMap((s) => s.components);
  if (!grade) return all;
  return all.filter((c) => c.grade === grade || c.grade === 'all');
}

/** Components that map to this app's course (Grade 8 + the all-grades Skills strand). */
export function courseComponents(): StandardComponent[] {
  return components(COURSE_GRADE);
}

/** A short human label for a standard/component code, e.g. "C1.6-8.3 — Explain key ideals…". */
export function labelForCode(code: string, maxLen = 80): string {
  const comp = componentByCode(code);
  const std = standardByCode(code);
  const text = comp?.text ?? std?.title ?? '';
  const trimmed = text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text;
  return trimmed ? `${code} — ${trimmed}` : code;
}

/** True when `code` is a known strand or component code. */
export function isKnownStandard(code: string): boolean {
  return STANDARD_BY_CODE.has(code) || COMPONENT_BY_CODE.has(code);
}
