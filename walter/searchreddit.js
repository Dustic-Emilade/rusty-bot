const fetch = require("node-fetch");

module.exports = async function (message, args) {
  const query = args.join(" ");
  if (!query) {
    await message.channel.send("Search Reddit for what?");
    return true;
  }

  const res = await fetch(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=3`
  );

  const data = await res.json();

  if (!data.data.children.length) {
    await message.channel.send("Reddit came up empty.");
    return true;
  }

  let reply = "**Top Reddit results:**\n";

  for (const post of data.data.children) {
    reply += `• ${post.data.title}\nhttps://reddit.com${post.data.permalink}\n\n`;
  }

  await message.channel.send(reply);
  return true;
};
