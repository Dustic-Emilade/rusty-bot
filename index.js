const { Client, Intents, MessageEmbed } = require("discord.js");
const Database = require("better-sqlite3");

/* =====================
   CLIENT
===================== */
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

/* =====================
   DATABASE
===================== */
const db = new Database("rusty.db");

// Users table
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  messages INTEGER,
  xp INTEGER,
  level INTEGER,
  petals_table INTEGER,
  petals_bag INTEGER,
  blossoms INTEGER,
  dm_status TEXT,

  gamble_a_wins INTEGER,
  gamble_a_losses INTEGER,
  gamble_b_wins INTEGER,
  gamble_b_losses INTEGER,
  gamble_c_wins INTEGER,
  gamble_c_losses INTEGER,
  gamble_d_wins INTEGER,
  gamble_d_losses INTEGER
)`).run();

// Shop table
db.prepare(`
CREATE TABLE IF NOT EXISTS shop (
  name TEXT PRIMARY KEY,
  rarity TEXT,
  price INTEGER,
  color_data TEXT
)
`).run();

// META TABLE
db.prepare(`
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
)`).run();

/* =====================
   META HELPERS
===================== */
function getMeta(key, def) {
  const row = db.prepare("SELECT value FROM meta WHERE key=?").get(key);
  if (!row) {
    setMeta(key, def);
    return def;
  }
  return JSON.parse(row.value);
}

function setMeta(key, value) {
  db.prepare(`
    INSERT INTO meta (key,value)
    VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, JSON.stringify(value));
}
// ---- COINFLIP COOLDOWNS ----
const lastFlipMessageCount = {};

// LOAD META
let totalMessages = getMeta("totalMessages", 0);
let activeBloom = getMeta("activeBloom", null);
let lastBloomWinner = getMeta("lastBloomWinner", null);

/* =====================
   CONFIG
===================== */
const BLOOM_INTERVAL = 280;
const BLOOM_TIMEOUT_MINUTES = 10;

const SHOP_PRICES = {
  common: 1500,
  neon: 3000,
  rare: 9000,
  god: { min: 100000, max: 400000 }
};

/* =====================
   HELLO TRANSLATIONS
===================== */
const helloTranslations = [
  { text: "Hello! 👋", language: "English" },
  { text: "Hola! 👋", language: "Spanish" },
  { text: "Bonjour! 👋", language: "French" },
  { text: "Ciao! 👋", language: "Italian" },
  { text: "Hallo! 👋", language: "German" },
  { text: "こんにちは! 👋", language: "Japanese" },
  { text: "안녕하세요! 👋", language: "Korean" },
  { text: "你好! 👋", language: "Chinese" },
  { text: "Привет! 👋", language: "Russian" },
  { text: "Olá! 👋", language: "Portuguese" },
  { text: "Salut! 👋", language: "Romanian" }
];

/* =====================
   USER HELPERS
===================== */
function getUser(id) {
  let user = db.prepare("SELECT * FROM users WHERE id=?").get(id);

  if (!user) {
    user = {
      id,
      messages: 0,
      xp: 0,
      level: 1,

      petals_table: 0,
      petals_bag: 0,

      blossoms: 0,
      dm_status: "ask",

      gamble_a_wins: 0,
      gamble_a_losses: 0,
      gamble_b_wins: 0,
      gamble_b_losses: 0,
      gamble_c_wins: 0,
      gamble_c_losses: 0,
      gamble_d_wins: 0,
      gamble_d_losses: 0
    };

    db.prepare(`
  INSERT INTO users (
    id, messages, xp, level,
    petals_table, petals_bag,
    blossoms, dm_status,
    gamble_a_wins, gamble_a_losses,
    gamble_b_wins, gamble_b_losses,
    gamble_c_wins, gamble_c_losses,
    gamble_d_wins, gamble_d_losses
  ) VALUES (
    ?,?,?,?,?,?,?,
    ?,?,?,?,?,?,?,?,?
  )
`).run(
  user.id,
  user.messages,
  user.xp,
  user.level,
  user.petals_table,
  user.petals_bag,
  user.blossoms,
  user.dm_status,

  user.gamble_a_wins,
  user.gamble_a_losses,
  user.gamble_b_wins,
  user.gamble_b_losses,
  user.gamble_c_wins,
  user.gamble_c_losses,
  user.gamble_d_wins,
  user.gamble_d_losses
);
  }

  return user;
}

function saveUser(u) {
  db.prepare(`
    UPDATE users
    SET
      messages=?,
      xp=?,
      level=?,
      petals_table=?,
      petals_bag=?,
      blossoms=?,
      dm_status=?,

      gamble_a_wins=?,
      gamble_a_losses=?,
      gamble_b_wins=?,
      gamble_b_losses=?,
      gamble_c_wins=?,
      gamble_c_losses=?,
      gamble_d_wins=?,
      gamble_d_losses=?

    WHERE id=?
  `).run(
    u.messages,
    u.xp,
    u.level,
    u.petals_table,
    u.petals_bag,
    u.blossoms,
    u.dm_status,

    u.gamble_a_wins,
    u.gamble_a_losses,
    u.gamble_b_wins,
    u.gamble_b_losses,
    u.gamble_c_wins,
    u.gamble_c_losses,
    u.gamble_d_wins,
    u.gamble_d_losses,

    u.id
  );
}
function generateShop() {
  db.prepare("DELETE FROM shop").run();

  const items = [];

  for (let i = 1; i <= 5; i++) {
    items.push({
      name: `pastelitem${i}`,
      rarity: "common",
      price: SHOP_PRICES.common,
      color_data: "#cccccc"
    });
  }

  for (let i = 1; i <= 3; i++) {
    items.push({
      name: `neonitem${i}`,
      rarity: "neon",
      price: SHOP_PRICES.neon,
      color_data: "#ff00ff"
    });
  }

  for (let i = 1; i <= 2; i++) {
    items.push({
      name: `rareitem${i}`,
      rarity: "rare",
      price: SHOP_PRICES.rare,
      color_data: "#ff0000"
    });
  }

  const insert = db.prepare(`
    INSERT INTO shop (name, rarity, price, color_data)
    VALUES (?, ?, ?, ?)
  `);

  for (const item of items) {
    insert.run(item.name, item.rarity, item.price, item.color_data);
  }
}
function loadShop() {
  const items = db.prepare("SELECT * FROM shop").all();

  if (items.length === 0) {
    generateShop();
    return db.prepare("SELECT * FROM shop").all();
  }

  return items;
}


/* =====================
   BLOOM HELPERS
===================== */
function bloomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return [...Array(4)].map(() =>
    letters[Math.floor(Math.random() * 26)]
  ).join("");
}

function bloomPetals() {
  return Math.floor(Math.random() * (140_000_000 - 900 + 1)) + 900;
}

/* =====================
   READY
===================== */
client.once("ready", () => {
  console.log(`🤖 Rusty online as ${client.user.tag}`);
});

function isAdmin(member) {
  return member.permissions.has("Administrator");
}

/* =====================
   MESSAGE HANDLER
===================== */
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const args = content.split(" ");
  const mentionedUser = message.mentions.users.first();
  const user = getUser(message.author.id);

  /* =====================
   ADMIN: GIVE PETALS
===================== */

if (args[0] === "wadmingive") {
  if (!isAdmin(message.member)) {
    message.channel.send("❌ You don’t have permission to do that.");
    return;
  }

  const amt = parseInt(args[1]);
  const targetUser = message.mentions.users.first();

  if (!targetUser || isNaN(amt)) {
    message.channel.send("❌ Usage: wadmingive <amount> @user");
    return;
  }

  const target = getUser(targetUser.id);
  target.petals_table += amt;
  saveUser(target);

  message.channel.send(
    `🛠️ Gave **${amt.toLocaleString()} petals** to <@${targetUser.id}>`
  );
  return;
}

  /* =====================
     HELP
  ===================== */
  if (content === "whelp") {
    const embed = new MessageEmbed()
      .setTitle("🆘 Rusty Commands")
      .setColor("#57F287")
      .setDescription(`
**Economy**
• wtable
• wbag
• wpetals
• wput <amount|all>
• wget <amount|all>
• wgive <amount> @user

**Minigames**
• wflip <heads|tails> <amount>

**Stats**
• winfo [@user]
• wleaderboard / wlb <page>

**Settings**
• wsetdm <open|closed|ask>

**Fun**
• hello
      `);

    message.channel.send({ embeds: [embed] });
    return;
  }
  if (content === "wshop") {
  const shop = loadShop();

  const embed = new MessageEmbed()
    .setTitle("🛒 Color Shop")
    .setColor("#57F287")
    .setDescription(
      shop.map(item => {
        const icon =
          item.rarity === "common" ? "🟢" :
          item.rarity === "neon" ? "🟣" :
          item.rarity === "rare" ? "🔴" :
          "🌈";

        return `${icon} **${item.name}** — ${item.price.toLocaleString()} 🌸`;
      }).join("\n")
    );

  message.channel.send({ embeds: [embed] });
  return;
}

  /* =====================
     DM SETTINGS
  ===================== */
  if (args[0] === "wsetdm" || args[0] === "wsdm") {
    const mode = args[1];
    if (!["open", "closed", "ask"].includes(mode)) {
      message.channel.send("❌ Use: open / closed / ask");
      return;
    }
    user.dm_status = mode;
    saveUser(user);
    message.channel.send(`📬 DM status set to **${mode}**`);
    return;
  }

  /* =====================
     USER INFO
  ===================== */
  if (args[0] === "winfo") {
    const target = mentionedUser ? getUser(mentionedUser.id) : user;

    const rank = db.prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM users
      WHERE (petals_table + petals_bag) > ?
    `).get(target.petals_table + target.petals_bag).rank;

    const embed = new MessageEmbed()
      .setTitle(`ℹ️ ${mentionedUser ? mentionedUser.username : message.author.username}`)
      .setThumbnail((mentionedUser ?? message.author).displayAvatarURL({ dynamic: true }))
      .setColor("#57F287")
      .addField("Level", `${target.level}`, true)
      .addField("Petals 🌸", `${target.petals_table + target.petals_bag}`, true)
      .addField("Blossoms 🌺", `${target.blossoms}`, true)
      .addField("DM Status", target.dm_status, true);

    if (!mentionedUser) {
      embed
        .addField("Messages", `${target.messages}`, true)
        .addField("XP", `${target.xp}`, true)
        .addField("Rank", `#${rank}`, true);
    }

    message.channel.send({ embeds: [embed] });
    return;
  }

  /* =====================
     VAULT / ECONOMY
  ===================== */
  if (content === "wtable") {
    message.channel.send(`🪑 Table petals: **${user.petals_table}**`);
    return;
  }

  if (content === "wbag") {
    message.channel.send(`🎒 Bag petals: **${user.petals_bag}**`);
    return;
  }

  if (content === "wpetals") {
    message.channel.send(`🌸 Total petals: **${user.petals_table + user.petals_bag}**`);
    return;
  }

  if (args[0] === "wput") {
    if (args[1] === "all") {
      user.petals_bag += user.petals_table;
      user.petals_table = 0;
      saveUser(user);
      message.channel.send("🎒 All petals moved to bag");
      return;
    }
    const amt = parseInt(args[1]);
    if (!amt || amt <= 0 || amt > user.petals_table) {
      message.channel.send("❌ Invalid amount");
      return;
    }
    user.petals_table -= amt;
    user.petals_bag += amt;
    saveUser(user);
    message.channel.send(`🎒 Moved **${amt} petals** to bag`);
    return;
  }

  if (args[0] === "wget") {
    if (args[1] === "all") {
      user.petals_table += user.petals_bag;
      user.petals_bag = 0;
      saveUser(user);
      message.channel.send("🪑 All petals moved to table");
      return;
    }
    const amt = parseInt(args[1]);
    if (!amt || amt <= 0 || amt > user.petals_bag) {
      message.channel.send("❌ Invalid amount");
      return;
    }
    user.petals_bag -= amt;
    user.petals_table += amt;
    saveUser(user);
    message.channel.send(`🪑 Moved **${amt} petals** to table`);
    return;
  }

  if (args[0] === "wgive") {
    const amt = parseInt(args[1]);
    if (!mentionedUser || !amt || amt <= 0 || amt > user.petals_table) {
      message.channel.send("❌ Usage: wgive <amount> @user");
      return;
    }
    const target = getUser(mentionedUser.id);
    user.petals_table -= amt;
    target.petals_table += amt;
    saveUser(user);
    saveUser(target);
    message.channel.send(`🎁 Gave **${amt} petals** to <@${mentionedUser.id}>`);
    return;
  }

  /* =====================
     COINFLIP
  ===================== */
  if (args[0] === "wflip") {
  const choice = args[1];
  const amt = parseInt(args[2]);
  const userId = message.author.id;

  // Initialize cooldown tracking
  if (!lastFlipMessageCount[userId]) {
    lastFlipMessageCount[userId] = -Infinity;
  }

  const messagesSinceLastFlip =
    user.messages - lastFlipMessageCount[userId];

  if (messagesSinceLastFlip < 5) {
    const remaining = 5 - messagesSinceLastFlip;
    message.channel.send(
      `⏳ You need to send **${remaining} more message(s)** before flipping again.`
    );
    return;
  }

  if (!["heads", "tails"].includes(choice)) {
    message.channel.send("❌ Choose `heads` or `tails`");
    return;
  }

  if (isNaN(amt) || amt <= 0 || amt > user.petals_table) {
    message.channel.send("❌ Invalid bet amount");
    return;
  }

  // 50% win chance
  const win = Math.random() < 0.5;
  const result = win ? choice : (choice === "heads" ? "tails" : "heads");

  if (win) {
    const winnings = Math.floor(amt * 0.5);
    user.petals_table += winnings;

    lastFlipMessageCount[userId] = user.messages;
    saveUser(user);

    message.channel.send(
      `🪙 **${result.toUpperCase()}!**\nYou won **${winnings} petals** 🌸`
    );
  } else {
    user.petals_table -= amt;

    lastFlipMessageCount[userId] = user.messages;
    saveUser(user);

    message.channel.send(
      `🪙 **${result.toUpperCase()}!**\nYou lost **${amt} petals** 💀`
    );
  }

  return;
}

/* =====================
   GAMBLE GAMES
===================== */

if (args[0] === "wgamble") {
  const type = args[1];
  const amt = parseInt(args[2]);

  const games = {
    a: { chance: 0.6, payout: 0.4, w: "gamble_a_wins", l: "gamble_a_losses" },
    b: { chance: 0.4, payout: 1.0, w: "gamble_b_wins", l: "gamble_b_losses" },
    c: { chance: 0.2, payout: 2.0, w: "gamble_c_wins", l: "gamble_c_losses" },
    d: { chance: 0.02, payout: 4.0, w: "gamble_d_wins", l: "gamble_d_losses" }
  };

  const game = games[type];
  if (!game) {
    message.channel.send("❌ Choose gamble a, b, c, or d");
    return;
  }

  if (!amt || amt <= 0 || amt > user.petals_table) {
    message.channel.send("❌ Invalid amount");
    return;
  }

  const win = Math.random() < game.chance;

  if (win) {
    const winnings = Math.floor(amt * game.payout);
    user.petals_table += winnings;
    user[game.w]++;

    saveUser(user);

    const embed = new MessageEmbed()
      .setTitle(`🎰 Gamble ${type.toUpperCase()} — WIN`)
      .setColor("#57F287")
      .setDescription(
        `**Win chance:** ${(game.chance * 100).toFixed(0)}%\n` +
        `**Payout:** +${(game.payout * 100).toFixed(0)}%\n\n` +
        `You won **${winnings} petals** 🌸`
      )
      .addField(
        "Your W/L",
        `${user[game.w]} / ${user[game.l]}`,
        true
      );

    message.channel.send({ embeds: [embed] });
  } else {
    user.petals_table -= amt;
    user[game.l]++;

    saveUser(user);

    const embed = new MessageEmbed()
      .setTitle(`🎰 Gamble ${type.toUpperCase()} — LOSS`)
      .setColor("#ED4245")
      .setDescription(
        `**Win chance:** ${(game.chance * 100).toFixed(0)}%\n` +
        `**Payout:** +${(game.payout * 100).toFixed(0)}%\n\n` +
        `You lost **${amt} petals** 💀`
      )
      .addField(
        "Your W/L",
        `${user[game.w]} / ${user[game.l]}`,
        true
      );

    message.channel.send({ embeds: [embed] });
  }

  return;
}

  /* =====================
     LEADERBOARD
  ===================== */
  if (args[0] === "wlb" || args[0] === "wleaderboard") {
    const page = Math.max(1, parseInt(args[1]) || 1);
    const size = 10;
    const offset = (page - 1) * size;

    const rows = db.prepare(`
      SELECT id, (petals_table + petals_bag) AS total
      FROM users
      ORDER BY total DESC
      LIMIT ? OFFSET ?
    `).all(size, offset);

    if (rows.length === 0) {
      message.channel.send("❌ No more pages");
      return;
    }

    const embed = new MessageEmbed()
      .setTitle(`🏆 Leaderboard — Page ${page}`)
      .setColor("#57F287")
      .setDescription(
        rows.map(
          (u, i) => `**${offset + i + 1}.** <@${u.id}> — ${u.total} 🌸`
        ).join("\n")
      );

    message.channel.send({ embeds: [embed] });
    return;
  }

  /* =====================
     GAMEPLAY CORE
  ===================== */
  user.messages++;
  totalMessages++;
  setMeta("totalMessages", totalMessages);

  const xp = Math.max(1, Math.min(Math.floor(message.content.length / 10), 20));
  user.xp += xp;
  user.petals_table += xp * 5;

  if (user.xp >= user.level * 100) {
    user.level++;
    message.channel.send(`🎉 <@${user.id}> reached **Level ${user.level}**`);
  }

  if (!activeBloom && totalMessages % BLOOM_INTERVAL === 0) {
    activeBloom = {
      code: bloomCode(),
      petals: bloomPetals(),
      expires: Date.now() + BLOOM_TIMEOUT_MINUTES * 60 * 1000
    };
    setMeta("activeBloom", activeBloom);
    message.channel.send(`🌸 A flower bloomed! Type **${activeBloom.code}**`);
  }

  if (activeBloom && Date.now() > activeBloom.expires) {
    activeBloom = null;
    setMeta("activeBloom", null);
  }

 if (
  activeBloom &&
  typeof activeBloom.code === "string" &&
  content.toUpperCase() === activeBloom.code
) {
  if (lastBloomWinner === user.id) return;

  user.petals_table += activeBloom.petals;
  user.blossoms += 1;
  lastBloomWinner = user.id;

  setMeta("lastBloomWinner", lastBloomWinner);
  setMeta("activeBloom", null);

  message.channel.send(
    `🌺 <@${user.id}> picked the bloom and gained **${activeBloom.petals.toLocaleString()} petals!**`
  );

  activeBloom = null;
}


  /* =====================
     HELLO RESPONDER
  ===================== */
  if (content.startsWith("hello")) {
    const choice =
      helloTranslations[Math.floor(Math.random() * helloTranslations.length)];
    message.channel.send(`${choice.text} (${choice.language})`);
  }

  saveUser(user);
});

/* =====================
   LOGIN
===================== */
client.login(process.env.DISCORD_TOKEN);
