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
      model: "llama-3.1-70b-versatile",   // ← fixed
      messages: [
        { role: "system", content: "You are Walter. Give a short, clear, friendly summary of the topic." },
        { role: "user", content: query }
      ],
      max_tokens: 600,
      temperature: 0.6,
    });

    const summary = response.choices[0].message.content;
    await message.reply(`🪶 Okay, here's what I know about **${query}**:\n\n${summary}`);
  } catch (err) {
    console.error("wsearch error:", err.message);
    await message.reply("🪶 Ay, the search got stuck… try again?");
  }
};