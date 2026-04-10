import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonArray(text) {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) {
    return JSON.parse(t.slice(start, end + 1));
  }
  throw new Error("Model did not return a JSON array");
}

const VISION_SYSTEM = `You are looking at a screenshot of a Twitter/X (or Truth Social) profile page. Extract every visible tweet or post as structured JSON. For each post include: the text content, the date posted, and any visible engagement numbers (likes, retweets, replies). Return only a JSON array, no preamble, no markdown. Use objects shaped like: {"text":"","date":"","likes":0,"retweets":0,"replies":0}. If a field is missing use null or 0.`;

/**
 * @param {Buffer} pngBuffer
 */
export async function callClaudeVisionExtractPosts(pngBuffer) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const base64 = pngBuffer.toString("base64");
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
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
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extract all visible posts as JSON array only.",
              },
            ],
          },
        ],
      });
      const text = (msg.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
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

/**
 * @param {string} system
 * @param {string} user
 * @param {{ maxTokens?: number }} opts
 */
export async function callClaudeJson(system, user, opts = {}) {
  const maxTokens = opts.maxTokens ?? 8192;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: key });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = (msg.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return extractJson(text);
    } catch (e) {
      lastErr = e;
      const wait = 800 * Math.pow(2, attempt);
      await sleep(wait);
    }
  }
  throw lastErr;
}

function extractJson(text) {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

export { MODEL };
