const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

module.exports = async function handleSearch(message, args) {
  const query = args.join(" ");
  if (!query) return message.reply("🪶 What do you want me to look up?");

  try {
    const response = await openai.chat.completions.create({
      model: "groq/compound",   // ← real web search + reasoning (no more links-only)
      messages: [
        { role: "system", content: "You are Walter. Give a short, friendly, accurate summary of the topic. Use simple language. Include key facts, no raw links unless helpful." },
        { role: "user", content: query }
      ],
      max_tokens: 600,
      temperature: 0.6,
    });

    const summary = response.choices[0].message.content;
    await message.reply(`🪶 Okay, about **${query}**:\n\n${summary}`);
  } catch (err) {
    console.error("wsearch error:", err.message);
    await message.reply("🪶 Ay, the search got stuck… try again?");
  }
};