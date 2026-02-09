const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

module.exports = async function handleSearch(message, args) {
  const query = args.join(" ");
  if (!query) {
    return message.reply("🪶 What do you want me to look up?");
  }

  try {
    // This special Groq model does real web search + gives a clean summary automatically
    const response = await openai.chat.completions.create({
      model: "groq/compound",           // ← this one searches the web for you
      messages: [{ role: "user", content: query }],
      max_tokens: 700,
      temperature: 0.6,
    });

    const summary = response.choices[0].message.content;
    await message.reply(`🪶 Let me look that up for you...\n\n${summary}`);
  } catch (err) {
    console.error(err);
    await message.reply("🪶 Ay, the search got stuck… try again?");
  }
};