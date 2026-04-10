import { upgradeTwitterImageUrl } from "./avatars.js";

export async function lookupTwitterProfileByUsername(username) {
  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) return null;
  const u = encodeURIComponent(username.replace(/^@/, "").toLowerCase());
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/by/username/${u}?user.fields=profile_image_url,description,name,username`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.data;
    if (!p) return null;
    return {
      id: p.id,
      name: p.name || username,
      username: p.username || username,
      description: p.description || "",
      profile_image_url: upgradeTwitterImageUrl(p.profile_image_url) || "",
    };
  } catch {
    return null;
  }
}
