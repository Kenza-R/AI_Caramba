import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile } from "fs/promises";

const ANTHROPIC_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const LAVA_BASE = process.env.LAVA_BASE_URL || "https://api.lava.so/v1/forward";
const ANTHROPIC_UPSTREAM = "https://api.anthropic.com/v1/messages";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonObject(text) {
  let t = String(text || "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function extractJsonArray(text) {
  let t = String(text || "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function getProvider() {
  if (process.env.LAVA_API_KEY) return "lava_anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

async function callLavaAnthropic(messages, maxTokens) {
  const key = process.env.LAVA_API_KEY;
  if (!key) throw new Error("LAVA_API_KEY is not set");
  const u = `${LAVA_BASE}?u=${encodeURIComponent(ANTHROPIC_UPSTREAM)}`;
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: Math.min(maxTokens ?? 8192, 8192),
    messages,
  };
  const res = await fetch(u, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lava Anthropic ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

async function callGeminiText(system, user, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = `${system}\n\nUser input:\n${user}\n\nReturn JSON only.`;
  const r = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: Math.min(maxTokens ?? 8192, 8192),
      responseMimeType: "application/json",
    },
  });
  return r.response.text();
}

async function callAnthropicText(system, user, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return (msg.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const VISION_SYSTEM = `You are looking at a screenshot of a Twitter/X (or Truth Social) profile page. Extract every visible tweet or post as structured JSON. For each post include: the text content, the date posted, and any visible engagement numbers (likes, retweets, replies). Return only a JSON array, no preamble, no markdown. Use objects shaped like: {"text":"","date":"","likes":0,"retweets":0,"replies":0}. If a field is missing use null or 0.`;

async function callGeminiVisionArray(pngBuffer) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const r = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: `${VISION_SYSTEM}\nExtract all visible posts as JSON array only.` },
          {
            inlineData: {
              mimeType: "image/png",
              data: pngBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });
  return r.response.text();
}

async function callAnthropicVisionArray(pngBuffer) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: VISION_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: pngBuffer.toString("base64"),
            },
          },
          { type: "text", text: "Extract all visible posts as JSON array only." },
        ],
      },
    ],
  });
  return (msg.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function callClaudeJson(system, user, opts = {}) {
  const maxTokens = opts.maxTokens ?? 8192;
  const provider = getProvider();
  if (!provider) throw new Error("Set LAVA_API_KEY (preferred) or GEMINI_API_KEY or ANTHROPIC_API_KEY");
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (provider === "lava_anthropic") {
        const msg = await callLavaAnthropic([{ role: "user", content: `${system}\n\n${user}\n\nReturn JSON only.` }], maxTokens);
        const text = (msg.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        return extractJsonObject(text);
      }
      const text =
        provider === "gemini"
          ? await callGeminiText(system, user, maxTokens)
          : await callAnthropicText(system, user, maxTokens);
      return extractJsonObject(text);
    } catch (e) {
      lastErr = e;
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

export async function callClaudeVisionExtractPosts(pngBuffer) {
  const provider = getProvider();
  if (!provider) throw new Error("Set LAVA_API_KEY (preferred) or GEMINI_API_KEY or ANTHROPIC_API_KEY");
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (provider === "lava_anthropic") {
        const msg = await callLavaAnthropic(
          [
            {
              role: "user",
              content: [
                { type: "text", text: `${VISION_SYSTEM}\nExtract all visible posts as JSON array only.` },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: pngBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          4096,
        );
        const text = (msg.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        return extractJsonArray(text);
      }

      const text =
        provider === "gemini"
          ? await callGeminiVisionArray(pngBuffer)
          : await callAnthropicVisionArray(pngBuffer);
      return extractJsonArray(text);
    } catch (e) {
      lastErr = e;
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

export async function callClaudeVisionExtractPostsFromFile(pngPath) {
  const buf = await readFile(pngPath);
  return callClaudeVisionExtractPosts(buf);
}

export const MODEL = process.env.LAVA_API_KEY
  ? `${ANTHROPIC_MODEL} via Lava`
  : process.env.GEMINI_API_KEY
    ? GEMINI_MODEL
    : ANTHROPIC_MODEL;
