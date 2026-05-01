export interface Figure {
  id: string;
  name: string;
  handle: string;
  bio: string;
  image: string;
  driftScore: number;
  shiftIntensity: 'stable' | 'moderate' | 'significant';
  currentPosition: string;
  driftDirection: string;
  biggestShift: string;
  biggestShiftScore: number;
  positionScore2022: number;
  positionScoreNow: number;
  confidencePercent: number;
  topics: TopicStance[];
  shiftEvents: ShiftEvent[];
  synthesis: string;
}

export interface TopicStance {
  topic: string;
  icon: string;
  stance: string;
  score: number;
  trend: 'right' | 'left' | 'stable';
}

export interface ShiftEvent {
  id: string;
  date: string;
  topic: string;
  magnitude: number;
  direction: 'right' | 'left';
  before: string;
  fissure: string;
  after: string;
  news: { headline: string; source: string }[];
}

export const featuredFigures: Figure[] = [
  {
    id: "elon-musk",
    name: "Elon Musk",
    handle: "@elonmusk",
    bio: "CEO of Tesla & SpaceX. Owner of X (formerly Twitter).",
    image: "",
    driftScore: 7.2,
    shiftIntensity: 'significant',
    currentPosition: "Right",
    driftDirection: "Rightward",
    biggestShift: "Media & Free Speech",
    biggestShiftScore: 8.1,
    positionScore2022: 35,
    positionScoreNow: 78,
    confidencePercent: 91,
    topics: [
      { topic: "Immigration", icon: "🌍", stance: "Has shifted from neutral tech-optimist views to strongly advocating for border security and criticizing illegal immigration.", score: 6, trend: 'right' },
      { topic: "Economy", icon: "📊", stance: "Maintains pro-business stance but increasingly critical of government spending, advocating for DOGE-style efficiency.", score: 3, trend: 'right' },
      { topic: "Climate", icon: "🌡️", stance: "Still leads EV revolution but has softened rhetoric on climate urgency and ESG mandates.", score: -2, trend: 'right' },
      { topic: "Healthcare", icon: "🏥", stance: "Limited public statements. Generally favors market-driven innovation.", score: 1, trend: 'stable' },
      { topic: "Foreign Policy", icon: "🌐", stance: "Increasingly vocal on geopolitics, particularly regarding Ukraine, Taiwan, and China relations.", score: 4, trend: 'right' },
      { topic: "Social Issues", icon: "⚖️", stance: "Has become outspoken critic of 'woke culture', DEI policies, and gender-affirming care for minors.", score: 7, trend: 'right' },
      { topic: "Media & Free Speech", icon: "📰", stance: "Acquired Twitter citing free speech absolutism. Has platform-banned then reinstated controversial figures.", score: 8, trend: 'right' },
    ],
    shiftEvents: [
      { id: "em1", date: "Oct 2022", topic: "Media & Free Speech", magnitude: 8.1, direction: 'right', before: "Occasional critic of media bias while running Tesla/SpaceX.", fissure: "Completed $44B acquisition of Twitter, citing free speech concerns. Began mass layoffs and policy changes.", after: "Full owner of major social platform, implementing 'free speech absolutist' policies.", news: [{ headline: "Elon Musk Completes Twitter Acquisition", source: "NYT" }, { headline: "Mass layoffs begin at Twitter", source: "WaPo" }] },
      { id: "em2", date: "Mar 2023", topic: "Social Issues", magnitude: 5.4, direction: 'right', before: "Occasionally posted about cultural issues.", fissure: "Began consistently posting anti-'woke' content, criticizing DEI and transgender policies.", after: "Regular commentator against progressive social policies.", news: [{ headline: "Musk escalates culture war rhetoric", source: "The Atlantic" }] },
      { id: "em3", date: "Jan 2025", topic: "Economy", magnitude: 6.2, direction: 'right', before: "Tech CEO focused on innovation.", fissure: "Appointed to lead Department of Government Efficiency (DOGE) under Trump administration.", after: "Direct participant in federal government restructuring.", news: [{ headline: "Musk's DOGE begins federal cuts", source: "Reuters" }, { headline: "Government efficiency push faces legal challenges", source: "AP" }] },
    ],
    synthesis: "Elon Musk's ideological trajectory over the past three years represents one of the most dramatic public political shifts in modern American discourse. Beginning as a self-described 'moderate' who voted for Obama and supported climate action through Tesla, Musk has undergone a pronounced rightward realignment.\n\nThe acquisition of Twitter in October 2022 served as the primary catalyst, transforming him from a tech CEO who occasionally engaged in political commentary to a central figure in conservative media infrastructure. His platform decisions — from reinstating banned accounts to amplifying right-wing content creators — signaled a clear ideological commitment beyond mere business strategy.\n\nBy 2025, Musk's drift crystallized into direct political participation through the DOGE initiative, marking his transition from cultural commentator to active governance participant. His positions on immigration, social issues, and government efficiency now align consistently with the American right, representing a +7.2 point drift on our composite scale."
  },
  {
    id: "tulsi-gabbard",
    name: "Tulsi Gabbard",
    handle: "@TulsiGabbard",
    bio: "Former Democratic congresswoman, now Director of National Intelligence.",
    image: "",
    driftScore: 8.5,
    shiftIntensity: 'significant',
    currentPosition: "Right",
    driftDirection: "Rightward",
    biggestShift: "Foreign Policy",
    biggestShiftScore: 9.0,
    positionScore2022: 30,
    positionScoreNow: 82,
    confidencePercent: 94,
    topics: [
      { topic: "Immigration", icon: "🌍", stance: "Shifted from moderate Democrat to strong border security advocate.", score: 7, trend: 'right' },
      { topic: "Economy", icon: "📊", stance: "Moved from progressive economic positions to supporting tax cuts and deregulation.", score: 5, trend: 'right' },
      { topic: "Climate", icon: "🌡️", stance: "Previously supported Green New Deal concepts, now skeptical of aggressive climate mandates.", score: -4, trend: 'right' },
      { topic: "Healthcare", icon: "🏥", stance: "Formerly supported Medicare for All, now favors market-based solutions.", score: -6, trend: 'right' },
      { topic: "Foreign Policy", icon: "🌐", stance: "Anti-interventionist stance maintained but now aligned with conservative non-interventionism.", score: 9, trend: 'right' },
      { topic: "Social Issues", icon: "⚖️", stance: "Vocal critic of progressive social policies, particularly on gender and education.", score: 7, trend: 'right' },
      { topic: "Media & Free Speech", icon: "📰", stance: "Regular critic of mainstream media and Big Tech censorship.", score: 6, trend: 'right' },
    ],
    shiftEvents: [
      { id: "tg1", date: "Oct 2022", topic: "Foreign Policy", magnitude: 9.0, direction: 'right', before: "Democratic congresswoman with anti-war stance within the party.", fissure: "Formally left the Democratic Party, calling it an 'elitist cabal of warmongers.'", after: "Independent, then Republican-aligned political figure.", news: [{ headline: "Tulsi Gabbard Leaves Democratic Party", source: "CNN" }] },
      { id: "tg2", date: "Aug 2024", topic: "Social Issues", magnitude: 6.5, direction: 'right', before: "Independent critic of both parties.", fissure: "Endorsed Donald Trump for president and joined his transition team.", after: "Active Republican surrogate and campaign figure.", news: [{ headline: "Gabbard endorses Trump for 2024", source: "Fox News" }] },
    ],
    synthesis: "Tulsi Gabbard's political journey represents a complete party realignment — from 2020 Democratic presidential candidate to Trump-appointed Director of National Intelligence. Her anti-interventionist foreign policy stance, once a left-wing position, became the bridge to her rightward migration as the Democratic Party adopted more hawkish positions on Ukraine and Russia.\n\nHer departure from the Democratic Party in October 2022 was the inflection point, framed not as a rightward shift but as the party 'leaving her.' Subsequent alignment with Trump's campaign and administration solidified her position as one of the most dramatic party-switchers in recent American politics."
  },
  {
    id: "joe-rogan",
    name: "Joe Rogan",
    handle: "@joerogan",
    bio: "Host of The Joe Rogan Experience, the world's largest podcast.",
    image: "",
    driftScore: 4.1,
    shiftIntensity: 'moderate',
    currentPosition: "Center-Right",
    driftDirection: "Rightward",
    biggestShift: "Social Issues",
    biggestShiftScore: 5.5,
    positionScore2022: 45,
    positionScoreNow: 62,
    confidencePercent: 78,
    topics: [
      { topic: "Immigration", icon: "🌍", stance: "Increasingly critical of open border policies, frequently hosts restrictionist voices.", score: 3, trend: 'right' },
      { topic: "Economy", icon: "📊", stance: "Libertarian-leaning, skeptical of both corporate and government overreach.", score: 2, trend: 'stable' },
      { topic: "Climate", icon: "🌡️", stance: "Skeptical of climate alarmism while acknowledging environmental issues exist.", score: -1, trend: 'right' },
      { topic: "Healthcare", icon: "🏥", stance: "Became a flashpoint for vaccine skepticism during COVID. Advocates personal choice.", score: -3, trend: 'right' },
      { topic: "Foreign Policy", icon: "🌐", stance: "Generally non-interventionist. Skeptical of military-industrial complex.", score: 1, trend: 'stable' },
      { topic: "Social Issues", icon: "⚖️", stance: "Vocal critic of trans athletes in women's sports. Increasingly critical of progressive culture.", score: 5, trend: 'right' },
      { topic: "Media & Free Speech", icon: "📰", stance: "Strong free speech advocate. Moved podcast to Spotify citing editorial freedom.", score: 4, trend: 'right' },
    ],
    shiftEvents: [
      { id: "jr1", date: "Jan 2023", topic: "Social Issues", magnitude: 5.5, direction: 'right', before: "Broadly libertarian, 'socially liberal' self-description.", fissure: "Increased frequency of episodes featuring right-wing cultural commentators. Began explicitly criticizing 'woke ideology.'", after: "Regularly platforms conservative voices on cultural issues.", news: [{ headline: "Rogan's podcast shifts rightward", source: "The Atlantic" }] },
      { id: "jr2", date: "Oct 2024", topic: "Media & Free Speech", magnitude: 4.2, direction: 'right', before: "Said he'd 'probably vote Democrat' in some elections.", fissure: "Endorsed Donald Trump on his podcast, citing concerns about free speech and government overreach.", after: "Publicly aligned with Republican candidate for first time.", news: [{ headline: "Joe Rogan endorses Trump", source: "BBC" }] },
    ],
    synthesis: "Joe Rogan's drift is more subtle than a party switch — it's a cultural realignment. Still identifying as a 'liberal on many issues,' his platform has become increasingly aligned with right-of-center positions on social and cultural matters.\n\nThe COVID era served as an accelerant, with his vaccine skepticism and opposition to mandates placing him firmly against the progressive mainstream. His 2024 Trump endorsement, while surprising to some, was the culmination of a gradual shift that his long-time listeners had observed over several years."
  },
  {
    id: "rfk-jr",
    name: "Robert F. Kennedy Jr.",
    handle: "@RobertKennedyJr",
    bio: "Former independent presidential candidate. Secretary of Health and Human Services.",
    image: "",
    driftScore: 6.8,
    shiftIntensity: 'significant',
    currentPosition: "Right",
    driftDirection: "Rightward",
    biggestShift: "Healthcare",
    biggestShiftScore: 7.5,
    positionScore2022: 32,
    positionScoreNow: 70,
    confidencePercent: 85,
    topics: [
      { topic: "Immigration", icon: "🌍", stance: "Adopted border security messaging after initially moderate stance.", score: 4, trend: 'right' },
      { topic: "Economy", icon: "📊", stance: "Mix of populist economics — anti-corporate but also anti-regulation.", score: 2, trend: 'stable' },
      { topic: "Climate", icon: "🌡️", stance: "Environmental lawyer background, but has deprioritized climate advocacy.", score: -3, trend: 'right' },
      { topic: "Healthcare", icon: "🏥", stance: "Leading voice against vaccine mandates and FDA/pharmaceutical establishment.", score: 8, trend: 'right' },
      { topic: "Foreign Policy", icon: "🌐", stance: "Anti-interventionist, critical of Ukraine aid.", score: 3, trend: 'right' },
      { topic: "Social Issues", icon: "⚖️", stance: "Kennedy family legacy meets MAGA coalition — complex positioning.", score: 4, trend: 'right' },
      { topic: "Media & Free Speech", icon: "📰", stance: "Frames anti-vax stance as censorship issue. Critical of media establishment.", score: 5, trend: 'right' },
    ],
    shiftEvents: [
      { id: "rk1", date: "Apr 2023", topic: "Healthcare", magnitude: 7.5, direction: 'right', before: "Environmental activist and vaccine skeptic within Democratic circles.", fissure: "Launched independent presidential campaign centered on anti-establishment healthcare positions.", after: "Full-time political candidate breaking from Democratic Party.", news: [{ headline: "RFK Jr. announces presidential bid", source: "NYT" }] },
      { id: "rk2", date: "Aug 2024", topic: "Foreign Policy", magnitude: 5.8, direction: 'right', before: "Independent candidate drawing from both left and right.", fissure: "Suspended campaign and endorsed Donald Trump.", after: "Appointed as HHS Secretary in Trump administration.", news: [{ headline: "RFK Jr. endorses Trump, suspends campaign", source: "AP" }, { headline: "Kennedy nominated for HHS Secretary", source: "Reuters" }] },
    ],
    synthesis: "Robert F. Kennedy Jr.'s political journey is a study in how single-issue advocacy can reshape entire ideological identities. His anti-vaccine activism, once a fringe position within the Democratic coalition, became the vector through which he departed the liberal establishment entirely.\n\nThe Kennedy name — synonymous with Democratic royalty — made his rightward shift all the more dramatic. By accepting a cabinet position in the Trump administration, RFK Jr. completed a transformation from environmental lawyer and Democratic scion to a central figure in the populist right's healthcare narrative."
  },
];

export const getFigureById = (id: string): Figure | undefined =>
  featuredFigures.find(f => f.id === id);
