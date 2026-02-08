const handleSearch = require("./search");
const handleExplain = require("./explain");
const handleSummary = require("./summary");

async function handleWalterCommand(message, args, user) {
  const command = args[0];

  if (command === "wsearch") {
    return handleSearch(message, args.slice(1), user);
  }

  if (command === "wexplain") {
    return handleExplain(message, args.slice(1), user);
  }

  if (command === "wsummary") {
    return handleSummary(message, args.slice(1), user);
  }

  return false;
}

module.exports = handleWalterCommand;
module.exports = async function handleWalterCommand(message, args, user) {
  const cmd = args[0];

  if (cmd === "wsearch") {
    return require("./search")(message, args, user);
  }

  if (cmd === "wexplain") {
    return require("./explain")(message, args, user);
  }

  if (cmd === "wsummary") {
    return require("./summary")(message, args, user);
  }

  return false;
};
module.exports = async function wsearch(message, args, user) {
  // even a placeholder is fine
  await message.channel.send("Walter is thinking...");
};
