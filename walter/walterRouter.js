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

  const handleWalterCommand = require("./index");

if (
  command === "wsearch" ||
  command === "wexplain" ||
  command === "wsummary" ||
  command === "wsearchr"
) {
  const query = args.slice(1).join(" ");

  if (detectDrama(query)) {
    await message.channel.send(refusalResponse());
    return true;
  }

  // hand off to the real handler
  return await handleWalterCommand(message, args);
}

  return false;
}

module.exports = {
  isWalterCommand,
  handleWalterCommand
};
