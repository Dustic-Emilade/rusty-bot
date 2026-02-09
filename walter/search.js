const fetch = require("node-fetch");
const { ALLOWED_DOMAINS, BLOCKED_DOMAINS } = require("./walterRules");

function isAllowed(url) {
  if (!url) return false;

  const lower = url.toLowerCase();

  if (BLOCKED_DOMAINS.some(d => lower.includes(d))) return false;
  if (ALLOWED_DOMAINS.some(d => lower.includes(d))) return true;

  return false;
}

module.exports = async function (message, args) {
  const query = args.join(" ");
  if (!query) {
    await message.channel.send("You gotta give me something to search for.");
    return true;
  }

  await message.channel.send("🔍 Searching…");

  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`
  );

  const data = await res.json();

  const results = [];

  if (data.AbstractURL && isAllowed(data.AbstractURL)) {
    results.push({
      text: data.AbstractText,
      url: data.AbstractURL
    });
  }

  if (data.RelatedTopics) {
    for (const item of data.RelatedTopics) {
      if (item.FirstURL && isAllowed(item.FirstURL)) {
        results.push({
          text: item.Text,
          url: item.FirstURL
        });
      }
      if (results.length >= 3) break;
    }
  }

  if (results.length === 0) {
    await message.channel.send("I couldn’t find any solid sources for that.");
    return true;
  }

  let reply = "**Here’s what I found:**\n";
  for (const r of results) {
    reply += `• ${r.text}\n${r.url}\n\n`;
  }

  await message.channel.send(reply);
  return true;
};

