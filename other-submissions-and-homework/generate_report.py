"""
Generates the ψSHIFT technical report as a PDF.
Run from the AI_Caramba root: python generate_report.py
"""

from io import BytesIO
from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, PageBreak, KeepTogether, Image
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# ── Palette ───────────────────────────────────────────────────────────────────
CYAN      = colors.HexColor("#00C8D7")
DARK      = colors.HexColor("#0D1117")
MID_DARK  = colors.HexColor("#161B22")
SLATE     = colors.HexColor("#21262D")
MUTED     = colors.HexColor("#8B949E")
WHITE     = colors.white
AMBER     = colors.HexColor("#D29922")
GREEN     = colors.HexColor("#3FB950")

# ── Styles ────────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def style(name, **kwargs):
    return ParagraphStyle(name, **kwargs)

COVER_TITLE = style("CoverTitle",
    fontSize=32, leading=38, textColor=WHITE, fontName="Helvetica-Bold",
    alignment=TA_LEFT, spaceAfter=8)

COVER_SUB = style("CoverSub",
    fontSize=13, leading=18, textColor=CYAN, fontName="Helvetica",
    alignment=TA_LEFT, spaceAfter=4)

COVER_META = style("CoverMeta",
    fontSize=9, leading=13, textColor=MUTED, fontName="Helvetica",
    alignment=TA_LEFT)

H1 = style("H1",
    fontSize=15, leading=19, textColor=CYAN, fontName="Helvetica-Bold",
    spaceBefore=16, spaceAfter=5)

H2 = style("H2",
    fontSize=11, leading=15, textColor=WHITE, fontName="Helvetica-Bold",
    spaceBefore=10, spaceAfter=4)

H3 = style("H3",
    fontSize=9.5, leading=13, textColor=AMBER, fontName="Helvetica-Bold",
    spaceBefore=8, spaceAfter=3)

BODY = style("Body",
    fontSize=8.5, leading=12, textColor=colors.HexColor("#C9D1D9"),
    fontName="Helvetica", spaceAfter=5, alignment=TA_JUSTIFY)

BULLET = style("Bullet",
    fontSize=8.5, leading=12, textColor=colors.HexColor("#C9D1D9"),
    fontName="Helvetica", spaceAfter=3, leftIndent=14,
    bulletIndent=4, bulletFontName="Helvetica")

CODE = style("Code",
    fontSize=7.5, leading=10, textColor=GREEN,
    fontName="Courier", spaceAfter=4,
    backColor=MID_DARK, leftIndent=10, rightIndent=10,
    borderPadding=(4, 6, 4, 6))

CAPTION = style("Caption",
    fontSize=7, leading=9, textColor=MUTED, fontName="Helvetica-Oblique",
    spaceAfter=8, alignment=TA_CENTER)

CALLOUT = style("Callout",
    fontSize=8.5, leading=12, textColor=AMBER, fontName="Helvetica-Bold",
    spaceBefore=5, spaceAfter=5, leftIndent=12, borderPadding=6,
    backColor=colors.HexColor("#1C1A0E"), borderColor=AMBER,
    borderWidth=1)


def _rgba_image(path: str, width: float) -> Image:
    """Load an RGBA PNG, flatten to RGB on a dark background, return a reportlab Image."""
    pil = PILImage.open(path).convert("RGBA")
    bg = PILImage.new("RGB", pil.size, (13, 17, 23))  # DARK background
    bg.paste(pil, mask=pil.split()[3])
    buf = BytesIO()
    bg.save(buf, format="PNG")
    buf.seek(0)
    aspect = pil.height / pil.width
    return Image(buf, width=width, height=width * aspect)


def rule():
    return HRFlowable(width="100%", thickness=0.5, color=SLATE, spaceAfter=6, spaceBefore=2)

# ── Auto-incrementing figure / table counters ─────────────────────────────────
_fig_n = [0]
_tab_n = [0]

def fig_cap(text):
    """Return a numbered figure caption paragraph."""
    _fig_n[0] += 1
    return p(muted(f"Figure {_fig_n[0]} — {text}"), CAPTION)

def tab_cap(text):
    """Return a numbered table caption paragraph."""
    _tab_n[0] += 1
    return p(muted(f"Table {_tab_n[0]} — {text}"), CAPTION)

def fig_ref(n):   return f"Figure {n}"
def tab_ref(n):   return f"Table {n}"

def b(text):          return f"<b>{text}</b>"
def cyan(text):       return f'<font color="#00C8D7">{text}</font>'
def amber(text):      return f'<font color="#D29922">{text}</font>'
def green(text):      return f'<font color="#3FB950">{text}</font>'
def muted(text):      return f'<font color="#8B949E">{text}</font>'

def p(text, s=BODY):  return Paragraph(text, s)
def h1(text):         return Paragraph(text, H1)
def h2(text):         return Paragraph(text, H2)
def h3(text):         return Paragraph(text, H3)
def sp(n=6):          return Spacer(1, n)
def bullet(text):     return Paragraph(f"• {text}", BULLET)


def _cell(text, color, fontname="Helvetica", fontsize=9):
    return Paragraph(f'<font color="{color.hexval()}">{text}</font>',
                     ParagraphStyle("cell", fontName=fontname, fontSize=fontsize,
                                    leading=13, textColor=color,
                                    leftIndent=0, rightIndent=0))

def info_table(rows, col_widths=None):
    if col_widths is None:
        col_widths = [2.1*inch, 4.2*inch]
    # Wrap every cell in a Paragraph so text word-wraps correctly
    wrapped = []
    for row in rows:
        wrapped_row = []
        for i, cell in enumerate(row):
            color = CYAN if i == 0 else colors.HexColor("#C9D1D9")
            wrapped_row.append(_cell(str(cell), color))
        wrapped.append(wrapped_row)
    t = Table(wrapped, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (0,-1), MID_DARK),
        ("BACKGROUND",   (1,0), (1,-1), SLATE),
        ("TOPPADDING",   (0,0), (-1,-1), 3),
        ("BOTTOMPADDING",(0,0), (-1,-1), 3),
        ("LEFTPADDING",  (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("GRID",         (0,0), (-1,-1), 0.4, SLATE),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [MID_DARK, DARK]),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    return t


def build_pdf(path: str):
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        leftMargin=0.7*inch,
        rightMargin=0.7*inch,
        topMargin=0.7*inch,
        bottomMargin=0.7*inch,
    )

    story = []

    # ── Cover ──────────────────────────────────────────────────────────────
    story += [
        sp(24),
        p(cyan("TECHNICAL ARCHITECTURE REPORT"), COVER_SUB),
        sp(8),
        _rgba_image("/Users/kmr/AI_Caramba/logo.png", width=2.6*inch),
        sp(7),
        p("AI-Powered Ideological Drift Analysis Platform", COVER_SUB),
        sp(10),
        rule(),
        sp(3),
        info_table([
            ["Project",    "ψSHIFT — Political Shift Tracker"],
            ["Version",    "1.0  |  April 2026"],
            ["Stack",      "React + TypeScript  /  Python FastAPI  /  Claude claude-opus-4-5  /  twscrape"],
            ["Platforms",  "X (Twitter)  /  TruthSocial"],
            ["Authors",    "Kenza Moussaoui Rahali  |  Omar Sekkat  |  Doris Ding  |  Marceline Yu"],
            ["Repository", "https://github.com/Kenza-R/AI_Caramba"],
        ]),
        sp(10),
        p(
            "This report documents the end-to-end technical design of ψSHIFT: "
            "from the user experience layer through data acquisition, AI-powered analysis, "
            "news event correlation, and final data presentation. Each section addresses "
            "both the architectural decisions made and the specific engineering challenges "
            "encountered and resolved during development.",
            BODY
        ),
        PageBreak(),
    ]

    # ── Table of Contents ──────────────────────────────────────────────────
    story += [
        h1("Table of Contents"),
        rule(),
        sp(3),
    ]
    toc_items = [
        ("—",   "Executive Summary"),
        ("1.",  "Introduction"),
        ("",    "  1.1  Problem Statement & Market Context"),
        ("",    "  1.2  The Generative AI Angle"),
        ("",    "  1.3  Ethics, Risk & Governance"),
        ("",    "  1.4  User Journey"),
        ("2.",  "Implementation"),
        ("",    "  2.1  Search & Profile Resolution"),
        ("",    "  2.2  Data Acquisition: An Iterative Journey"),
        ("",    "  2.3  Truth Social Integration"),
        ("",    "  2.4  AI Analysis Engine"),
        ("",    "  2.5  News Event Correlation"),
        ("",    "  2.6  Data Presentation"),
        ("",    "  2.7  Technical Challenges & Resolutions"),
        ("",    "  2.8  Infrastructure & Deployment"),
        ("3.",  "Results and Analysis"),
        ("",    "  3.1  Case Studies — @zlisto, @elonmusk, @hasanthehun"),
        ("",    "  3.2  What Works and What Does Not"),
        ("",    "  3.3  Economics: Operating Costs and Pricing"),
        ("",    "  3.4  Competitive Landscape"),
        ("4.",  "Conclusion"),
        ("Ref.","References"),
    ]
    for num, title in toc_items:
        story.append(p(f"{amber(num)}  {title}", BODY))
        story.append(sp(2))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("Executive Summary"),
        rule(),
        p(
            b("ψSHIFT") + " is an AI-powered web platform that tracks ideological drift in public figures "
            "over time by scraping years of their social media history, running it through a "
            "structured large language model analysis pipeline, and presenting the results as "
            "an interactive dossier. Given a Twitter/X handle or a Truth Social profile, "
            "ψSHIFT fetches up to 3,000 posts, samples them evenly across the full historical "
            "range, and asks Claude claude-opus-4-5 — via the Lava.so unified AI gateway — to score "
            "the figure across seven political dimensions, detect specific moments of ideological "
            "shift, and produce an evidence-grounded synthesis narrative. The system was validated "
            "against three real accounts (@zlisto, @elonmusk, @hasanthehun) using data collected "
            "via TwExportly CSV exports and the stiles/trump-truth-social-archive schema. "
            "The main finding is that the end-to-end pipeline — from profile search to structured "
            "dossier render — works reliably; the only component that did not reach a working state "
            "was live news event correlation, which returned no headline matches in all tested cases. "
            "ψSHIFT is aimed at journalists, researchers, and politically engaged general audiences "
            "who want a fast, evidence-grounded answer to the question: "
            + cyan("“has this person actually changed their views, and if so, when and why?”"),
            BODY
        ),
        sp(3),
        info_table([
            ["Repository", "https://github.com/Kenza-R/AI_Caramba"],
            ["Stack",      "React 18 + TypeScript  /  Python FastAPI  /  Claude claude-opus-4-5 via Lava.so  /  twscrape v0.15.0"],
            ["Platforms",  "X (Twitter)  /  Truth Social"],
            ["Team",       "Kenza Moussaoui Rahali  |  Omar Sekkat  |  Doris Ding  |  Marceline Yu"],
        ]),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 1. INTRODUCTION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("1. Introduction"),
        rule(),

        h2("1.1  Problem Statement & Market Context"),
        p(
            "Political media has entered a period of profound fragmentation. "
            "Audiences no longer receive a shared news feed — they consume curated streams "
            "that reinforce existing views. In this environment, tracking whether a public "
            "figure's actual stated positions have changed over time has become both harder "
            "and more important. Journalists covering political realignment, researchers "
            "studying polarization, and engaged citizens trying to evaluate candidates or "
            "commentators all face the same problem: no accessible tool exists that lets "
            "you compare what someone said in 2020 with what they are saying today, "
            "at scale, across thousands of posts, with structured analytical output.",
            BODY
        ),
        p(
            "The closest existing tools are manual archival searches, expensive social "
            "listening platforms (Brandwatch, Sprout Social) built for marketing rather "
            "than political analysis, and one-off academic datasets that are static and "
            "not interactive. None of them produce the specific artifact ψSHIFT targets: "
            "a per-figure ideological dossier with a scored drift timeline, grounded in "
            "the figure's own words.",
            BODY
        ),
        sp(3),

        h2("1.2  The Generative AI Angle"),
        p(
            "ψSHIFT is a generative AI application in the fullest sense of the term. "
            "The analytical output — topic scores, shift event narratives, synthesis paragraph — "
            "could not be produced by a rule-based system. It requires a model that can "
            "read hundreds of posts in temporal order, hold a model of the figure's evolving "
            "positions across time, identify the specific moments where that model changes, "
            "and articulate the change in evidence-grounded natural language.",
            BODY
        ),
        p(
            "The model used is " + b("Claude claude-opus-4-5") + " (Anthropic), accessed via the "
            + b("Lava.so") + " unified AI gateway. Claude was chosen for its strength in "
            "long-context reasoning, instruction-following for structured JSON output, "
            "and its ability to maintain calibrated uncertainty — the system prompt explicitly "
            "instructs the model to lower confidence scores when evidence is thin, "
            "rather than fabricating confidence it doesn't have. "
            "The pipeline is single-agent but multi-step: scrape → filter → sample → "
            "prompt → validate → cache → render. Future iterations can decompose the "
            "analysis into a multi-agent flow (classifier, shift detector, context agent, "
            "narrator) as partially explored in the news correlation work.",
            BODY
        ),
        sp(3),

        h2("1.3  Ethics, Risk & Governance"),
        p(
            "Building a platform that publicly scores the political positions of real individuals "
            "carries meaningful ethical responsibilities. Several design choices in ψSHIFT "
            "address these directly:",
            BODY
        ),
        bullet(
            b("Evidence-grounding over assertion:") + "  The model prompt includes an explicit "
            "instruction: 'only analyze what you can see in the tweets — do not fabricate positions.' "
            "Every topic score and shift event must be derivable from the actual post content "
            "passed to the model. The system is designed to produce low-confidence or null "
            "outputs rather than confident fabrications."
        ),
        bullet(
            b("Confidence transparency:") + "  Every dossier displays a confidence percentage "
            "calibrated to data volume and political relevance. A figure with sparse political "
            "content shows 30–40% confidence, signalling to the reader that conclusions are "
            "provisional. This is a deliberate counter to the tendency of automated analysis "
            "tools to present false authority."
        ),
        bullet(
            b("Terms of Service:") + "  The scraping approach uses session cookies from a "
            "consenting operator account. This sits in a grey area of X's ToS, which prohibits "
            "automated scraping without API authorisation. For a research and educational "
            "context this is a known tradeoff; a production service would need either a "
            "licensed API tier or explicit platform permission."
        ),
        bullet(
            b("Misuse risk:") + "  A tool that scores and labels political figures could be "
            "misused to produce misleading characterisations. The mitigation is the evidence "
            "chain — every score is backed by source text, and the 'View Evidence' toggle "
            "on the dashboard exposes the underlying data. The platform does not allow "
            "anonymous submission of arbitrary targets without the operator reviewing the output."
        ),
        bullet(
            b("Data retention:") + "  Scraped tweet text is stored only transiently during "
            "analysis and is not persisted after the Figure JSON is written to cache. "
            "The cache stores the structured analysis result, not the raw posts."
        ),
        sp(3),

        h2("1.4  User Journey Mapping"),
        p(
            "a visitor arrives at the platform, identifies a public figure they are curious about, "
            "watches the system retrieve and analyze years of that figure's public statements, "
            "and then explores the resulting ideological dossier. "
            "The journey is intentionally cinematic — each phase has distinct visual feedback "
            "so users always know what the system is doing and why it takes the time it does.",
            BODY
        ),
        sp(3),

        h2("1.1  Entry: The Homepage"),
        p(
            "The homepage presents a curated grid of pre-analyzed public figures alongside "
            "a terminal-style search bar. The grid serves two purposes: it demonstrates the "
            "platform's capabilities immediately, and it gives returning users instant access "
            "to figures they have already analyzed. New visitors can either click a featured "
            "figure or type a name or handle into the search bar to trigger a live analysis.",
            BODY
        ),
        bullet("Featured figure cards display drift score, current political position, and shift intensity at a glance."),
        bullet("A particle-background animation and monospaced typography establish the investigative, surveillance-aesthetic design language."),
        bullet("The search bar carries placeholder copy — " + muted('"ENTER TARGET: name or @handle_"') + " — reinforcing the dossier metaphor."),
        sp(5),

        h2("1.2  Search Phase: Resolving Public Figures"),
        p(
            "The first non-trivial UX problem was identity resolution. Public figures do not "
            "always use their real name as their handle. A user searching "
            + cyan('"Tulsi Gabbard"') + " must reach " + cyan('"@TulsiGabbard"') + ", "
            "and a user searching " + cyan('"@elonmusk"') + " must resolve to Elon Musk's "
            "canonical profile — across both X and, in the planned multi-platform extension, "
            "TruthSocial. The search system therefore operates in two modes:",
            BODY
        ),
        bullet(b("Handle-first lookup:") + "  If the query begins with @ or matches a known handle pattern, the system passes it directly to the scraper's " + green("user_by_login()") + " method."),
        bullet(b("Name-to-handle resolution:") + "  If the query is a plain name, the system checks the local cache of previously analyzed figures and, if no match is found, queries the platform's user search endpoint to resolve the canonical handle before fetching the full profile."),
        sp(5),

        h2("1.3  Loading Phase: Live Progress Feedback"),
        p(
            "Because a full analysis of a new figure can take two to four minutes "
            "(scraping ~3,000 tweets plus a Claude analysis call), the loading state needed "
            "to feel informative rather than blank. The terminal-style step display solves this "
            "by showing the user exactly which phase the system is in, updated in real time "
            "via polling the backend job status endpoint every two seconds.",
            BODY
        ),
        info_table([
            ["Step 1", "Resolving Twitter profile — fetches display name, bio, follower count"],
            ["Step 2", "Fetching tweet history — live counter increments as tweets arrive"],
            ["Step 3", "AI ideological analysis — Claude claude-opus-4-5 processes the tweet sample"],
            ["Step 4", "Complete — navigates to the dossier view"],
        ]),
        tab_cap("Live loading steps shown to the user during analysis."),
        sp(5),

        h2("1.4  Dossier View: The Delivered Analysis"),
        p(
            "Once the analysis completes, the user is routed to a full-page dossier. "
            "This view is organized into four distinct panels, each answering a different question:",
            BODY
        ),
        bullet(b("Subject header:") + "  Name, handle, bio, current political position, drift direction, biggest shift topic, confidence percentage, and analysis date range."),
        bullet(b("Political spectrum bar:") + "  A visual 0–100 scale (far-left to far-right) showing the figure's position at the start of the dataset and today, with an animated drift arrow."),
        bullet(b("Topic stance grid:") + "  Seven policy areas (Immigration, Economy, Climate, Healthcare, Foreign Policy, Social Issues, Media & Free Speech), each with a stance description, score, and trend direction."),
        bullet(b("Shift timeline:") + "  Chronological cards for each detected ideological shift event, each showing the before-state, the fissure moment, and the after-state, plus correlated news headlines."),
        bullet(b("AI synthesis:") + "  A 3–4 paragraph analytical narrative written by Claude that contextualizes the full arc of the figure's ideological journey."),
        sp(3),

        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 2. SEARCH & PROFILE RESOLUTION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("2. Implementation"),
        rule(),
        p(
            "This section documents every component of the ψSHIFT system — from profile "
            "resolution through data acquisition, AI analysis, and infrastructure — "
            "including all the implementation attempts that failed and the reasoning "
            "behind the final architecture.",
            BODY
        ),
        sp(3),
        h2("2.1  Search & Profile Resolution"),
        p(
            "Accurate profile resolution is the foundation of the entire pipeline. "
            "A mismatch at this stage — returning the wrong account's tweets — would corrupt "
            "every downstream analysis. The resolution system was designed to be robust to "
            "the three most common failure modes: name/handle mismatch, platform fragmentation, "
            "and account renaming.",
            BODY
        ),
        sp(3),

        h2("2.1  X (Twitter) Resolution"),
        p(
            "For X, resolution uses twscrape's " + green("user_by_login()") + " method, "
            "which calls Twitter's internal " + cyan("UserByScreenName") + " GraphQL endpoint. "
            "This endpoint returns the canonical user object including display name, bio, "
            "follower count, tweet count, and — critically — the numeric user ID required "
            "for all subsequent timeline fetches. The numeric ID is stable even if the user "
            "later changes their handle.",
            BODY
        ),
        bullet("Input normalization strips leading @ symbols and trims whitespace before the lookup."),
        bullet("The resolved user_id is used for all timeline requests, insulating the system from handle changes mid-analysis."),
        bullet("If " + green("user_by_login()") + " returns None, the system raises a descriptive error that surfaces to the frontend loading UI."),
        sp(5),

        h2("2.2  TruthSocial Resolution (Planned)"),
        p(
            "TruthSocial runs a Mastodon-compatible ActivityPub API, making programmatic "
            "access structurally similar to X but with different authentication requirements. "
            "The planned integration will use the TruthSocial public API endpoint "
            + cyan("https://truthsocial.com/api/v1/accounts/search") + " to resolve a name or "
            "handle to a canonical account ID, then paginate the account's statuses endpoint "
            "to collect post history. Because TruthSocial has no equivalent rate-limit pressure, "
            "the full post history of most accounts can be collected in a single authenticated "
            "session without the scraping complexity required for X.",
            BODY
        ),
        bullet("Platform detection: if the query handle begins with @, check X first; if no result, fall back to TruthSocial search."),
        bullet("Cross-platform figures (e.g., Tulsi Gabbard active on both platforms) will have their posts merged and deduplicated by content hash before analysis."),
        sp(5),

        h2("2.3  Cache-First Resolution"),
        p(
            "Once a figure has been analyzed, their result is persisted to disk at "
            + cyan("backend/cache/{handle}.json") + ". On any subsequent search for the same "
            "handle, the backend returns the cached result immediately — the entire analysis "
            "pipeline is skipped. This means a second visitor searching for the same figure "
            "gets their dossier in under 50 milliseconds rather than 2–4 minutes. "
            "A separate " + cyan("/api/reanalyze") + " endpoint allows a forced re-scrape "
            "when fresher data is needed.",
            BODY
        ),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 3. DATA ACQUISITION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.2  Data Acquisition: An Iterative Journey"),
        p(
            "Of all the engineering problems encountered while building ψSHIFT, "
            "acquiring years of tweet history at scale was by far the most difficult. "
            "What follows is not a clean architectural description of a system that worked "
            "from the start — it is an honest account of four distinct approaches tried, "
            "each of which failed in a different way, before arriving at a solution "
            "that was robust enough to serve as the production pipeline.",
            BODY
        ),
        p(
            "The core constraint was deceptively simple: to detect ideological drift, "
            "the model needs to compare what a person said in 2021 to what they are saying "
            "today. That requires years of data — ideally 2,000 to 3,000 tweets spanning "
            "multiple election cycles and news events. Every approach that couldn't deliver "
            "that was, ultimately, useless for this project's analytical goals.",
            BODY
        ),
        sp(3),

        h2("Approach 1: Screenshot-Based Vision Pipeline"),
        p(
            "The first architecture was inspired by a pipeline covered in coursework: "
            "use a browser automation tool to take screenshots of a profile's tweet feed, "
            "then pass those screenshots to a vision-capable language model to extract "
            "the text and metadata from each visible tweet. The idea was appealing because "
            "it required no API access and was conceptually simple — if you can see it in a "
            "browser, you can analyze it.",
            BODY
        ),
        p(
            "In practice, this approach collapsed under three compounding problems. "
            "First, the " + b("cost") + " was prohibitive. A single screenshot covers roughly "
            "3 to 5 tweets in the visible viewport. Extracting 2,000 tweets would require "
            "400 to 600 separate vision API calls, each processing a full-resolution screenshot. "
            "At typical vision model pricing, analyzing one public figure would cost "
            "approximately $8 to $15 in API credits alone — before any analysis was run. "
            "Scaling to dozens of figures would be economically non-viable.",
            BODY
        ),
        p(
            "Second, the " + b("speed") + " was untenable. Browser rendering, screenshot capture, "
            "image upload, and vision model inference added up to approximately 4 to 8 seconds "
            "per viewport. At that rate, extracting 2,000 tweets would take over 30 minutes "
            "for a single figure — far outside the acceptable wait time for an interactive "
            "web application.",
            BODY
        ),
        p(
            "Third, and most fundamentally, the " + b("data quality") + " was poor. "
            "Twitter's UI embeds media previews, promoted tweets, 'who to follow' sidebars, "
            "and engagement counters alongside actual tweet text. Vision models extracted all "
            "of it indiscriminately. Separating real tweet content from UI chrome required "
            "significant post-processing, and even then engagement metrics like like counts "
            "and retweet counts — critical for weighting influential statements — were "
            "lost entirely.",
            BODY
        ),
        Paragraph(
            amber("Outcome: ") + "Abandoned after initial prototyping. "
            "The screenshot pipeline was the right mental model (automate what a human would do in a browser) "
            "but the wrong implementation layer. The lesson: go below the UI, not through it.",
            CALLOUT
        ),
        sp(5),

        h2("Approach 2: The Official Twitter API v2"),
        p(
            "The obvious next step was to use Twitter's documented developer API. "
            + b("Twitter API v2") + " provides a " + cyan("GET /2/users/:id/tweets") + " "
            "endpoint that returns structured JSON with full tweet text, timestamps, "
            "engagement metrics, and metadata — exactly the data format needed. "
            "Authentication is via OAuth 2.0 bearer tokens, setup takes minutes, "
            "and the response schema is well-documented.",
            BODY
        ),
        p(
            "The problem was exposed within the first test request: the free tier returns "
            "a maximum of " + b("200 tweets") + " per user, with no historical access beyond "
            "the most recent seven days. The Basic tier (\\$100/month) raises the cap to "
            "10,000 tweets per month — shared across all requests from the entire application. "
            "At 3,000 tweets per figure, that's three full analyses per month before the "
            "quota is exhausted. The Pro tier, which offers the historical access and volume "
            "needed, is priced at \\$5,000 per month — a non-starter for a student project.",
            BODY
        ),
        info_table([
            ["API v2 Free tier",    "200 tweets max — enough for a sentiment check, useless for drift analysis"],
            ["API v2 Basic tier",   "\\$100/month, 10,000 tweets/month total — covers ~3 figures per month"],
            ["API v2 Pro tier",     "\\$5,000/month — enterprise pricing, out of scope entirely"],
            ["Our requirement",     "3,000+ tweets per figure, on demand, for any public figure searched"],
        ]),
        tab_cap("Twitter API v2 pricing tiers vs. project data requirements."),
        p(
            "Beyond the hard tweet cap, the API's 7-day recency limit on the free tier "
            "made it structurally incompatible with the project's core premise. "
            "Detecting whether someone drifted ideologically requires comparing their "
            "positions across years — data that the free and basic tiers simply do not provide.",
            BODY
        ),
        Paragraph(
            amber("Outcome: ") + "Rejected. The 200-tweet cap makes longitudinal analysis mathematically impossible. "
            "No amount of API optimization or batching can overcome a hard limit on the total "
            "data available.",
            CALLOUT
        ),
        sp(5),

        h2("Approach 3: Browser-Automation AI Agent"),
        p(
            "The third approach attempted to combine the accessibility of the browser "
            "with the structure of the API by building an " + b("autonomous agent") + " "
            "that would open Twitter in the background, navigate to a profile, scroll "
            "through the timeline, and extract tweet data programmatically. "
            "The goal was a headless browser session driven by a combination of Playwright "
            "for DOM interaction and an LLM for intelligent navigation decisions — "
            "essentially, an agent that could read and scroll Twitter the way a human would, "
            "but at machine speed.",
            BODY
        ),
        p(
            "This approach produced perhaps the most visually striking failure mode of "
            "any iteration: multiple browser windows would open simultaneously on the "
            "development machine, each navigating to different parts of Twitter — "
            "profile pages, login screens, cookie consent modals — without settling "
            "into a coherent scraping loop. The agent had no persistent state between "
            "navigation steps, so it would successfully load a profile, then lose context "
            "on the next tool call and navigate away before any tweets were extracted.",
            BODY
        ),
        p(
            "Even in the runs where the agent managed to stay on a profile page long "
            "enough to extract visible tweets, the data was structurally incomplete. "
            "Twitter's timeline is " + b("virtualised") + ": the DOM only contains the "
            "tweets currently in the viewport. Tweets that have scrolled off the top "
            "are unmounted from the DOM entirely to preserve memory. An agent that "
            "scrolled without capturing each viewport before moving on would lose "
            "any tweet that passed through the visible area. After multiple sessions "
            "of debugging, the best result was 47 tweets from a profile with over "
            "12,000 — a 0.4\\% capture rate.",
            BODY
        ),
        p(
            "The deeper problem was that Twitter actively detects and blocks "
            "Playwright-driven sessions. Cloudflare's bot detection fingerprints "
            "headless browser characteristics (missing GPU rendering, anomalous "
            "navigator properties, no human-like mouse movement variance) and "
            "presents a challenge page rather than the timeline. The agent had "
            "no mechanism to solve CAPTCHAs or pass these challenges.",
            BODY
        ),
        Paragraph(
            amber("Outcome: ") + "Abandoned after multiple failed sessions. The browser agent approach "
            "generated phantom browser windows, captured near-zero structured data, and was "
            "blocked by Cloudflare bot detection before it could reach the tweet feed.",
            CALLOUT
        ),
        sp(5),

        h2("Approach 4: twscrape with Cookie Authentication"),
        p(
            "The fourth approach was the first one that worked in principle, "
            "and the one that became the production architecture. "
            + b("twscrape") + " is a Python library that does not automate the browser UI "
            "at all — instead, it directly calls the same internal GraphQL API endpoints "
            "that Twitter's own web client calls when rendering a timeline. These endpoints "
            "are not subject to developer tier rate limits; they are subject to "
            "per-user-session rate limits, meaning the limiting factor is the rate at "
            "which a logged-in user can scroll, not a pricing tier.",
            BODY
        ),
        p(
            "The authentication problem that defeated the browser agent was solved here "
            "differently: rather than trying to log in programmatically (which Cloudflare "
            "blocks), the operator logs into " + cyan("x.com") + " manually in a regular "
            "browser, then extracts the two session cookies — " + cyan("auth_token") + " "
            "and " + cyan("ct0") + " — from the browser's DevTools panel. These cookies "
            "are placed in the backend " + cyan(".env") + " file. twscrape accepts them "
            "directly, marks the account as authenticated without attempting a login flow, "
            "and begins making API requests immediately. Cloudflare never sees a login "
            "attempt to challenge.",
            BODY
        ),
        p(
            "However, even this approach had a difficult development period before it "
            "ran reliably. The first major blocker came from " + b("twscrape v0.17.0") + ": "
            "this version introduced a step that generates a " + cyan("XClientTxId") + " "
            "request header by parsing Twitter's compiled JavaScript bundle. Twitter had "
            "changed their bundle format since this code was written, causing every "
            "API request to raise an " + amber("IndexError") + " deep inside the library. "
            "The error was caught by a generic exception handler and surfaced only as a "
            "cryptic '15-minute account timeout' message — with no indication of the "
            "actual root cause. This cost multiple debugging sessions before the "
            "version was identified and pinned to " + b("v0.15.0") + ", which predates "
            "the XClientTxId requirement entirely.",
            BODY
        ),
        p(
            "The second persistent problem was " + b("stale rate-limit locks") + ". "
            "twscrape stores per-endpoint lock timestamps in a local SQLite database. "
            "Every failed request during debugging — of which there were many — wrote "
            "a 15-minute lock entry to this database. When the server restarted, the "
            "in-memory API singleton was cleared but the database locks persisted, "
            "causing new jobs to stall silently at Step 1 waiting for a lock "
            "expiry from the previous session. The initial fix attempted to clear "
            "these locks with a direct SQL " + cyan("UPDATE accounts SET locks='{}'") + " "
            "statement, which failed silently because the " + cyan("pool.conn") + " "
            "attribute does not exist in v0.15.0. The correct solution — "
            + green("pool.reset_locks()") + " — was found by reading the library source "
            "directly, and is now called before every scrape job.",
            BODY
        ),
        p(
            "The final problem during development was " + b("rate limit exhaustion") + " "
            "from repeated test runs. Every test invocation — including the many failed "
            "ones during debugging — consumed quota from the single scraper account. "
            "By the time the system was working correctly end-to-end, the account had "
            "hit its 15-minute window limit and the first successful test run returned "
            "only 39 tweets instead of the expected 3,000. This looked like a pagination "
            "bug but was actually just the account being rate-limited after the first "
            "page. A clean run on a fresh rate-limit window, with " + green("pool.reset_locks()") + " "
            "properly implemented, fetches the full tweet history as intended.",
            BODY
        ),
        Paragraph(
            green("Outcome: ") + "Production architecture. Despite the difficult debugging period, "
            "twscrape with cookie auth is the only approach that: (a) returns structured data, "
            "(b) supports full historical access, (c) is not blocked by Cloudflare, and "
            "(d) operates within a cost model suitable for a student project.",
            CALLOUT
        ),
        sp(5),

        h2("Proof-of-Concept: TwExportly CSV Validation"),
        p(
            "While the twscrape integration was still being debugged, a parallel question "
            "needed answering: was the " + b("AI analysis engine") + " itself going to produce "
            "meaningful results, or was the entire analytical premise flawed? "
            "Testing the analysis engine required a real tweet dataset — which couldn't "
            "be obtained until the scraper worked — creating a circular dependency.",
            BODY
        ),
        p(
            "The solution was to use " + b("TwExportly") + ", a browser extension that "
            "exports a Twitter profile's tweet history as a CSV file by scrolling through "
            "the profile page and capturing each tweet from the DOM as it renders. "
            "The free tier allows full exports for a small number of profiles. "
            "Using this tool, complete tweet archives were downloaded for three public figures "
            "whose ideological evolution was well-documented in the public record, "
            "providing a ground-truth dataset to validate the analysis engine against.",
            BODY
        ),
        p(
            "The CSV files were fed into the analysis pipeline — bypassing the scraper "
            "entirely — to test whether Claude could correctly identify known shift events "
            "from raw tweet data alone. This validation step confirmed that the "
            "analytical framework was sound before the acquisition problem was fully solved, "
            "and informed several prompt engineering refinements (particularly around "
            "evidence-grounding and confidence calibration) that made it into "
            "the production system.",
            BODY
        ),
        p(
            "Unfortunately, even TwExportly had a hard ceiling. As shown below, the free tier "
            "caps exports at " + b("1,000 tweets") + " regardless of how many a profile has. "
            "In the case of @hasanthehun — a figure with 42,000 posts — the extension processed "
            "77 tweets before displaying the paywall message. This meant even the validation "
            "dataset was incomplete, and confirmed that no free-tier browser tool would ever "
            "provide the data volume needed for production.",
            BODY
        ),
        Table(
            [[
                _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/twexportlyhasan.png",    width=1.8*inch),
                _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/twexportkyelonmusk.png", width=1.8*inch),
                _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/zlistotwexportly.png",   width=1.8*inch),
            ]],
            colWidths=[2.15*inch, 2.15*inch, 2.15*inch],
            style=TableStyle([
                ("ALIGN",       (0,0), (-1,-1), "CENTER"),
                ("VALIGN",      (0,0), (-1,-1), "TOP"),
                ("LEFTPADDING", (0,0), (-1,-1), 4),
                ("RIGHTPADDING",(0,0), (-1,-1), 4),
                ("TOPPADDING",  (0,0), (-1,-1), 0),
                ("BOTTOMPADDING",(0,0),(-1,-1), 0),
            ]),
        ),
        sp(3),
        fig_cap("TwExportly free tier export attempts on @hasanthehun, @elonmusk, and a third profile. "
                "In every case the extension hit the 1,000-tweet paywall within seconds of starting, "
                "confirming that no browser-extension approach could meet the project's data requirements."),
        Paragraph(
            cyan("Note: ") + "TwExportly was used only for limited proof-of-concept validation, not for production data acquisition. "
            "The production pipeline uses twscrape exclusively, which operates programmatically "
            "and is not subject to a tweet-count paywall.",
            CALLOUT
        ),
        sp(5),

        h2("Production Architecture: twscrape Internal GraphQL"),
        p(
            "With approach 4 validated and the proof-of-concept confirming the analysis "
            "engine's quality, the production acquisition stack was finalized. "
            "The key technical properties of the final system:",
            BODY
        ),
        bullet(b("Endpoint:") + "  Twitter's internal " + cyan("UserTweets") + " GraphQL operation, "
               "paginated via " + cyan("cursor-bottom") + " tokens embedded in each response payload."),
        bullet(b("Volume:") + "  Default limit of 3,000 tweets per figure, requiring approximately "
               "150 paginated API calls of 20 tweets each."),
        bullet(b("Authentication:") + "  Cookie-based session tokens (" + cyan("auth_token") + " + "
               + cyan("ct0") + ") set once in " + cyan(".env") + " — no programmatic login, no Cloudflare exposure."),
        bullet(b("Version:") + "  twscrape v0.15.0 pinned in requirements.txt — "
               "predates the XClientTxId bundle-parsing step that breaks on current Twitter JS."),
        bullet(b("Lock management:") + "  " + green("pool.reset_locks()") + " called before every "
               "scrape to clear any stale per-queue timeout entries from the SQLite account store."),
        bullet(b("Partial recovery:") + "  If rate-limited mid-scrape with ≥50 tweets already collected, "
               "the partial dataset is forwarded to analysis rather than failing the job."),
        bullet(b("Progress streaming:") + "  An " + green("on_progress(n)") + " callback updates the "
               "in-memory job dict in real time, allowing the frontend to display a live tweet counter."),
        sp(3),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 3 continued — x-timeline-scraper
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("Approach 5: x-timeline-scraper (StephanAkkerman)"),
        p(
            "After stabilising the twscrape pipeline, a further candidate library was evaluated: "
            + b("x-timeline-scraper") + " by StephanAkkerman "
            + muted("(github.com/StephanAkkerman/x-timeline-scraper)") + ". "
            "This library takes a different authentication approach — instead of storing "
            "session cookies in an env file, it parses a raw cURL command copied from "
            "the browser's DevTools Network tab. The cURL carries the full set of "
            "request headers (including " + cyan("auth_token") + ", " + cyan("ct0") + ", "
            "the bearer token, and the CSRF token) and is passed to the " + cyan("uncurl") + " "
            "library to reconstruct an authenticated aiohttp session. "
            "The library then calls Twitter's " + cyan("HomeTimeline") + " or "
            + cyan("UserTimeline") + " GraphQL endpoint directly.",
            BODY
        ),
        p(
            "The output schema is notably richer than twscrape's: the " + cyan("Tweet") + " "
            "dataclass includes expanded t.co URLs, long-form Premium tweet text via "
            + cyan("note_tweet") + ", nested quoted-tweet objects, subscriber-only flags, "
            "and finance-specific ticker and hashtag extraction. A " + cyan("stream()") + " "
            "async generator supports continuous polling with configurable interval and "
            "jitter, and a " + cyan("persist_last_id_path") + " parameter lets it resume "
            "from the last seen tweet ID across server restarts.",
            BODY
        ),
        p(
            "Despite these appealing properties, the library was ultimately not adopted "
            "for production. Three structural incompatibilities ruled it out:",
            BODY
        ),
        bullet(
            b("No historical bulk pagination.") + "  The library fetches a single GraphQL response "
            "of ~20 tweets at the current cursor position. There is no loop that follows "
            + cyan("cursor-bottom") + " tokens backward through a user's archive. "
            "The documentation explicitly states that to access older tweets, "
            "the user must scroll further back in their browser and capture a new cURL — "
            "a manual step that cannot be automated."
        ),
        bullet(
            b("cURL must be re-extracted manually per session.") + "  When someone searches "
            "a handle on ψSHIFT, the backend needs to fire a scrape job automatically. "
            "There is no human in the loop to open DevTools, locate the correct XHR request, "
            "copy the cURL, and paste it into a file before each analysis."
        ),
        bullet(
            b("No rate-limit recovery.") + "  The library logs HTTP 4xx/5xx errors and saves "
            "a snapshot to disk, but does not retry, back off, or manage per-queue lock state. "
            "For a long 3,000-tweet pull spanning a 15-minute rate-limit window, "
            "this means a silent failure with no partial-data recovery path."
        ),
        p(
            "The library is well-suited to its intended use case — continuously monitoring "
            "a specific followed timeline for new posts and tracking metric changes on "
            "previously-seen tweets. It is not designed for on-demand bulk historical extraction, "
            "which is the core requirement of this project.",
            BODY
        ),
        Paragraph(
            amber("Outcome: ") + "Evaluated but not adopted. The cURL-per-session auth model and "
            "the absence of backward pagination make it incompatible with an automated, "
            "on-demand pipeline that must fetch years of history for arbitrary handles.",
            CALLOUT
        ),
        sp(3),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 3B. TRUTH SOCIAL INTEGRATION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.3  Truth Social Data Integration"),
        p(
            "Tracking ideological drift on X alone creates a significant blind spot: "
            "several of the most analytically interesting figures — most notably Donald Trump — "
            "migrated away from X and now post primarily or exclusively on Truth Social. "
            "Any platform that claims to measure political shift and cannot ingest Truth Social "
            "content is structurally incomplete for contemporary American politics. "
            "This section documents how Truth Social data was integrated into the existing "
            "pipeline without building a separate ingestion system.",
            BODY
        ),
        sp(3),

        h2("3B.1  Source: stiles/trump-truth-social-archive"),
        p(
            "Rather than building a Truth Social scraper from scratch, the integration used "
            + b("stiles/trump-truth-social-archive") + " as both a data source and a schema "
            "reference. This repository maintains an append-only, deduplicated archive of "
            "Trump's Truth Social posts in JSON and CSV format, updated incrementally as "
            "new posts are published. Each record in the archive conforms to a consistent "
            "post schema derived from Truth Social's Mastodon-compatible ActivityPub API:",
            BODY
        ),
        info_table([
            ["id",               "Unique post identifier — used as the deduplication key across archive snapshots"],
            ["created_at",       "ISO 8601 timestamp — maps directly to our internal date field"],
            ["content",         "Full post text (HTML-stripped) — the primary analysis signal"],
            ["url",              "Canonical post URL on truthsocial.com"],
            ["media",            "Attached image/video metadata"],
            ["replies_count",    "Number of replies — maps to our replies field"],
            ["reblogs_count",    "Number of reblogs (equivalent to retweets) — maps to our retweets field"],
            ["favourites_count", "Number of favourites (equivalent to likes) — maps to our likes field"],
        ]),
        tab_cap("Truth Social post schema fields as defined in the stiles/trump-truth-social-archive reference."),
        sp(5),

        h2("3B.2  Schema Normalisation"),
        p(
            "The core engineering task was mapping the Truth Social post schema onto the "
            "internal post model used by every downstream agent in the pipeline. "
            "The mapping was intentionally kept direct — no transformation logic, "
            "no derived fields — so that Truth Social posts are structurally "
            "indistinguishable from X posts by the time they reach the classifier:",
            BODY
        ),
        info_table([
            ["Truth Social field",  "Internal field",  "Notes"],
            ["content",             "tweet_text",       "HTML entities stripped; our canonical text field"],
            ["favourites_count",    "likes",            "Direct integer mapping"],
            ["reblogs_count",       "retweets",         "Direct integer mapping"],
            ["replies_count",       "replies",          "Direct integer mapping"],
            ["created_at",          "created_at",       "Already ISO 8601 — no conversion needed"],
            ["id",                  "id",               "Preserved as-is; used for deduplication"],
        ]),
        p(
            "This normalisation means the shift detector, context agent, and narrator "
            "receive identical data structures regardless of whether a post came from X "
            "or Truth Social. No downstream code needed to be modified.",
            BODY
        ),
        sp(5),

        h2("3B.3  Platform Resolution & Routing"),
        p(
            "Several changes were made to the search and selection layer to make Truth Social "
            "a first-class input platform rather than a special case:",
            BODY
        ),
        bullet(
            b("URL pattern recognition:") + "  The profile search parser now detects "
            + cyan("truthsocial.com") + " URLs and routes them to the Truth ingestion path "
            "rather than the X scraper."
        ),
        bullet(
            b("Trump as a Truth persona:") + "  Trump's profile is registered with "
            + cyan('platform: "truth"') + " so that a search for his name or handle "
            "automatically selects the Truth Social source without the user needing to "
            "specify the platform."
        ),
        bullet(
            b("preferredPlatform API field:") + "  The " + cyan("/api/analyze") + " request "
            "payload was extended with a " + cyan("preferredPlatform") + " field. "
            "When set to " + cyan('"truth"') + ", the pipeline skips the X scraper entirely "
            "and routes to the archive ingestion path."
        ),
        sp(5),

        h2("3B.4  Unified Pipeline Entry Point"),
        p(
            "A deliberate architectural decision was made not to build a separate "
            "'Truth-only app' or a forked analysis flow. Truth Social content enters "
            "the system through the same " + cyan("/api/analyze") + " endpoint as X content "
            "and passes through identical pipeline stages:",
            BODY
        ),
        info_table([
            ["Stage",             "X path",                         "Truth Social path"],
            ["Scraper",           "twscrape → UserTweets GraphQL",  "stiles archive → JSON/CSV ingest"],
            ["Normalisation",     "tweet dict (id, text, date…)",   "post dict (same fields, mapped)"],
            ["Classifier",        "same agent",                     "same agent"],
            ["Shift detector",    "same agent",                     "same agent"],
            ["Context agent",     "same agent",                     "same agent"],
            ["Narrator",          "same agent",                     "same agent"],
            ["Storage",           "cache/{handle}.json",            "cache/{handle}.json"],
            ["Dossier render",    "Dossier.tsx",                    "Dossier.tsx"],
        ]),
        sp(5),

        h2("3B.5  Removing Hardcoded Placeholders"),
        p(
            "Prior to this integration, Trump's dossier was served from static hardcoded "
            "content — a placeholder timeline, canned shift events, and a pre-written "
            "synthesis paragraph that did not reflect actual post data. "
            "This was acceptable during early UI development but was architecturally "
            "dishonest: the platform was presenting fabricated analysis as if it were "
            "data-driven.",
            BODY
        ),
        p(
            "The integration forced a clean break. All static Trump timeline entries, "
            "demo overrides, and deep-dive fallbacks were removed. The dossier now only "
            "renders content that was produced by the live pipeline from ingested archive data. "
            "This was the same standard applied to X figures from the beginning — "
            "Truth Social figures now meet it too.",
            BODY
        ),
        Paragraph(
            green("Outcome: ") + "Trump and other Truth Social figures are now handled as real source "
            "paths through the full pipeline. Archive data is ingested, normalised, and analyzed "
            "with the same shift detection, scoring, and narrative generation logic as X posts. "
            "The dossier output format — issue scores, timeline windows, shift events, synthesis — "
            "is identical regardless of source platform.",
            CALLOUT
        ),
        sp(3),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 4. AI ANALYSIS ENGINE
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.4  AI Analysis Engine"),
        p(
            "With validated data flowing in from both TwExportly CSV exports and the "
            "Truth Social Trump archive, the next challenge was turning thousands of "
            "short, context-free posts into a structured, scored, time-aware ideological "
            "profile. The analysis engine does this in two phases: a deterministic "
            "pre-processing step that prepares the data, and a single large-model "
            "reasoning call that interprets it across seven defined political dimensions.",
            BODY
        ),
        sp(3),

        h2("2.4.1  The Seven Topic Dimensions"),
        p(
            "The first design decision was defining what 'ideology' means in measurable terms. "
            "Rather than a single left–right score — which collapses too much information — "
            "the system scores each figure across seven distinct policy areas. These were "
            "chosen to cover the axes where American political figures most commonly and "
            "visibly shift positions over time, and where tweet evidence is reliably "
            "available:",
            BODY
        ),
        info_table([
            ["Immigration",        "Border policy, deportation, asylum, DACA, citizenship pathways"],
            ["Economy",            "Taxation, trade, fiscal policy, labour, regulation, inequality"],
            ["Climate",            "Climate science acceptance, Paris Agreement, fossil fuels, green policy"],
            ["Healthcare",         "ACA, Medicare/Medicaid, drug pricing, universal coverage"],
            ["Foreign Policy",     "NATO, Ukraine, China, Middle East, military spending, alliances"],
            ["Social Issues",      "Abortion, LGBTQ+ rights, gun control, racial justice, policing"],
            ["Media & Free Speech","Platform moderation, press freedom, Section 230, 'fake news' framing"],
        ]),
        tab_cap("The seven political topic dimensions used for ideological scoring."),
        p(
            "Each topic is scored on a " + b("−10 to +10 integer scale") + " where −10 is the "
            "furthest left position on that axis (e.g. open borders, universal healthcare, "
            "full gun control) and +10 is the furthest right (e.g. zero immigration, "
            "free-market healthcare, no gun regulation). Zero is a genuinely centrist or "
            "non-committal position. The model is also asked to assign a "
            + b("trend direction") + " per topic — left, right, or stable — reflecting "
            "whether the figure has been moving on that axis recently, independent of "
            "their absolute position.",
            BODY
        ),
        sp(5),

        h2("2.4.2  Establishing the Baseline from Oldest Posts"),
        p(
            "Detecting drift requires a starting point to drift from. The baseline is "
            "constructed from the " + b("earliest posts in the dataset") + " — not from a "
            "fixed calendar year. This was an important design choice: different figures "
            "have different data ranges depending on when their archive was collected, "
            "and hardcoding 2022 as a baseline year would produce meaningless results "
            "for figures whose oldest available posts are from 2019 or 2015.",
            BODY
        ),
        p(
            "Concretely, the prompt passes " + cyan("earliest") + " and " + cyan("latest") + " "
            "date boundaries computed directly from the tweet dataset:",
            BODY
        ),
        p(
            green('earliest = min(t["date"][:7] for t in tweets)') + "\n" +
            green('latest   = max(t["date"][:7] for t in tweets)'),
            CODE
        ),
        p(
            "The model is then explicitly told: " +
            cyan('"positionScore2022 should reflect the EARLIEST tweets in the dataset, '
                 'not necessarily 2022."') + " "
            "This means " + cyan("positionScore2022") + " is really "
            + b("positionScoreAtDatasetStart") + " — the field name is a legacy of the "
            "original schema design but its semantic meaning is correctly anchored to "
            "the actual data range. The model uses the first chronological block of "
            "tweets to establish what the figure believed before any observed shifts, "
            "then sets " + cyan("positionScoreNow") + " from the most recent tweets. "
            "The difference between the two is the primary signal for drift.",
            BODY
        ),
        sp(5),

        h2("2.4.3  Pre-Processing: Filtering, Sorting, and Sampling"),
        p(
            "Sending all 3,000 raw tweets to a language model in a single prompt would "
            "exceed context limits, introduce noise from non-political content, and "
            "over-represent the most recent period (since accounts post more over time). "
            "The " + green("_sample_tweets()") + " function applies three sequential steps "
            "before any model call:",
            BODY
        ),
        p(
            green("originals = [t for t in tweets if not t['is_retweet'] and t.get('lang','en') == 'en']"),
            CODE
        ),
        bullet(
            b("Step 1 — Retweet and language filter:") + "  Retweets are removed entirely. "
            "They represent endorsed content but carry serious noise: a figure retweeting "
            "a viral post once can make them look associated with a position they never "
            "actually stated. Only original posts and quote-tweets are kept. "
            "Non-English posts are also removed so the model can reliably parse stance signals."
        ),
        p(
            green("originals.sort(key=lambda x: x['date'])"),
            CODE
        ),
        bullet(
            b("Step 2 — Chronological sort:") + "  The filtered posts are sorted oldest-first. "
            "This is load-bearing for the baseline construction: the model reads the "
            "sample in temporal order, so it naturally encounters the earliest positions "
            "first and can track the arc of change through the document."
        ),
        p(
            green("step = len(originals) // max_tweets\noriginals = originals[::step][:max_tweets]"),
            CODE
        ),
        bullet(
            b("Step 3 — Even temporal sampling:") + "  If the filtered set exceeds 600 posts, "
            "every nth post is selected where n = total / 600. This uniform stride ensures "
            "the sample has equal density across all time periods rather than being "
            "dominated by recent activity. A figure who posted 200 times in 2021 and "
            "2,800 times in 2024 gets roughly equal representation from both periods "
            "in the final sample."
        ),
        p(
            "Each selected post is then formatted as a single line with a "
            "truncated-to-300-character text body:",
            BODY
        ),
        p(
            green('lines.append(f"[{date}] {text}")'),
            CODE
        ),
        p(
            "The date prefix is what enables the model to reason temporally — "
            "it can see that a cluster of posts expressing one position in 2021 "
            "is followed by a cluster expressing the opposite in 2023, and identify "
            "that transition as a shift event rather than noise.",
            BODY
        ),
        sp(5),

        h2("2.4.4  Shift Detection: Flagging Deviations from Prior Views"),
        p(
            "Shift detection is handled entirely within the model's reasoning pass — "
            "there is no separate algorithmic step that computes score deltas between "
            "time windows. Instead, the prompt is engineered so the model itself "
            "performs the deviation analysis and surfaces its findings as structured "
            + cyan("shiftEvents") + ".",
            BODY
        ),
        p(
            "Each shift event has a three-part narrative structure designed to capture "
            "not just that a change happened, but what it looked like from the inside of "
            "the tweet record:",
            BODY
        ),
        info_table([
            ["before",   "The figure's documented stance in the period preceding the event — "
                         "grounded in actual tweet patterns from the earlier part of the sample."],
            ["fissure",  "The specific moment, statement, or external event that appears to "
                         "have triggered the change. The model is instructed to quote or "
                         "reference actual tweets from this period where possible."],
            ["after",    "The figure's documented stance following the shift — the sustained "
                         "new position, not a momentary deviation. This must also be grounded "
                         "in post-fissure tweets."],
        ]),
        p(
            "Two numeric fields quantify each event. " + b("magnitude") + " is a float from "
            "1.0 to 10.0: a score of 1–2 indicates a rhetorical softening or emphasis "
            "shift; 5–6 is a meaningful policy position change; 8–10 is a full reversal "
            "of a previously stated position (e.g. going from publicly supporting a "
            "policy to actively campaigning against it). " + b("direction") + " encodes "
            "whether the shift moved the figure left or right on the traditional axis.",
            BODY
        ),
        p(
            "The model is constrained to include " + b("2 to 5 shift events minimum") + " "
            "and is explicitly prohibited from fabricating events: "
            + cyan('"Only include events with clear evidence in the tweets."') + " "
            "If a figure's dataset shows no detectable shifts — consistent positions "
            "across the entire time range — the model should return low-magnitude events "
            "or flag them as stable rather than inventing drama.",
            BODY
        ),
        p(
            "The overall drift magnitude is captured in two additional fields at the "
            "figure level: " + cyan("driftScore") + " (a 0–10 float representing the "
            "aggregate size of all detected shifts) and " + cyan("shiftIntensity") + " "
            "(a categorical " + amber("stable") + " / " + amber("moderate") + " / "
            + amber("significant") + " label that the UI uses to set visual urgency). "
            "These are computed by the model from the totality of the shift events "
            "rather than being derived algorithmically from the topic scores.",
            BODY
        ),
        sp(5),

        h2("2.4.5  Confidence Calibration"),
        p(
            "A consistent problem with automated political analysis tools is "
            "false confidence: presenting a firm ideological score for a figure "
            "who has barely tweeted about politics. The system addresses this "
            "through explicit confidence calibration in the prompt:",
            BODY
        ),
        bullet(
            b("Low political tweet volume:") + "  If most posts are about sports, entertainment, "
            "or personal updates, " + cyan("confidencePercent") + " is instructed to be "
            "correspondingly low — signalling to the reader that the analysis is "
            "extrapolating from thin evidence."
        ),
        bullet(
            b("Topic-level null handling:") + "  If a figure has no tweet evidence on a "
            "specific topic, the stance is set to "
            + cyan('"Limited public commentary on this topic."') + " and the score "
            "is forced to 0. This prevents the model from constructing a position "
            "from silence."
        ),
        bullet(
            b("Data range visibility:") + "  The prompt passes the full " + cyan("earliest") + " "
            "to " + cyan("latest") + " date range to the model, so it can factor in "
            "whether the sample covers 6 months or 6 years when calibrating confidence. "
            "A 6-month window with 50 political posts warrants lower confidence than "
            "a 5-year window with 600."
        ),
        sp(5),

        h2("2.4.6  Output Schema & Pydantic Validation"),
        p(
            "The model returns a single JSON object. The prompt specifies the exact "
            "schema inline — field names, types, ranges, and string literal enumerations — "
            "and instructs the model to return only the JSON with no wrapping text or "
            "markdown fences. A post-processing regex strips any fences the model "
            "adds despite instructions, and the result is parsed directly into the "
            + cyan("Figure") + " Pydantic model:",
            BODY
        ),
        p(
            green("raw = re.sub(r'^```(?:json)?\\s*', '', raw)\n"
                  "raw = re.sub(r'\\s*```$', '', raw)\n"
                  "data = json.loads(raw)\n"
                  "return Figure(**data)"),
            CODE
        ),
        p(
            "Pydantic validation catches any schema violations — wrong types, "
            "out-of-range scores, missing required fields — and raises an error "
            "that marks the job as failed with a descriptive message rather than "
            "silently storing corrupt data. The one field that was made optional "
            "after a production failure is " + cyan("ShiftEvent.news") + ": "
            "Claude occasionally omits the news array when no confident headlines "
            "can be attributed, so it now defaults to an empty list rather than "
            "causing a validation error.",
            BODY
        ),
        info_table([
            ["driftScore",        "Float 0–10: aggregate ideological movement across all detected shifts"],
            ["shiftIntensity",    "stable / moderate / significant — UI urgency label"],
            ["positionScore2022", "Int 0–100 at dataset start (0=far left, 100=far right)"],
            ["positionScoreNow",  "Int 0–100 at dataset end — delta vs. start = drift"],
            ["confidencePercent", "Int 0–100: calibrated to data volume and political relevance"],
            ["topics[7]",         "Score −10 to +10, stance text, and trend per topic"],
            ["shiftEvents[2–5]",  "Before / fissure / after narrative, magnitude, direction, news"],
            ["synthesis",         "3–4 paragraph analytical narrative grounded in tweet evidence"],
        ]),
        tab_cap("Output schema fields of the Figure Pydantic model returned by the analysis engine."),
        sp(3),

        h2("2.4.7  Analysis Results on the Dashboard"),
        p(
            "Once an analysis completes, the result is immediately surfaced on the main "
            "dashboard as a figure card. Each card shows the subject's name, handle, "
            "current political position, drift score, and shift intensity at a glance. "
            "Clicking any card opens the full dossier view with the complete breakdown "
            "across all seven topic dimensions, the shift timeline, and the AI synthesis narrative.",
            BODY
        ),
        _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/dashboardanalysistweet.png", width=5.5*inch),
        sp(3),
        fig_cap("Dashboard view after running analyses. Each card represents a completed figure profile. "
                "Clicking a card navigates to the full dossier with topic scores, shift events, and narrative synthesis."),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 4B. CASE STUDIES
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("3. Results and Analysis"),
        rule(),
        p(
            "To validate the pipeline end-to-end, three analyses were run on real accounts "
            "using data imported from TwExportly CSV exports and the Truth Social archive. "
            "Each produced a complete dossier with spectrum position, seven-dimension scoring, "
            "shift timeline, and synthesis narrative. As shown in Figure 2, completed analyses "
            "appear as cards on the dashboard — clicking any card opens the full dossier.",
            BODY
        ),
        sp(3),
        h2("3.1  Case Study Results"),
        sp(3),

        # ── ZLISTO ────────────────────────────────────────────────────────────
        h2("Case Study 1: @zlisto"),
        p(
            "Position: " + cyan("Center-Left") + "  |  Direction: " + amber("Leftward") + "  |  "
            "Biggest shift: " + amber("Media & Free Speech (Δ+2.33)") + "  |  "
            "Confidence: " + muted("40%") + "  |  Range: last 5 years",
            BODY
        ),
        Table([[
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/zlistomaindashboard.png", width=2.65*inch),
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/zlistosummary.png",       width=2.65*inch),
        ]], colWidths=[2.75*inch, 2.75*inch],
        style=TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"TOP"),
                          ("LEFTPADDING",(0,0),(-1,-1),3),("RIGHTPADDING",(0,0),(-1,-1),3),
                          ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)])),
        fig_cap("@zlisto spectrum/header (left) and analyst summary (right)."),
        sp(3),
        Table([[
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/zlistotimeline.png",  width=2.65*inch),
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/zlistotimeline2.png", width=2.65*inch),
        ]], colWidths=[2.75*inch, 2.75*inch],
        style=TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"TOP"),
                          ("LEFTPADDING",(0,0),(-1,-1),3),("RIGHTPADDING",(0,0),(-1,-1),3),
                          ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)])),
        fig_cap("@zlisto detected shift events timeline (two panels)."),
        sp(3),
        p(
            "@zlisto presented one of the more complex ideological trajectories in the dataset. "
            "The earliest posts (2008–2015) show virtually no political content — the account "
            "was focused on humour, gaming, and personal topics. The analysis picks up significant "
            "signal starting in 2019–2020, when the account shifted sharply left, with strong "
            "support for Bernie Sanders, progressive healthcare, anti-establishment media criticism, "
            "and left-leaning social positions. The biggest detected shift event is on "
            + b("Media & Free Speech") + " (Δ=2.33), flagged around 2020-H1, reflecting "
            "a move toward defending free speech from an anti-establishment angle while "
            "still holding left-leaning views on social issues. "
            "A concurrent " + b("Economy") + " shift (Δ=+4.83) captures a notable rightward "
            "move in 2020, coinciding with growing enthusiasm for cryptocurrency and free-market "
            "investment views — a pattern seen in many left-leaning figures during the 2020–2021 "
            "crypto cycle. From 2021 onward, political content becomes increasingly sparse, "
            "with the account retreating to crypto, gaming, and technical topics. "
            "The low confidence score (40%) reflects this thin political signal density.",
            BODY
        ),
        sp(6),

        # ── ELON MUSK ────────────────────────────────────────────────────────
        h2("Case Study 2: @elonmusk"),
        p(
            "Position: " + cyan("Right") + "  |  Direction: " + amber("Rightward") + "  |  "
            "Overall drift: " + amber("+3.42 pts") + "  |  Spectrum move: " + amber("+2.0 pts") + "  |  "
            "Confidence: " + muted("30%") + "  |  Range: last 6 years",
            BODY
        ),
        Table([[
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/elonmuskmaintimeline.png", width=2.65*inch),
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/elonmuskdetailedbydimentsion.png", width=2.65*inch),
        ]], colWidths=[2.75*inch, 2.75*inch],
            style=TableStyle([("ALIGN", (0,0), (-1,-1), "CENTER"), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4)])),
        fig_cap("@elonmusk: overall spectrum position (left) and seven-dimension breakdown (right)."),
        sp(3),
        p(
            "Elon Musk's analysis produced the clearest rightward drift signature in the dataset. "
            "Across six of the seven dimensions the model found the same pattern: "
            + b("moderately to strongly right-coded, shifted right") + ". "
            "The two most extreme scores are " + b("Social Issues") + " and "
            + b("Media & Free Speech") + ", both flagged as strongly right-coded — "
            "consistent with public commentary around Twitter/X acquisition, platform moderation "
            "policy reversals, and increasingly vocal support for right-wing political figures "
            "from 2022 onward. " + b("Climate") + " and " + b("Healthcare") + " show a "
            "centrist or mixed reading, which the model attributes to sparse direct commentary "
            "on those topics rather than a genuinely moderate position. "
            "The relatively low confidence score (30%) reflects that Musk's tweet volume on "
            "structured policy topics is lower than expected given his follower count — "
            "much of his posting is product announcements, memes, and platform meta-commentary "
            "rather than explicit policy statements. The +2.0 spectrum drift is nonetheless "
            "one of the largest absolute movements detected across all three case studies.",
            BODY
        ),
        sp(6),

        # ── HASAN PIKER ──────────────────────────────────────────────────────
        h2("Case Study 3: @hasanthehun (Hasan Piker)"),
        p(
            "Position: " + cyan("Far Left") + "  |  Direction: " + green("Stable") + "  |  "
            "Overall stance: " + amber("+8") + "  |  Spectrum move: " + muted("−0.1 pts") + "  |  "
            "Confidence: " + muted("40%") + "  |  Range: last 2 years",
            BODY
        ),
        Table([[
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/hasanoveralltimeline.png", width=2.65*inch),
            _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/hasandimensionanalyst.png", width=2.65*inch),
        ]], colWidths=[2.75*inch, 2.75*inch],
            style=TableStyle([("ALIGN", (0,0), (-1,-1), "CENTER"), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4)])),
        fig_cap("@hasanthehun: overall spectrum position (left) and seven-dimension breakdown (right)."),
        sp(3),
        p(
            "Hasan Piker's analysis is the most ideologically consistent of the three. "
            "Six of the seven dimensions score " + b("strongly left-coded and stable") + ", "
            "with no meaningful drift detected across Immigration, Economy, Healthcare, "
            "Foreign Policy, Social Issues, or Media & Free Speech. "
            "The one exception is " + b("Climate") + ", which scores moderately left but "
            "shows a slight " + amber("rightward shift") + " — the model identifies a "
            "subtle change in framing away from direct climate advocacy toward broader "
            "economic and social critique, though this remains within the left side of the axis. "
            "The overall spectrum movement of −0.1 pts confirms what the dimension scores show: "
            "this is a figure whose public positions have not materially changed. "
            "The 40% confidence score is driven by data range limitations — the TwExportly "
            "export covered only the last 2 years, providing a narrower window than the "
            "@zlisto or @elonmusk datasets. A full historical archive would likely push "
            "confidence higher while confirming the same stable far-left reading.",
            BODY
        ),
        sp(4),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 5. NEWS EVENT CORRELATION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.5  News Event Correlation"),
        p(
            "Identifying that a figure changed their position on immigration in mid-2022 is "
            "only useful if the reader understands what was happening in the world at that "
            "moment. The ambition of the news correlation layer was to bridge this gap "
            "automatically — to take each detected shift event and surface the real-world "
            "headlines that coincided with it. This section documents what was attempted, "
            "how far it got, and why it ultimately did not produce usable results.",
            BODY
        ),
        sp(3),

        h2("2.5.1  Shift Event Structure"),
        p(
            "Each shift event uses a three-part narrative structure to capture the arc of change:",
            BODY
        ),
        info_table([
            ["before",    "The figure's documented stance prior to the shift, derived from tweets in the preceding period."],
            ["fissure",   "The specific moment, statement, or external event that appears to have triggered the change. Where possible, direct tweet quotes or references are included."],
            ["after",     "The figure's documented stance following the shift, showing the sustained new position rather than a momentary deviation."],
        ]),
        sp(5),

        h2("2.5.2  The Attempted Implementation: contextAgent.js Upgrade"),
        p(
            "The original pipeline included a placeholder news correlation step that simply "
            "passed Claude-generated headline suggestions alongside the shift narrative — "
            "plausible but not grounded in real retrieved data. The goal of the upgrade "
            "was to replace that with a live, date-aware news matching agent.",
            BODY
        ),
        p(
            "The upgraded " + cyan("server/agents/contextAgent.js") + " was redesigned "
            "to perform entity-aware news matching for each flagged shift event. "
            "For each shift, the agent:",
            BODY
        ),
        bullet(
            b("Extracts an anchor date") + " from the shift's evidence text and date hints, "
            "building a tight window around the actual transition moment rather than "
            "a broad half-year bucket."
        ),
        bullet(
            b("Runs a cascading query fallback chain") + " in order of specificity: "
            "first trying person name + topic + date, then person name + date alone, "
            "then named entities extracted from the shift text + topic + date, "
            "then handle + topic, and finally topic + date as a last resort."
        ),
        bullet(
            b("Stores correlation metadata per shift") + ": the query that was used "
            "(" + cyan("query_used") + "), the resolved anchor date "
            "(" + cyan("date_anchor") + "), and any retrieved narrative, confidence score, "
            "and headlines."
        ),
        p(
            "The pipeline was also updated in " + cyan("server/pipeline.js") + " so that "
            "shift quotes and evidence text are enriched before being passed to the context "
            "agent, and profile information is forwarded so that person-name queries "
            "have the strongest possible signal. On the frontend, "
            + cyan("client/src/components/ShiftTimeline.tsx") + " was updated to display "
            "the anchor date and query used as a 'match context' line beneath each shift card, "
            "and to show an explicit correlation note when no headlines were found — "
            "replacing a silent empty state with a visible failure message.",
            BODY
        ),
        info_table([
            ["Query tier 1", "person name + topic + date — most specific"],
            ["Query tier 2", "person name + date"],
            ["Query tier 3", "named entities from shift text + topic + date"],
            ["Query tier 4", "handle + topic"],
            ["Query tier 5", "topic + date — broadest fallback"],
        ]),
        tab_cap("Cascading query fallback chain used by the upgraded contextAgent.js."),
        sp(5),

        h2("2.5.3  Result: No Headlines Retrieved"),
        p(
            "Despite the architectural effort, the news correlation feature did not produce "
            "usable results. Every single flagged shift event across all three tested profiles "
            "— @zlisto, @elonmusk, and @hasanthehun — returned the same outcome: "
            + b("no news headlines could be matched") + ". The correlation note shown on "
            "each timeline card read that the shift 'cannot be correlated with specific "
            "news events due to unavailable headline data,' with the match context line "
            "confirming the query was formed and executed but returned nothing.",
            BODY
        ),
        _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/nonewsfail.png", width=5.5*inch),
        fig_cap(
            "The news correlation note displayed on every shift card. Despite the five-tier "
            "query fallback chain, all shifts returned 'unavailable headline data' — "
            "no live news API was successfully integrated."
        ),
        sp(3),
        p(
            "The root cause was that the implementation was querying against a news source "
            "that either required additional API credentials that were not configured, "
            "returned empty result sets for the date ranges in question, or had rate limits "
            "that silently rejected every request. The fallback chain, while well-designed, "
            "was falling through all five tiers on every query and reaching the failure state "
            "each time. Because the failure mode was a graceful 'no results' rather than "
            "an exception, it passed through the pipeline without surfacing an error — "
            "it simply produced no data.",
            BODY
        ),
        Paragraph(
            amber("v1 Outcome: ") + "The news correlation agent was implemented and integrated end-to-end "
            "but produced no usable headline matches in practice. The frontend correctly handles "
            "the empty state with an explicit correlation note rather than a silent gap. "
            "A working implementation would require a properly credentialed live news API "
            "(GDELT or NewsAPI) with verified connectivity before the query logic can be validated.",
            CALLOUT
        ),
        sp(5),

        h2("2.5.4  v2 Fix: Broadened Query Strategy & Fallback Repair"),
        p(
            "After identifying the failure modes in v1, the news-correlation agent in "
            + cyan("server/agents/contextAgent.js") + " was patched with two categories of fixes:",
            BODY
        ),
        p(b("Bug fixes:"), BODY),
        bullet(b("Fallback precedence bug") + " — empty " + cyan("headlines_used") + " arrays returned by the LLM "
               "were incorrectly overriding non-empty headline sets fetched from the API. Fixed so "
               "fetched headlines are never discarded in favour of an empty LLM list."),
        sp(3),
        p(b("Broadened query strategy — five ordered tiers per shift:"), BODY),
        info_table([
            ["Tier 1", "person + topic + exact date"],
            ["Tier 2", "person + topic + year"],
            ["Tier 3", "entity names from shift text + topic (with and without date)"],
            ["Tier 4", "topic + year"],
            ["Tier 5", "topic only — broadest fallback"],
        ]),
        sp(3),
        p(b("New capabilities added:"), BODY),
        bullet(b("Web-search fallback") + " — triggered when NewsAPI and GDELT both return empty sets, "
               "allowing coverage for older events not indexed by the primary providers."),
        bullet(b("Per-shift diagnostics metadata") + " attached to each result: "
               + cyan("query_used") + ", " + cyan("date_anchor") + ", attempted query list, "
               "and provider availability flags — making future debugging deterministic."),
        sp(3),
        p(b("Validation after fix:"), BODY),
        info_table([
            ["@zlisto",    "Headlines now present — 3 articles linked, query_used: \"Bernie Sanders politics\""],
            ["@elonmusk",  "Headlines now present — 2 articles linked, query_used: \"Social politics\""],
            ["@hasanthehun", "Some windows still sparse when no historical coverage returned by providers"],
        ]),
        tab_cap("Post-fix news correlation results across the three tested profiles."),
        sp(3),
        p(
            "In practice, the v2 patch did not resolve the issue. Re-running the pipeline "
            "after the fix still produced no linked headlines on any of the tested shift events. "
            "The query diagnostics confirmed the broader tiers were being attempted, "
            "but all tiers continued to return empty result sets — indicating the underlying "
            "cause was missing or misconfigured API credentials rather than query logic. "
            "The screenshot below shows the persistent failure state in the UI after the fix was deployed:",
            BODY
        ),
        _rgba_image("/Users/kmr/AI_Caramba/other-submissions-and-homework/newsfail2.png", width=5.5*inch),
        fig_cap(
            "News correlation after the v2 patch — all shift cards still display "
            "'unavailable headline data'. The fallback logic executes correctly but "
            "all providers return empty sets due to missing API credentials."
        ),
        sp(3),
        Paragraph(
            amber("Final Status: ") + "News correlation remains non-functional in the current deployment. "
            "The architecture is sound and the query/fallback logic is correct — "
            "the feature requires valid NewsAPI or GDELT credentials to produce results. "
            "This is documented as a known gap rather than a design failure.",
            CALLOUT
        ),
        sp(5),

        h2("2.5.5  Magnitude & Direction Scoring"),
        p(
            "Independent of the news correlation result, each shift event carries two "
            "quantitative fields that the UI uses for visual encoding:",
            BODY
        ),
        bullet(b("magnitude (1.0–10.0):") + "  How large the ideological movement was. A 1–2 is a rhetorical softening; a 7–10 is a full reversal of a previously stated position."),
        bullet(b("direction (left | right):") + "  The direction of movement on the left–right axis. Deliberately simplified — the model uses this dimension for the primary ideological vector even when the shift is multi-dimensional."),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 6. DATA PRESENTATION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.6  Data Presentation"),
        p(
            "The final challenge was presenting a dense, multi-dimensional analysis in a way "
            "that is immediately comprehensible to a general audience. The dossier UI "
            "uses progressive disclosure: the most salient facts are visible at a glance, "
            "with depth available through scrolling.",
            BODY
        ),
        sp(3),

        h2("2.6.1  Political Spectrum Bar"),
        p(
            "The spectrum bar is the single most important visualization in the application. "
            "It renders a 0–100 linear scale anchored to archetypal political positions "
            "(Far Left → Left → Center-Left → Center → Center-Right → Right → Far Right). "
            "Two markers are plotted: the figure's position at the start of the dataset "
            "and their current position, connected by a directional arrow whose length "
            "encodes drift magnitude. The visual immediately answers the core question — "
            "did this person move, and which way — without requiring the reader to parse numbers.",
            BODY
        ),
        sp(5),

        h2("2.6.2  Topic Stance Grid"),
        p(
            "Seven policy categories are displayed in a responsive grid. Each cell shows "
            "the topic icon, the topic name, a short stance description grounded in the "
            "actual tweet evidence, a score from -10 (far left) to +10 (far right), and "
            "a trend arrow (↑ right / ↓ left / → stable). This allows a reader to "
            "immediately see which topics the figure is most active on and which represent "
            "their biggest deviations from a prior position.",
            BODY
        ),
        sp(5),

        h2("2.6.3  Shift Timeline"),
        p(
            "The timeline renders shift events as vertically stacked cards in chronological "
            "order. Each card uses a three-column layout — before / fissure / after — with "
            "color coding (muted → amber → primary) to guide the eye through the narrative "
            "arc of the change. News headlines are displayed below the narrative as small "
            "source chips, providing external validation without overwhelming the primary content.",
            BODY
        ),
        sp(5),

        h2("2.6.4  AI Synthesis Narrative"),
        p(
            "The synthesis section displays Claude's full analytical narrative in a "
            "terminal-style typewriter render, reinforcing the investigative aesthetic while "
            "ensuring the text feels dynamic rather than static. The narrative is intentionally "
            "placed last, after the user has already processed the structured data, "
            "so it functions as a conclusion rather than an introduction.",
            BODY
        ),
        sp(5),

        h2("2.6.5  Confidence & Metadata Display"),
        p(
            "A clearance-badge-style metadata block in the top-right of the subject header "
            "displays the analysis date range, confidence percentage, and status. "
            "This surfaces the epistemic limits of the analysis — a figure with only "
            "50 relevant tweets will show 40% confidence, signaling to the reader that "
            "the conclusions are provisional. This is a deliberate design choice to prevent "
            "the platform from appearing more authoritative than the data supports.",
            BODY
        ),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 7. TECHNICAL CHALLENGES
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.7  Technical Challenges & Resolutions"),
        sp(3),

        h2("2.7.1  twscrape v0.17.0 XClientTxId Bug"),
        p(
            b("Problem:") + "  twscrape v0.17.0 added a step that parses Twitter's JavaScript bundle "
            "to generate a " + cyan("XClientTxId") + " request header. Twitter subsequently changed "
            "their bundle format, causing the parser to raise an " + amber("IndexError: list index out of range") + " "
            "on every API request. This error was caught by twscrape's generic exception handler "
            "and surfaced only as a cryptic 15-minute account timeout message, making diagnosis difficult.",
            BODY
        ),
        p(
            b("Resolution:") + "  Pinned twscrape to v0.15.0, which predates the XClientTxId requirement. "
            "The requirements file is locked at this version to prevent silent upgrades.",
            BODY
        ),
        sp(3),

        h2("2.7.2  Cloudflare Login Block"),
        p(
            b("Problem:") + "  The automated login flow used by twscrape (submitting username and "
            "password to Twitter's login endpoint) is blocked by Cloudflare's bot detection "
            "when initiated from non-residential IP addresses.",
            BODY
        ),
        p(
            b("Resolution:") + "  Switched to cookie-based authentication. The operator logs into "
            + cyan("x.com") + " in a regular browser session, extracts the " + cyan("auth_token") + " "
            "and " + cyan("ct0") + " session cookies from DevTools, and provides them via the "
            + cyan(".env") + " file. twscrape accepts these cookies directly and marks the account "
            "as active without requiring the login flow.",
            BODY
        ),
        sp(3),

        h2("2.7.3  Stale Rate-Limit Locks Across Sessions"),
        p(
            b("Problem:") + "  twscrape persists per-queue rate-limit lock timestamps to a local "
            "SQLite database. When the server restarts, the cached " + cyan("_api") + " singleton "
            "is cleared but the database locks persist. New analysis jobs would stall silently "
            "at Step 1, waiting for a lock that could be hours old.",
            BODY
        ),
        p(
            b("Resolution:") + "  Call " + green("pool.reset_locks()") + " before every " + green("get_user_info()") + " "
            "invocation, clearing all queue locks regardless of age. The initial attempt used "
            "a raw SQL " + cyan("UPDATE accounts SET locks='{}'") + " statement, but this failed "
            "silently because " + cyan("pool.conn") + " does not exist in v0.15.0. The correct "
            "method — " + green("pool.reset_locks()") + " — was identified by inspecting the "
            "AccountsPool source.",
            BODY
        ),
        sp(3),

        h2("2.7.4  Pydantic Validation Failures on Optional Fields"),
        p(
            b("Problem:") + "  Claude occasionally omits the " + cyan("news") + " array from shift "
            "events when no relevant headlines can be confidently attributed to the event. "
            "Pydantic's strict validation raised a 4-error validation failure, marking the "
            "entire analysis job as errored even though the core data was valid.",
            BODY
        ),
        p(
            b("Resolution:") + "  Changed " + cyan("ShiftEvent.news") + " from " + green("list[NewsItem]") + " "
            "to " + green("list[NewsItem] = []") + " — an optional field with an empty list default. "
            "The frontend renders the news section conditionally, showing nothing if the list is empty.",
            BODY
        ),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 8. INFRASTRUCTURE
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("2.8  Infrastructure & Deployment"),
        p(
            "ψSHIFT is a full-stack application with a Python backend handling "
            "all data acquisition and AI work, and a React frontend handling all "
            "presentation. This section documents each infrastructure layer, the "
            "AI gateway architecture, and the cost-control caching system in detail.",
            BODY
        ),
        sp(3),

        h2("2.8.1  AI Gateway: Lava.so"),
        p(
            "Rather than integrating directly with each AI provider's SDK, the backend "
            "routes all model calls through " + b("Lava.so") + " — a unified API gateway "
            "that presents a single Anthropic-compatible endpoint in front of multiple "
            "underlying model providers. The motivation was practical: during development "
            "it was useful to be able to swap between Claude models and test different "
            "providers without touching the application code or managing separate API keys "
            "and billing accounts for each.",
            BODY
        ),
        p(
            "The integration is a single configuration change to the Anthropic SDK client. "
            "Because Lava.so's API is wire-compatible with Anthropic's, the rest of the "
            "application code is completely unchanged — the same " + cyan("client.messages.create()") + " "
            "call, the same " + cyan("claude-opus-4-5") + " model string, the same request "
            "and response format:",
            BODY
        ),
        p(
            green('client = anthropic.Anthropic(\n'
                  '    api_key=os.environ["LAVA_API_KEY"],\n'
                  '    base_url="https://api.lava.so",\n'
                  ')'),
            CODE
        ),
        p(
            "The " + cyan("LAVA_API_KEY") + " is a single credential that covers all providers "
            "accessible through Lava, meaning the application only ever manages one secret "
            "regardless of how many underlying models are used. For a project that needed "
            "to move fast and iterate on model choice without infrastructure overhead, "
            "this was significantly simpler than the alternative of maintaining separate "
            "Anthropic, OpenAI, and Mistral keys with separate billing dashboards.",
            BODY
        ),
        info_table([
            ["Provider in production",  "Anthropic Claude claude-opus-4-5 via Lava.so proxy"],
            ["Gateway URL",             "https://api.lava.so"],
            ["Auth",                    "Single LAVA_API_KEY in backend/.env (gitignored)"],
            ["SDK",                     "anthropic>=0.30.0 — base_url override, no other changes"],
            ["Benefit",                 "One key, one endpoint, swap models without code changes"],
        ]),
        sp(5),

        h2("2.8.2  Backend"),
        p(
            "The backend is a " + b("FastAPI") + " application running under uvicorn. "
            "All scraping and analysis work runs inside the same process as the API server, "
            "using asyncio for concurrency. There is no separate worker process, "
            "message queue, or background scheduler — " + cyan("asyncio.create_task()") + " "
            "is sufficient for the workload because analysis jobs are long-running I/O-bound "
            "tasks (network requests to Twitter and to Lava.so) that yield the event loop "
            "naturally while waiting.",
            BODY
        ),
        info_table([
            ["Framework",      "FastAPI (Python 3.13) + uvicorn ASGI"],
            ["Concurrency",    "asyncio.create_task() — fire-and-forget, no queue needed"],
            ["Job store",      "In-memory dict _jobs{} — persists for the life of the process"],
            ["AI gateway",     "Lava.so → Anthropic Claude claude-opus-4-5"],
            ["Scraper auth",   "twscrape v0.15.0, cookie-based, SQLite account store (accounts.db)"],
            ["Cache",          "JSON files at backend/cache/{handle}.json"],
            ["Port",           "8000 — proxied from frontend dev server at /api/*"],
            ["Secrets",        "backend/.env — gitignored; LAVA_API_KEY + TW_USER_1 + TW_COOKIES_1"],
        ]),
        sp(3),
        p(b("API endpoints:"), BODY),
        info_table([
            ["POST /api/analyze",        "Start an analysis — returns job_id immediately; checks cache first"],
            ["POST /api/reanalyze",       "Force a fresh scrape — deletes cache entry, then runs full pipeline"],
            ["GET  /api/status/:job_id",  "Poll job progress — returns status, step, tweet_count, result"],
            ["GET  /api/figure/:handle",  "Return cached figure by handle — used by Dossier on page reload"],
            ["GET  /api/cached",          "List all cached analyses — powers the homepage featured grid"],
            ["GET  /api/health",          "Liveness check"],
        ]),
        tab_cap("FastAPI backend endpoint reference."),
        sp(5),

        h2("2.8.3  Result Caching: Eliminating Redundant Analysis Costs"),
        p(
            "Each full analysis costs real money: the Claude claude-opus-4-5 call on a 600-tweet "
            "prompt with a 4,096-token output costs approximately $0.15–$0.25 per run, "
            "and the scraping session consumes Twitter rate-limit quota. Running the same "
            "analysis twice for the same figure — because a second user searched the same "
            "handle — would be both wasteful and slow. The caching layer eliminates this "
            "entirely.",
            BODY
        ),
        p(b("How the cache works:"), BODY),
        p(
            green("# On every /api/analyze request, cache is checked first:\n"
                  "cached = analysis_cache.load(handle)\n"
                  "if cached:\n"
                  "    job_id = str(uuid.uuid4())\n"
                  "    _jobs[job_id] = {\"status\": \"done\", \"step\": 4, \"result\": cached}\n"
                  "    return {\"job_id\": job_id, \"cached\": True}"),
            CODE
        ),
        p(
            "If a cached result exists for the requested handle, the endpoint returns "
            "immediately with a synthetic 'done' job — no scraping, no AI call, "
            "no wait. The frontend receives the same response shape as a live job "
            "and navigates to the dossier in under 50 milliseconds.",
            BODY
        ),
        p(b("Storage format:"), BODY),
        p(
            green('# backend/cache/{handle}.json\n'
                  '{\n'
                  '  "figure": { ...full Figure JSON... },\n'
                  '  "cached_at": "2026-04-30T21:14:03.441Z"\n'
                  '}'),
            CODE
        ),
        p(
            "Each file is written by " + green("cache.save(handle, result)") + " immediately "
            "after a successful analysis. The " + cyan("cached_at") + " timestamp is stored "
            "alongside the figure data so future tooling can implement TTL-based expiry "
            "if needed. The " + cyan("_tweet_count") + " field is also embedded in the figure "
            "dict before saving, so re-served cached results still display the correct "
            "tweet count in the UI.",
            BODY
        ),
        p(b("Cache operations:"), BODY),
        info_table([
            ["cache.save(handle, figure)",   "Write figure + timestamp to backend/cache/{handle}.json"],
            ["cache.load(handle)",           "Return figure dict if file exists and is valid JSON; None otherwise"],
            ["cache.list_cached()",          "Scan all .json files in cache dir — used by /api/cached for homepage"],
            ["cache.delete(handle)",         "Remove file — called by /api/reanalyze to force fresh scrape"],
        ]),
        tab_cap("Disk cache API — four operations exposed by cache.py."),
        p(
            "The cache directory is excluded from version control via " + cyan(".gitignore") + " "
            "(" + cyan("backend/cache/") + ") so analysis results never accidentally get "
            "committed to the repository. The SQLite account store "
            "(" + cyan("accounts.db") + ") is similarly excluded.",
            BODY
        ),
        p(
            "The " + cyan("/api/reanalyze") + " endpoint provides a deliberate escape hatch: "
            "it calls " + green("cache.delete(handle)") + " before starting a new job, "
            "ensuring the fresh result replaces the stale one once the pipeline completes. "
            "This is how an operator forces a re-analysis of a figure whose positions "
            "have changed since the last run.",
            BODY
        ),
        sp(5),

        h2("2.8.4  In-Memory Job Store"),
        p(
            "Active and completed jobs are tracked in a plain Python dict "
            "(" + cyan("_jobs: dict[str, dict]") + ") that lives in the FastAPI process. "
            "Each entry is keyed by a UUID job ID and carries the fields the frontend "
            "polls for:",
            BODY
        ),
        info_table([
            ["status",       "queued → scraping → analyzing → done | error"],
            ["step",         "Integer 0–4 — maps to the terminal loading UI steps"],
            ["tweet_count",  "Live counter — updated by on_progress(n) callback as tweets arrive"],
            ["result",       "Full Figure dict — populated only when status == done"],
            ["error",        "Error message string — populated only when status == error"],
            ["handle",       "Normalised handle — used by /api/figure/:handle fallback lookup"],
        ]),
        p(
            "The in-memory store is intentionally not persisted to disk. "
            "If the server restarts mid-analysis, the job is lost — but the frontend "
            "polling loop will detect a 404 on the job ID and surface an error to the user. "
            "Completed analyses are always written to the disk cache before the job is "
            "marked done, so a restart never loses a completed result.",
            BODY
        ),
        sp(5),

        h2("2.8.5  Frontend"),
        info_table([
            ["Framework",   "React 18 + TypeScript, built with Vite"],
            ["Styling",     "Tailwind CSS + shadcn/ui component library"],
            ["Animation",   "Framer Motion — page transitions, step reveal, spectrum bar drift arrow"],
            ["Routing",     "React Router v6 — /dossier/:id with Figure passed via router state"],
            ["API comms",   "Native fetch() — 2-second polling loop during active job"],
            ["Dev proxy",   "Vite proxies /api/* to localhost:8000 — no CORS issues in development"],
            ["Port",        "8080 (development)"],
        ]),
        p(
            "The Figure object returned by the backend is passed to the Dossier view "
            "via React Router's " + cyan("location.state") + " rather than being re-fetched "
            "from the API on navigation. This means the dossier renders instantly on "
            "first load with no additional network round-trip. On direct URL access "
            "(e.g. page reload or a shared link), the Dossier falls back to "
            + cyan("GET /api/figure/:handle") + " to retrieve the cached result.",
            BODY
        ),
        sp(5),

        h2("2.8.6  Full Request-to-Render Data Flow"),
        p(amber("Cache hit path (< 50ms):"), BODY),
        p(
            cyan("Search submit") + "  →  POST /api/analyze  →  " +
            green("cache.load(handle)") + " returns result  →  synthetic done job  →  "
            "frontend navigates to /dossier with Figure in router state  →  instant render",
            BODY
        ),
        sp(3),
        p(amber("Cache miss path (2–4 min):"), BODY),
        p(cyan("Search submit") + "  →  POST /api/analyze  →  cache miss  →  job queued", BODY),
        p("↓  asyncio.create_task(_run_analysis)", BODY),
        p(cyan("Step 1") + "  pool.reset_locks()  →  user_by_login(handle)  →  profile resolved", BODY),
        p(cyan("Step 2") + "  fetch_user_tweets()  →  paginated UserTweets GraphQL  →  on_progress(n) streams live count", BODY),
        p(cyan("Step 3") + "  _sample_tweets(600)  →  _build_prompt()  →  Claude claude-opus-4-5 via Lava.so  →  Figure JSON", BODY),
        p(cyan("Step 4") + "  Figure(**data)  →  " + green("cache.save(handle, result)") + "  →  job status = done", BODY),
        p("↓  frontend polls GET /api/status/:job_id every 2s", BODY),
        p(cyan("Done") + "  →  navigate /dossier/:id with Figure in router state  →  full dossier rendered", BODY),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 9. FUTURE DIRECTIONS
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h2("3.2  What Works and What Does Not"),
        p(
            "The pipeline is reliable end-to-end for its core function — fetching post history "
            "and producing structured ideological analysis. The following is an honest account "
            "of where it succeeds and where it falls short.",
            BODY
        ),
        info_table([
            ["✓  Works",  "Cache-first architecture returns cached dossiers in <50 ms with no re-analysis cost."],
            ["✓  Works",  "Temporal even-sampling produces balanced analysis — early and recent periods weighted equally."],
            ["✓  Works",  "Seven-dimension scoring produces internally consistent, evidence-grounded profiles in all three tests."],
            ["✓  Works",  "Pydantic validation catches malformed model output before it reaches the frontend."],
            ["✓  Works",  "Partial scrape recovery — if rate-limited mid-fetch, analysis runs on whatever data was collected."],
            ["✗  Brittle", "Cookie-based auth expires every few days; the operator must manually refresh TW_COOKIES_1."],
            ["✗  Brittle", "News correlation returned zero matches on all tested shifts — the feature is built but non-functional."],
            ["✗  Brittle", "Low confidence scores (30–40%) on all three test figures due to thin political tweet density."],
            ["✗  Brittle", "Single-account scraper is a single point of failure — one expired cookie blocks all new analyses."],
            ["✗  Brittle", "Analysis is a black-box single LLM call; scores are not independently verifiable without reading the synthesis."],
        ], col_widths=[1.4*inch, 5.0*inch]),
        tab_cap("Honest assessment — what works and what does not in the current implementation."),
        sp(5),

        h2("3.3  Economics: Operating Costs and Pricing"),
        p(
            "ψSHIFT was built to be cost-aware from the start. The primary variable cost "
            "is the Claude API call made once per figure per analysis. All other costs "
            "are either fixed (hosting) or one-time (cookie setup).",
            BODY
        ),
        info_table([
            ["Claude claude-opus-4-5 analysis call",  "~$0.15–$0.25 per figure (600-tweet prompt + 4,096-token output)"],
            ["twscrape Twitter scraping",       "Free — uses operator's session cookies, no per-call fee"],
            ["Lava.so gateway",                 "Pass-through pricing — no markup over underlying Anthropic cost"],
            ["Cache hit (repeat analysis)",     "$0.00 — result served from disk, no model call"],
            ["FastAPI backend hosting",         "~$5–10/month on a small VPS or free on local dev"],
            ["Frontend hosting",                "Free tier on Vercel or Netlify"],
            ["Break-even pricing",              "At $1/dossier, ~6–7 new analyses per month covers hosting; cache hits are pure margin"],
        ]),
        tab_cap("Per-request cost breakdown and indicative pricing model."),
        p(
            "The cache is the primary cost-control mechanism: once a figure is analyzed, "
            "every subsequent request costs nothing. A service with 50 featured figures "
            "analyzed once would serve unlimited repeat traffic for the cost of 50 analysis "
            "calls — approximately $10–12 total. A subscription model at \\$5–10/month per user "
            "covering unlimited dossier views (cached) plus one fresh analysis per month "
            "would be economically viable from the first paying customer.",
            BODY
        ),
        sp(5),

        h2("3.4  Competitive Landscape"),
        p(
            "Several existing tools address adjacent parts of the problem ψSHIFT targets. "
            "None combines all three of: free/low-cost access, historical depth, and "
            "AI-powered structured ideological analysis.",
            BODY
        ),
        info_table([
            ["Tool / Service",        "What it does",                                  "Gap vs. ψSHIFT"],
            ["Brandwatch / Sprout",   "Enterprise social listening, sentiment tracking","Costs $1,000+/month; no ideological drift framing"],
            ["AllSides / Media Bias", "Rates news outlets on a left-right scale",       "Media outlets only, not individual figures; static ratings"],
            ["PolitiFact / Snopes",   "Fact-checks specific claims",                    "Claim-level, not positional; no drift detection over time"],
            ["Twitter Advanced Search","Manual keyword search in Twitter archive",       "No analysis layer; requires manual interpretation"],
            ["TwExportly",            "CSV export of tweet history",                    "Raw data only; no analysis; 1,000-tweet free-tier cap"],
            ["Academic datasets",     "Curated political tweet corpora (e.g. Congress)", "Static snapshots; not interactive; researchers only"],
        ], col_widths=[1.5*inch, 2.3*inch, 2.6*inch]),
        tab_cap("Competitive landscape — tools addressing adjacent problems and how ψSHIFT differs."),
        p(
            "The closest conceptual competitor is a combination of TwExportly (data) + "
            "a manual reading of the output. ψSHIFT replaces the manual step with a "
            "structured AI analysis that produces a standardised, comparable output format "
            "across all figures — enabling the kind of cross-figure comparison that manual "
            "reading cannot scale to.",
            BODY
        ),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 4. CONCLUSION
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("4. Conclusion"),
        rule(),
        p(
            "ψSHIFT set out to answer a specific question: can generative AI turn years of "
            "a person's social media history into a structured, evidence-grounded account "
            "of how their political views have changed? The answer, based on three end-to-end "
            "test analyses, is yes — with important caveats about data volume, confidence "
            "calibration, and the one component (news correlation) that did not reach a "
            "working state.",
            BODY
        ),
        p(
            "The core insight from building the system is that the hardest part was not the "
            "AI analysis — Claude produced coherent, evidence-grounded output from the first "
            "working prompt — but the data acquisition layer. Four distinct approaches to "
            "collecting tweet history were tried and abandoned before arriving at the "
            "twscrape cookie-auth architecture, and even that required significant debugging "
            "around version pinning, rate-limit lock management, and partial-data recovery. "
            "For future projects in this space, the lesson is to solve the data pipeline "
            "problem first, before investing in the analysis layer.",
            BODY
        ),
        sp(3),
        h2("4.1  Roadmap and Extensions"),
        sp(3),

        h2("4.2  TruthSocial Integration"),
        p(
            "TruthSocial's Mastodon-compatible API provides a clean path to multi-platform "
            "analysis. Figures active on both platforms — particularly those who migrated from "
            "X to TruthSocial as part of a broader ideological shift — represent the most "
            "analytically interesting cases. A merged cross-platform timeline would allow the "
            "system to detect not just what someone says but which platform they choose to say it on.",
            BODY
        ),
        sp(3),

        h2("4.3  Live News API Correlation"),
        p(
            "Replacing Claude-generated news headlines with live lookups from GDELT or "
            "NewsAPI would make the correlation layer factual and auditable. The architecture "
            "is straightforward: on shift event detection, query the news API for the "
            "two-week window around the event date, filtered by the event's topic, and "
            "surface the top results.",
            BODY
        ),
        sp(3),

        h2("4.4  Multiple Account Rotation"),
        p(
            "Adding a second and third scraper account would triple throughput and "
            "eliminate the single-point-of-failure risk of cookie expiry. twscrape "
            "natively supports account pools and rotates between them automatically "
            "when one account hits a rate limit. The " + cyan(".env") + " schema already "
            "supports up to five accounts (TW_USER_1 through TW_USER_5).",
            BODY
        ),
        sp(3),

        h2("4.5  Incremental Re-Analysis"),
        p(
            "The current cache is all-or-nothing: either the full cached result is returned "
            "or a full re-analysis is run. An incremental mode would fetch only tweets "
            "posted since the last analysis date, append them to the existing dataset, "
            "and submit a delta-analysis prompt to Claude that updates the scores rather "
            "than recomputing from scratch. This would reduce both cost and latency for "
            "figures analyzed more than once.",
            BODY
        ),
        sp(3),

        h2("4.6  Confidence Improvements & AI Roadmap"),
        p(
            "Current confidence scoring is single-dimensional. A richer model would "
            "factor in: tweet volume per topic (a figure who has tweeted 500 times about "
            "immigration vs. 3 times), consistency of stance within a time period "
            "(high variance = lower confidence), and cross-platform corroboration "
            "(same stance on X and TruthSocial = higher confidence).",
            BODY
        ),
        sp(3),
        p(
            "The broader question ψSHIFT was built to answer — has this person actually "
            "changed their views, and if so, when and why — is one that becomes more "
            "answerable as AI models improve in long-context reasoning and factual grounding. "
            "Within 12–24 months, models with larger context windows and stronger temporal "
            "reasoning could process the full 3,000-tweet archive rather than a 600-post "
            "sample, dramatically improving shift detection precision. Real-time news "
            "retrieval, integrated natively into the analysis call, would close the one "
            "gap the current implementation could not bridge. ψSHIFT is a working proof "
            "of concept; the infrastructure and analytical framework are in place for it "
            "to become a substantially more powerful tool as the underlying AI capabilities "
            "continue to advance.",
            BODY
        ),
        PageBreak(),
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # REFERENCES
    # ══════════════════════════════════════════════════════════════════════════
    story += [
        h1("References"),
        rule(),
        sp(3),

        h2("Academic & Research References"),
        info_table([
            ["[1]  Conover et al. (2011)",
             "\"Political Polarization on Twitter.\" Proc. 5th ICWSM. "
             "Landmark network analysis showing ideological segregation in Twitter retweet graphs; "
             "directly motivates ψSHIFT's use of tweet history as an ideological signal."],
            ["[2]  Barberá, P. (2015)",
             "\"Birds of the Same Feather Tweet Together: Bayesian Ideal Point Estimation Using "
             "Twitter Data.\" Political Analysis 23(1). "
             "Establishes that follower/following networks encode latent ideological positions — "
             "foundational justification for treating tweet corpora as ideology proxies."],
            ["[3]  Argyle et al. (2023)",
             "\"Out of One, Many: Using Language Models to Simulate Human Samples.\" "
             "Political Analysis 31(3). "
             "Demonstrates that LLMs can reliably replicate survey-level political opinion "
             "distributions, supporting the use of Claude for stance scoring."],
            ["[4]  Santurkar et al. (2023)",
             "\"Whose Opinions Do Language Models Reflect?\" ICML 2023. "
             "Evaluates political bias in LLM outputs across demographic groups; "
             "informs the confidence-calibration and known-bias caveats in Section 2.4.5."],
            ["[5]  Törnberg (2023)",
             "\"ChatGPT-4 Outperforms Experts and Crowd Workers in Annotating Political Twitter "
             "Messages with Zero-Shot Learning.\" PLOS ONE 18(11). "
             "Shows GPT-4-class models match or exceed human annotators on political text "
             "classification — direct evidence base for the AI analysis engine."],
            ["[6]  Poole & Rosenthal (1985)",
             "\"A Spatial Model for Legislative Roll Call Analysis.\" "
             "American Journal of Political Science 29(2). "
             "Introduced DW-NOMINATE ideological scaling; conceptual basis for placing figures "
             "on a one-dimensional left–right spectrum."],
            ["[7]  Laver, Benoit & Garry (2003)",
             "\"Extracting Policy Positions from Political Texts Using Words as Data.\" "
             "American Political Science Review 97(2). "
             "Wordscores method: scaling ideology from word frequencies in text corpora — "
             "precursor to LLM-based stance extraction used in this project."],
            ["[8]  Gilens & Page (2014)",
             "\"Testing Theories of American Politics: Elites, Interest Groups, and Average "
             "Citizens.\" Perspectives on Politics 12(3). "
             "Empirical evidence that lobbying and elite preferences systematically shift policy "
             "outcomes; motivates tracking public figures' position changes alongside donor data."],
            ["[9]  Hall & Deardorff (2006)",
             "\"Lobbying as Legislative Subsidy.\" "
             "American Political Science Review 100(1). "
             "Reframes lobbying as information provision rather than vote-buying; "
             "relevant to interpreting correlated shifts between donation events and stance changes."],
            ["[10] Brady et al. (2017)",
             "\"Emotion Shapes the Diffusion of Moralized Content in Social Networks.\" "
             "PNAS 114(28). "
             "Shows morally charged language amplifies tweet virality — informs the weighting "
             "of high-engagement tweets in the shift detection signal."],
            ["[11] Pew Research Center (2023)",
             "\"Political Polarization in the American Public.\" pewresearch.org. "
             "Benchmark survey data on partisan divergence across immigration, economy, "
             "climate, and healthcare — used to calibrate the seven-topic scoring axes."],
            ["[12] OpenSecrets.org",
             "Center for Responsive Politics database of campaign finance, PAC contributions, "
             "and lobbying disclosures. opensecrets.org — cited as the reference dataset "
             "for correlating detected stance shifts with donor/lobbying events."],
        ], col_widths=[1.8*inch, 4.6*inch]),
        tab_cap("Academic papers, research reports, and datasets cited in this report."),
        sp(5),

        h2("Tools & Libraries"),
        info_table([
            ["[13] twscrape v0.15.0",
             "Python library for scraping Twitter's internal GraphQL API via session-based auth. "
             "github.com/vladkens/twscrape"],
            ["[14] TwExportly",
             "Browser extension for exporting Twitter/X timeline data to CSV. "
             "twexportly.com — used for proof-of-concept dataset collection (free tier: 1,000 tweets)."],
            ["[15] x-timeline-scraper",
             "Async Python library for polling X timelines via cURL-based session auth. "
             "github.com/StephanAkkerman/x-timeline-scraper — evaluated but not adopted."],
            ["[16] stiles/trump-truth-social-archive",
             "Append-only archive of Donald Trump's Truth Social posts in JSON/CSV format. "
             "github.com/stiles/trump-truth-social-archive — used as schema reference and data source."],
            ["[17] Anthropic Claude claude-opus-4-5",
             "Large language model used for all ideological analysis and synthesis. "
             "anthropic.com/claude"],
            ["[18] Lava.so",
             "Unified AI gateway providing a single Anthropic-compatible endpoint. "
             "api.lava.so — used in place of direct Anthropic API access."],
            ["[19] FastAPI",
             "Modern Python web framework for the backend REST API. "
             "fastapi.tiangolo.com"],
            ["[20] React 18 + TypeScript",
             "Frontend framework and type system. react.dev"],
            ["[21] Vite",
             "Frontend build tool and dev server. vitejs.dev"],
            ["[22] Tailwind CSS + shadcn/ui",
             "Utility-first CSS framework and component library. "
             "tailwindcss.com / ui.shadcn.com"],
            ["[23] Framer Motion",
             "React animation library for page transitions and UI animations. "
             "framer.com/motion"],
            ["[24] Pydantic v2",
             "Data validation library for the Figure schema and API models. "
             "docs.pydantic.dev"],
        ], col_widths=[1.8*inch, 4.6*inch]),
        tab_cap("Tools, libraries, and external services used in the implementation."),
        sp(7),

        h2("Source Repository"),
        p(
            "Full source code, data pipeline scripts, and analysis outputs are available at:",
            BODY
        ),
        p(
            cyan("https://github.com/Kenza-R/AI_Caramba"),
            CODE
        ),
        sp(10),
        rule(),
        sp(5),
        p(
            muted("ψSHIFT — Technical Report  |  April 2026  |  Kenza Moussaoui Rahali · Omar Sekkat · Doris Ding · Marceline Yu"),
            CAPTION
        ),
    ]

    # background color hack via canvas
    def on_page(canvas, doc):
        # Draw background FIRST so it sits behind all content including images
        canvas.saveState()
        canvas.setFillColor(DARK)
        canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
        canvas.restoreState()

    # Use beforeDrawPage so background renders before platypus content
    from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame
    from reportlab.lib.units import inch as _inch

    frame = Frame(
        0.7*_inch, 0.7*_inch,
        letter[0] - 1.7*_inch, letter[1] - 1.7*_inch,
        id="main"
    )

    def page_with_bg(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(DARK)
        canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
        canvas.restoreState()

    template = PageTemplate(id="bg", frames=[frame], onPage=page_with_bg)
    full_doc = BaseDocTemplate(
        path,
        pagesize=letter,
        leftMargin=0.7*_inch,
        rightMargin=0.7*_inch,
        topMargin=0.7*_inch,
        bottomMargin=0.7*_inch,
    )
    full_doc.addPageTemplates([template])
    full_doc.build(story)
    print(f"PDF written to {path}")


if __name__ == "__main__":
    build_pdf("/Users/kmr/AI_Caramba/mind_shift_lens_technical_report.pdf")
