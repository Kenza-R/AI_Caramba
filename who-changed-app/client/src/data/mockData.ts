import { apiUrl, explainApiNetworkError } from "@/lib/apiBase";

export interface Figure {
  id: string;
  name: string;
  handle: string;
  bio: string;
  image: string;
  driftScore: number;
  shiftIntensity: "stable" | "moderate" | "significant";
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
  /** False when shown on home from featured seed but no cached analysis yet */
  analysisReady?: boolean;
  corpusTweetCount?: number | null;
  evidenceTweets?: EvidenceTweet[];
}

export interface TopicStance {
  topic: string;
  icon: string;
  stance: string;
  score: number;
  previousScore?: number;
  trend: "right" | "left" | "stable";
}

export interface ShiftEvent {
  id: string;
  date: string;
  topic: string;
  magnitude: number;
  direction: "right" | "left";
  before: string;
  fissure: string;
  after: string;
  news: { headline: string; source: string }[];
  anomalyFlag?: boolean;
  baselineScore?: number;
  currentScore?: number;
  baselinePeriod?: string;
  currentPeriod?: string;
  flaggedTweetText?: string;
  flaggedTweetDate?: string;
  newsNarrative?: string;
  newsQueryUsed?: string;
  newsDateAnchor?: string;
}

export interface EvidenceTweet {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
  url?: string | null;
}

export interface ProfileSearchOption {
  id: string;
  platform: "x" | "truth" | "manual";
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  relevanceScore: number;
}

export interface ScrapeExportResult {
  ok: boolean;
  handle: string;
  tweet_count: number;
  date_range: { start: string | null; end: string | null };
  download_url: string;
  events?: Array<{ stage?: string; message?: string; progress?: number }>;
}

const topicIcon: Record<string, string> = {
  Immigration: "🌍",
  Economy: "📊",
  Climate: "🌡️",
  Healthcare: "🏥",
  "Foreign Policy": "🌐",
  "Social Issues": "⚖️",
  "Media / Free Speech": "📰",
};

const figureCache = new Map<string, Figure>();

function toPercent(score: number): number {
  const s = Number.isFinite(score) ? score : 0;
  return Math.max(0, Math.min(100, ((s + 10) / 20) * 100));
}

function positionLabel(score: number): string {
  if (score <= 20) return "Far Left";
  if (score <= 35) return "Left";
  if (score <= 48) return "Center-Left";
  if (score <= 52) return "Center";
  if (score <= 65) return "Center-Right";
  if (score <= 80) return "Right";
  return "Far Right";
}

function driftLabel(nowPct: number, oldPct: number): string {
  const d = nowPct - oldPct;
  if (d > 4) return "Rightward";
  if (d < -4) return "Leftward";
  return "Stable";
}

function trendFromDelta(delta: number): "right" | "left" | "stable" {
  if (delta > 0.9) return "right";
  if (delta < -0.9) return "left";
  return "stable";
}

function ringToIntensity(ring?: string): Figure["shiftIntensity"] {
  if (ring === "significant") return "significant";
  if (ring === "moderate") return "moderate";
  return "stable";
}

function topicPretty(topic: string): string {
  return topic.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function extractQuotedEvidence(text: string): { tweet?: string; date?: string } {
  const src = String(text || "");
  const q = /Quote:\s*"([^"]+)"/i.exec(src);
  const d = /\((\d{4}-\d{2}-\d{2})\)/.exec(src);
  const fallback = src
    .replace(/^.*?:\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return {
    tweet: q?.[1]?.trim() || (fallback.length >= 32 ? fallback : undefined),
    date: d?.[1] || undefined,
  };
}

function mapDashboardToFigure(d: any): Figure {
  const handle = d?.handle || "unknown";
  const nowScore = Number(d?.spectrum?.current ?? d?.spectrum?.current_estimated ?? 0);
  const oldScore = Number(d?.spectrum?.three_years_ago ?? 0);
  const nowPct = toPercent(nowScore);
  const oldPct = toPercent(oldScore);

  const shifts = Array.isArray(d?.shifts) ? d.shifts : [];
  const biggest = shifts[0];
  const issues = Array.isArray(d?.issues) ? d.issues : [];

  const topics: TopicStance[] = issues.map((it: any) => {
    const topic = String(it.topic || "Issue");
    const score = Number(it.score_current ?? 0);
    const prev = Number(it.score_previous ?? score);
    return {
      topic,
      icon: topicIcon[topic] || "•",
      stance: String(it.current_stance || "No stance summary available."),
      score,
      previousScore: prev,
      trend: trendFromDelta(score - prev),
    };
  });

  const shiftEvents: ShiftEvent[] = shifts.map((s: any, i: number) => {
    const beforeText = String(s.before || s.before_summary || "");
    const afterText = String(s.after || s.after_summary || "");
    const afterEvidence = extractQuotedEvidence(afterText);
    const beforeEvidence = extractQuotedEvidence(beforeText);
    return {
      id: `${handle}-${i}`,
      date: String(s.date_range || s.period_after || "Unknown"),
      topic: topicPretty(String(s.topic || "overall")),
      magnitude: Number(s.magnitude || 0),
      direction: s.direction === "left" ? "left" : "right",
      before: beforeText,
      fissure: String(s.fissure || ""),
      after: afterText,
      news: (s.news?.headlines || []).map((h: any) => ({
        headline: String(h.title || ""),
        source: String(h.source || ""),
      })),
      newsNarrative: s.news?.narrative ? String(s.news.narrative) : undefined,
      newsQueryUsed: s.news?.query_used ? String(s.news.query_used) : undefined,
      newsDateAnchor: s.news?.date_anchor ? String(s.news.date_anchor) : undefined,
      anomalyFlag: Boolean(s.anomaly_flag),
      baselineScore: Number.isFinite(Number(s.scores_before)) ? Number(s.scores_before) : undefined,
      currentScore: Number.isFinite(Number(s.scores_after)) ? Number(s.scores_after) : undefined,
      baselinePeriod: s.period_before ? String(s.period_before) : undefined,
      currentPeriod: s.period_after ? String(s.period_after) : undefined,
      flaggedTweetText: afterEvidence.tweet || beforeEvidence.tweet,
      flaggedTweetDate: afterEvidence.date || beforeEvidence.date,
    };
  });

  const fig: Figure = {
    id: handle,
    name: String(d?.profile?.name || `@${handle}`),
    handle: `@${String(d?.profile?.username || handle)}`,
    bio: String(d?.profile?.description || ""),
    image: String(d?.profile?.profile_image_url || ""),
    driftScore: Number(Math.abs(nowScore - oldScore).toFixed(1)),
    shiftIntensity: ringToIntensity(d?.meta?.shift_stability_ring),
    currentPosition: positionLabel(nowPct),
    driftDirection: driftLabel(nowPct, oldPct),
    biggestShift: topicPretty(String(biggest?.topic || "Overall stance")),
    biggestShiftScore: Number(biggest?.magnitude || 0),
    positionScore2022: oldPct,
    positionScoreNow: nowPct,
    confidencePercent: Math.round(Number(d?.meta?.confidence || 0.5) * 100),
    topics,
    shiftEvents,
    synthesis: String(d?.narrative?.full_summary || "No synthesis available."),
    analysisReady: true,
    corpusTweetCount: d?.meta?.corpus_tweet_count ?? null,
    evidenceTweets: (Array.isArray(d?.sampleTweets) ? d.sampleTweets : []).map((t: any, i: number) => ({
      id: String(t?.id || `evidence-${i}`),
      text: String(t?.text || ""),
      createdAt: String(t?.created_at || ""),
      likes: Number(t?.likes || 0),
      retweets: Number(t?.retweets || 0),
      url: t?.url ? String(t.url) : null,
    })),
  };

  figureCache.set(handle.toLowerCase(), fig);
  return fig;
}

/** Home dashboard: every saved analysis (newest first) plus featured handles still pending. */
export async function fetchFeaturedFigures(): Promise<Figure[]> {
  let r: Response;
  try {
    r = await fetch(apiUrl("/api/figures"));
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (!r.ok) throw new Error("Failed to load dashboard figures");
  const data = await r.json();
  const rows = Array.isArray(data?.figures) ? data.figures : [];
  return rows.map((f: any) => {
    const handle = String(f.handle || "unknown").toLowerCase();
    const ring = ringToIntensity(f.ring);
    const ready = Boolean(f.ready);
    const fig: Figure = {
      id: handle,
      name: String(f.name || `@${handle}`),
      handle: `@${String(f.username || handle)}`,
      bio: String(f.blurb || ""),
      image: String(f.profile_image_url || ""),
      driftScore: ready ? (ring === "significant" ? 7.2 : ring === "moderate" ? 4.1 : 1.3) : 0,
      shiftIntensity: ready ? ring : "stable",
      currentPosition: ready ? "See dossier" : "Queued",
      driftDirection: "Stable",
      biggestShift: ready ? "Open dossier" : "Not analyzed yet",
      biggestShiftScore: ready ? (ring === "significant" ? 6.5 : ring === "moderate" ? 3.8 : 1.2) : 0,
      positionScore2022: 50,
      positionScoreNow: 50,
      confidencePercent: ready ? 55 : 0,
      topics: [],
      shiftEvents: [],
      synthesis: String(f.blurb || ""),
      analysisReady: ready,
      corpusTweetCount: f.corpus_tweet_count ?? null,
      evidenceTweets: [],
    };
    figureCache.set(handle, fig);
    return fig;
  });
}

export async function fetchFigureById(id: string): Promise<Figure | null> {
  const handle = id.replace(/^@/, "").toLowerCase();
  let r: Response;
  try {
    r = await fetch(apiUrl(`/api/figure/${encodeURIComponent(handle)}`));
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (r.status === 404) return null;
  if (r.status === 409) return null;
  if (!r.ok) throw new Error("Failed to load figure dossier");
  const data = await r.json();
  return mapDashboardToFigure(data);
}

export function getFigureById(id: string): Figure | undefined {
  return figureCache.get(id.replace(/^@/, "").toLowerCase());
}

export async function analyzeHandle(
  handle: string,
  onEvent: (ev: any) => void,
): Promise<void> {
  return analyzeSelection(
    {
      id: `manual:${handle.replace(/^@/, "").trim().toLowerCase()}`,
      platform: "manual",
      handle: handle.replace(/^@/, "").trim().toLowerCase(),
      displayName: handle,
      avatarUrl: "",
      bio: "",
      relevanceScore: 1,
    },
    onEvent,
  );
}

export async function searchProfiles(query: string): Promise<ProfileSearchOption[]> {
  const q = String(query || "").trim();
  if (!q) return [];
  let r: Response;
  try {
    r = await fetch(apiUrl(`/api/profile-search?q=${encodeURIComponent(q)}&limit=8`));
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (!r.ok) throw new Error("Failed to search profiles");
  const data = await r.json();
  const rows = Array.isArray(data?.options) ? data.options : [];
  return rows
    .map((x: any) => ({
      id: String(x?.id || ""),
      platform: (x?.platform === "truth" || x?.platform === "manual" ? x.platform : "x") as
        | "x"
        | "truth"
        | "manual",
      handle: String(x?.handle || "").replace(/^@/, "").toLowerCase(),
      displayName: String(x?.displayName || x?.handle || ""),
      avatarUrl: String(x?.avatarUrl || ""),
      bio: String(x?.bio || ""),
      relevanceScore: Number(x?.relevanceScore || 0),
    }))
    .filter((x: ProfileSearchOption) => Boolean(x.handle));
}

export async function analyzeSelection(
  selection: Pick<ProfileSearchOption, "id" | "platform" | "handle">,
  onEvent: (ev: any) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: selection.handle.replace(/^@/, "").trim(),
        selection: {
          id: selection.id,
          platform: selection.platform,
          handle: selection.handle.replace(/^@/, "").trim(),
        },
        allowXCapture: false,
      }),
    });
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (!res.ok || !res.body) {
    const t = await res.text();
    throw new Error(t || "Analyze request failed");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sseError: string | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const block of parts) {
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev?.stage === "error") {
            sseError = String(ev?.message || "Analysis failed.");
          }
          if (ev.dashboard) mapDashboardToFigure(ev.dashboard);
          onEvent(ev);
        } catch {
          // ignore parse failures
        }
      }
    }
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (sseError) {
    throw new Error(sseError);
  }
}

export async function scrapeExportSelection(
  selection: Pick<ProfileSearchOption, "id" | "platform" | "handle">,
): Promise<ScrapeExportResult> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/scrape-export"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: selection.handle.replace(/^@/, "").trim(),
        selection: {
          id: selection.id,
          platform: selection.platform,
          handle: selection.handle.replace(/^@/, "").trim(),
        },
        allowXCapture: false,
        forceRescrape: true,
      }),
    });
  } catch (e) {
    throw new Error(explainApiNetworkError(e));
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Scrape/export request failed");
  }
  return res.json();
}
