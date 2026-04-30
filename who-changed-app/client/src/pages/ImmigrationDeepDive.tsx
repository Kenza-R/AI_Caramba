import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { analyzeHandle, fetchFigureById, type Figure } from "@/data/mockData";

const IMMIGRATION_KWS = ["immigration", "border", "migrant", "deport", "asylum", "sanctuary", "illegal alien"];

function migrationEvidence(figure: Figure) {
  const ev = figure.evidenceTweets || [];
  return ev
    .map((t) => {
      const txt = String(t.text || "").toLowerCase();
      const hits = IMMIGRATION_KWS.reduce((n, k) => n + (txt.includes(k) ? 1 : 0), 0);
      return { t, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.t.likes - a.t.likes)
    .map((x) => x.t);
}

const ImmigrationDeepDive = () => {
  const { id } = useParams<{ id: string }>();
  const [figure, setFigure] = useState<Figure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        let row = await fetchFigureById(id);
        if (!row) {
          await analyzeHandle(id, () => {});
          row = await fetchFigureById(id);
        }
        if (!cancel) setFigure(row);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const immigrationTopic = useMemo(
    () => figure?.topics.find((t) => t.topic === "Immigration"),
    [figure],
  );
  const evidence = useMemo(() => (figure ? migrationEvidence(figure) : []), [figure]);
  const immigrationShifts = useMemo(
    () => (figure?.shiftEvents || []).filter((s) => s.topic.toLowerCase() === "immigration"),
    [figure],
  );

  if (loading) {
    return <div className="min-h-screen bg-background grid-bg flex items-center justify-center font-mono">LOADING IMMIGRATION DEEP DIVE…</div>;
  }
  if (!figure) {
    return <div className="min-h-screen bg-background grid-bg flex items-center justify-center font-mono">NOT FOUND</div>;
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Navbar />
      <div className="pt-20 pb-16 px-4 md:px-8 max-w-5xl mx-auto">
        <Link to={`/dossier/${figure.id}`} className="font-mono text-xs tracking-widest text-muted-foreground hover:text-primary transition-colors">
          ← RETURN TO DOSSIER
        </Link>

        <section className="mt-6 border border-primary/15 rounded p-4 bg-card/30">
          <p className="font-mono text-[11px] text-primary/80 mb-3">IMMIGRATION TIMELINE</p>
          {immigrationShifts.length ? (
            <div className="space-y-3">
              {immigrationShifts.map((s) => (
                <div key={s.id} className="border border-primary/10 rounded p-3">
                  <p className="font-mono text-[10px] text-muted-foreground/70">{s.date} • {s.direction === "right" ? "+" : "-"}{s.magnitude}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.before}</p>
                  <p className="text-sm text-foreground/90 mt-1">{s.after}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No immigration-specific shift event found yet in this run.</p>
          )}
        </section>

        <section className="mt-8 border-glow rounded-lg p-6 bg-card/30">
          <h1 className="font-display text-3xl text-foreground">Immigration Deep Dive — {figure.name}</h1>
          <p className="font-mono text-xs text-muted-foreground mt-2">{figure.handle}</p>
          <p className="text-sm text-muted-foreground mt-4">
            {immigrationTopic?.stance || "No immigration summary available."}
          </p>
          {immigrationTopic && (
            <p className="text-sm text-muted-foreground mt-3">
              Score moved from <span className="text-foreground">{Number(immigrationTopic.previousScore ?? immigrationTopic.score).toFixed(2)}</span>
              {" "}to{" "}
              <span className="text-foreground">{Number(immigrationTopic.score).toFixed(2)}</span>.
            </p>
          )}
        </section>

        <section className="mt-8 border border-primary/15 rounded p-4 bg-card/30">
          <p className="font-mono text-[11px] text-primary/80 mb-3">IMMIGRATION POSTS</p>
          {evidence.length ? (
            <div className="space-y-3">
              {evidence.map((t) => (
                <article key={t.id} className="border border-primary/10 rounded p-3 bg-card/40">
                  <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground/70">
                    <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Unknown date"}</span>
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">OPEN POST</a>
                    ) : (
                      <span>RT {t.retweets} | Likes {t.likes}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No immigration-related evidence posts were sampled.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default ImmigrationDeepDive;
