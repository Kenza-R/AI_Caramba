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
  demoMode?: boolean;
  corpusTweetCount?: number | null;
  evidenceTweets?: EvidenceTweet[];
}

export interface TopicStance {
  topic: string;
  icon: string;
  stance: string;
  score: number;
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
}

export interface EvidenceTweet {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
  url?: string | null;
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
      trend: trendFromDelta(score - prev),
    };
  });

  const shiftEvents: ShiftEvent[] = shifts.map((s: any, i: number) => ({
    id: `${handle}-${i}`,
    date: String(s.date_range || s.period_after || "Unknown"),
    topic: topicPretty(String(s.topic || "overall")),
    magnitude: Number(s.magnitude || 0),
    direction: s.direction === "left" ? "left" : "right",
    before: String(s.before || s.before_summary || ""),
    fissure: String(s.fissure || ""),
    after: String(s.after || s.after_summary || ""),
    news: (s.news?.headlines || []).map((h: any) => ({
      headline: String(h.title || ""),
      source: String(h.source || ""),
    })),
  }));

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
    demoMode: Boolean(d?.meta?.demo_mode),
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
      demoMode: Boolean(f.demo_mode),
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
  // API is auto-refreshing an old demo snapshot in background.
  // Treat as cache-miss so Dossier can trigger analyze/reload flow.
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
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: handle.replace(/^@/, "").trim() }),
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
}
