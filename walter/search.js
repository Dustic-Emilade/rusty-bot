const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Debug line – helps confirm the file loaded and key is present
console.log("=== wsearch handler LOADED ===");
console.log("GROQ key exists?", !!process.env.GROQ_API_KEY);
console.log("GROQ key preview:", process.env.GROQ_API_KEY?.slice(0, 8) || "MISSING");

module.exports = async function handleSearch(message, args) {
  const query = args.join(" ").trim();

  if (!query) {
    return message.reply("🪶 Um… what do you want me to look up?");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // active & recommended in Feb 2026

      messages: [
        {
          role: "system",
          content: `
You are Walter — shy, sweet, gentle, and helpful. 
You speak softly and warmly, and like to engage with kindness and care.
Give short, friendly, easy-to-understand summaries.
Use simple words. Be accurate. Include the most important facts.
Do not include raw links unless they are really needed and helpful.
End your answer gently if it feels natural.
          `
        },
        {
          role: "user",
          content: query
        }
      ],

      max_tokens: 600,
      temperature: 0.65,       // balanced – not too creative, not too robotic
    });

    const summary = response.choices[0].message.content.trim();

    await message.reply(`🪶 Okay, about **${query}**…\n\n${summary}`);
  } catch (err) {
    console.error("wsearch error:", err.message);
    console.error("Full error:", err);

    // User-friendly fallback reply
    await message.reply(
      "🪶 Ay no… something got stuck while I was looking that up. " +
      "Can you try again in a second? Sorry…"
    );
  }
};