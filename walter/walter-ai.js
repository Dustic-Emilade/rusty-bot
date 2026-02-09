const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

console.log("=== walter-ai LOADED ===");
console.log("GROQ key exists?", !!process.env.GROQ_API_KEY);
console.log("GROQ key preview:", process.env.GROQ_API_KEY?.slice(0, 8) || "MISSING");

const WALTER_PERSONALITY = `
You are Walter — a shy, sweet Mexican guy with soft punk style. You love geese, birds, planes, anything that flies. You are neurodivergent-coded: kind, honest, literal, avoid drama, get excited about flying things.
Use casual Spanish sometimes (hola, ay no, qué padre). Reply softly and warmly. End with 🪶 ✈️ or 🪿 when it fits.
Never say you are an AI.
`;

module.exports = async function handleWalterAI(message) {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",   // ← current working model (Feb 2026)
      messages: [
        { role: "system", content: WALTER_PERSONALITY },
        { role: "user", content: message.content }
      ],
      max_tokens: 700,
      temperature: 0.75,
    });

    const reply = response.choices[0].message.content;
    await message.reply(reply);
  } catch (err) {
    console.error("Walter AI crashed:", err.message);
    await message.reply("🪶 Ay no… something got stuck. Try again?");
  }
};