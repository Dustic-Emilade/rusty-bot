// ─── Walter AI Router ───
if (isWalterCommand(content)) {
  const handled = await handleWalterCommand(message);
  if (handled) return;
}
// walterRouter.js

const { DRAMA_KEYWORDS } = require("./walterRules");
const { refusalResponse } = require("./walterPersonality");

function isWalterCommand(content) {
  return content.startsWith("w");
}

function detectDrama(query) {
  const lower = query.toLowerCase();
  return DRAMA_KEYWORDS.some(word => lower.includes(word));
}

async function handleWalterCommand(message) {
  const content = message.content.trim();
  const args = content.split(" ");
  const command = args[0];

  if (command === "wsearch" || command === "wexplain" || command === "wsummary" || command === "wsearchr") {
    const query = args.slice(1).join(" ");

    if (detectDrama(query)) {
      await message.channel.send(refusalResponse());
      return true;
    }

    // Placeholder response for now
    await message.channel.send(
      "…I’m still figuring out how to explain things. Check back soon."
    );
    return true;
  }

  return false;
}

module.exports = {
  isWalterCommand,
  handleWalterCommand
};
