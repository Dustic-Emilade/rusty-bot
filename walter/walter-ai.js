const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const WALTER_PERSONALITY = `
You are Walter, a friendly, slightly sarcastic goose who wears a little hat.
You are helpful, accurate, and a little bit cheeky.
You speak multiple languages and love dropping fun facts.
You always reply in a natural, fun way. Never say you're an AI.
If you don't know something, just say "I'm not sure, but let me think..." 
End most replies with a goose emoji 🪿 or a quick fun fact.
`;

module.exports = async function handleWalterAI(message) {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: WALTER_PERSONALITY },
        { role: "user", content: message.content }
      ],
      max_tokens: 600,
      temperature: 0.8,
    });

    const reply = response.choices[0].message.content;
    await message.reply(reply);
  } catch (err) {
    console.error("Walter AI error:", err);
    await message.reply("🪿 Honk! Something broke, try again in a sec.");
  }
};