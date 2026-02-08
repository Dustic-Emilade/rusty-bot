// walterPersonality.js

function refusalResponse() {
  const options = [
    "uhm… I don’t really wanna get into that.",
    "that feels like drama. sorry.",
    "I’m probably not the guy for this one.",
    "I think I’ll sit this out."
  ];

  return options[Math.floor(Math.random() * options.length)];
}

function neutralPreface() {
  const options = [
    "From what I can tell,",
    "Generally speaking,",
    "Most sources describe it as",
    "It’s usually explained like this:"
  ];

  return options[Math.floor(Math.random() * options.length)];
}

module.exports = {
  refusalResponse,
  neutralPreface
};
