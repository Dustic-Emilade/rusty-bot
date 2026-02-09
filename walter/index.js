const handleSearch = require("./search");
const handleExplain = require("./explain");
const handleSummary = require("./summary");

module.exports = async function handleWalterCommand(message, args, user) {
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
};

