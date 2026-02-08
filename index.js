const { Client, Intents, MessageEmbed } = require("discord.js");
const Database = require("better-sqlite3");
const handleWalterCommand = require("./walter");

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");


/* =====================
   CLIENT
===================== */
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT
  ]
});

/* =====================
   DATABASE
===================== */
const db = new Database("rusty.db");
try {
  db.prepare("ALTER TABLE users ADD COLUMN equipped_color TEXT").run();
  console.log("🧠 equipped_color column ensured");
} catch (e) {
  // column already exists, ignore
}

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

  equipped_color TEXT,

  gamble_a_wins INTEGER,
  gamble_a_losses INTEGER,
  gamble_b_wins INTEGER,
  gamble_b_losses INTEGER,
  gamble_c_wins INTEGER,
  gamble_c_losses INTEGER,
  gamble_d_wins INTEGER,
  gamble_d_losses INTEGER
)`).run();

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
let lastShopRotation = getMeta("lastShopRotation", 0);
let botStatus = getMeta("botStatus", "alive");
let botVersion = getMeta("botVersion", "alpha");
let updateMessage = getMeta("updateMessage", "");

/* =====================
   CONFIG
===================== */
const SHOP_ROTATION_DAYS = 8;
const BLOOM_INTERVAL = 280;
const BLOOM_TIMEOUT_MINUTES = 10;

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

     equipped_color: null,

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
    equipped_color,
    gamble_a_wins, gamble_a_losses,
    gamble_b_wins, gamble_b_losses,
    gamble_c_wins, gamble_c_losses,
    gamble_d_wins, gamble_d_losses
  ) VALUES (
    ?,?,?,?,?,?,?,?,
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

  user.equipped_color,

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
      equipped_color=?,

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

    u.equipped_color,

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


function isAdmin(member) {
  return member.permissions.has("Administrator");
}

/* =====================
   MESSAGE HANDLER
===================== */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const args = content.split(" ");
  const mentionedUser = message.mentions.users.first();
  const user = getUser(message.author.id);

  // ─── Walter AI commands ───
if (args[0].startsWith("w")) {
  const handled = await handleWalterCommand(message, args, user);
  if (handled !== false) return;
}

  //// Stats system
  if (args[0] === "wstats") {
  const embed = new MessageEmbed()
    .setTitle("🤖 Bot Status")
    .setColor("#5865F2")
    .addField("Status", botStatus, true)
    .addField("Version", botVersion, true)
    .addField(
      "Blossoms Dropped",
      `${db.prepare("SELECT SUM(value) as v FROM meta WHERE key LIKE 'blossoms_%'").get()?.v || 0}`,
      true
    );

  message.channel.send({ embeds: [embed] });

  if (updateMessage && updateMessage.length > 0) {
    const updateEmbed = new MessageEmbed()
      .setTitle("🟢 Upcoming Updates")
      .setColor("#57F287")
      .setDescription(updateMessage);

    message.channel.send({ embeds: [updateEmbed] });
  }

  return;
}

  /* =====================
   ADMIN: GIVE PETALS
===================== */

if (args[0] === "wadmingive") {
  if (!message.member.permissions.has("Administrator")) {
    message.channel.send("❌ Admins only.");
    return;
  }

  const amt = parseInt(args[1]);
  const targetUser = message.mentions.users.first();

  if (!targetUser || isNaN(amt) || amt <= 0) {
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
if (args[0] === "wget") {
  // ─── PETALS: wget all ───
  if (args[1] === "all") {
    user.petals_table += user.petals_bag;
    user.petals_bag = 0;
    saveUser(user);
    message.channel.send("🪑 All petals moved to table");
    return;
  }

  // ─── PETALS: wget <amount> ───
  const maybeNumber = parseInt(args[1]);
  if (!isNaN(maybeNumber)) {
    const amt = maybeNumber;

    if (amt <= 0 || amt > user.petals_bag) {
      message.channel.send("❌ Invalid amount");
      return;
    }

    user.petals_bag -= amt;
    user.petals_table += amt;
    saveUser(user);

    message.channel.send(`🪑 Moved **${amt} petals** to table`);
    return;
  }

  // ─── COLORS: wget <color name> ───
  const colorName = args.slice(1).join(" ");

  if (!colorName) {
    message.channel.send("❌ Usage: wget <amount | color>");
    return;
  }

  const owned = db.prepare(
    "SELECT 1 FROM inventory WHERE user_id=? AND LOWER(item_name)=?"
  ).get(user.id, colorName.toLowerCase());

  if (!owned) {
    message.channel.send("❌ You don’t own that color.");
    return;
  }

  // Remove color from bag
  db.prepare(
    "DELETE FROM inventory WHERE user_id=? AND LOWER(item_name)=?"
  ).run(user.id, colorName.toLowerCase());

  user.equipped_color = colorName;
  saveUser(user);

  message.channel.send(
    `🎨 **${colorName}** is ready.\nNow use \`wequip\` to equip it, or \`wremove\` to unequip it later.`
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

if (args[0] === "wbag") {
  const items = db.prepare(
    "SELECT item_name FROM inventory WHERE user_id=?"
  ).all(user.id);

  const itemList = items.length
    ? items.map(i => `• ${i.item_name}`).join("\n")
    : "None";

message.channel.send(
  `🎒 **Bag**
Blossoms: ${user.blossoms}
Petals: ${user.petals_bag}

🎨 **Colors**
${itemList}

To use items, use \`wget <item>\`.`
);

  return; // 🚨 THIS IS CRITICAL
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
  if (args[0] === "wequip") {
  if (!user.equipped_color) {
    message.channel.send("❌ You don’t have a color ready to equip. Use `wget <color>` first.");
    return;
  }

  const color =
    FIXED_COLORS.common.find(c => c.name === user.equipped_color) ||
    FIXED_COLORS.neon.find(c => c.name === user.equipped_color) ||
    FIXED_COLORS.rare.find(c => c.name === user.equipped_color);

  if (!color) {
    message.channel.send("❌ That color no longer exists.");
    return;
  }

  const allColorNames = getAllColorRoleNames();
  const rolesToRemove = message.member.roles.cache.filter(r =>
    allColorNames.includes(r.name)
  );

  if (rolesToRemove.size > 0) {
    await message.member.roles.remove(rolesToRemove);
  }

  const role = await getOrCreateColorRole(
    message.guild,
    color.name,
    color.hex
  );

  await message.member.roles.add(role);

  message.channel.send(`🎨 Equipped **${color.name}**`);
  return;
}
if (args[0] === "wremove") {
  if (!user.equipped_color) {
    message.channel.send("❌ You don’t have a color equipped.");
    return;
  }

  const colorName = user.equipped_color;

  const role = message.guild.roles.cache.find(r => r.name === colorName);
  if (role && message.member.roles.cache.has(role.id)) {
    await message.member.roles.remove(role);
  }

  db.prepare(
    "INSERT INTO inventory (user_id, item_name) VALUES (?,?)"
  ).run(user.id, colorName.toLowerCase());
  user.equipped_color = null;
  saveUser(user);

  message.channel.send(`🎒 **${colorName}** was removed and returned to your bag.`);
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
  if (args[0] === "wbuy") {
  const itemName = args.slice(1).join(" ");
  if (!itemName) {
    message.channel.send("❌ Usage: wbuy <colorname>");
    return;
  }

  const item = db.prepare(
  "SELECT * FROM shop WHERE LOWER(name) = ?"
).get(itemName.toLowerCase());

  if (!item) {
    message.channel.send("❌ That color is not in the shop.");
    return;
  }
  const blossomCost =
  item.rarity === "neon" ? 1 :
  item.rarity === "rare" ? 3 : 0;

if (user.blossoms < blossomCost) {
  message.channel.send(
    `❌ You need **${blossomCost} blossom(s)** to buy this color.`
  );
  return;
}


  if (user.petals_table < item.price) {
    message.channel.send("❌ Not enough petals on your table.");
    return;
  }

  const owned = db.prepare(
  "SELECT 1 FROM inventory WHERE user_id=? AND LOWER(item_name)=?"
).get(user.id, item.name.toLowerCase());

  if (owned) {
    message.channel.send("❌ You already own this color.");
    return;
  }

  user.petals_table -= item.price;
user.blossoms -= blossomCost;
saveUser(user);

 db.prepare(
  "INSERT INTO inventory (user_id, item_name) VALUES (?,?)"
).run(user.id, item.name.toLowerCase());

  message.channel.send(
  `🎨 You bought **${item.name}**.\nTo view your colors, use \`wbag\`.`
);
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


const adminCommands = [
  {
    name: "admin-commands",
    description: "List admin-only commands and bot status"
  },
  {
    name: "change-stat",
    description: "Change bot status",
    options: [
      {
        name: "status",
        type: 3,
        description: "alive / offline / updating / restarting",
        required: true
      }
    ]
  },
  {
    name: "update-add",
    description: "Set update message (max 200 chars)",
    options: [
      {
        name: "message",
        type: 3,
        description: "Update text",
        required: true
      }
    ]
  }
];

client.once("ready", async () => {
  console.log(`🤖 Rusty online as ${client.user.tag}`);

  // ─── Shop rotation check ───
  const now = Date.now();
  const rotationMs = SHOP_ROTATION_DAYS * 24 * 60 * 60 * 1000;
  const lastRotation = getMeta("lastShopRotation", 0);

  if (now - lastRotation >= rotationMs) {
    console.log("🛒 Rotating shop (8-day refresh)");
    generateShop();
    setMeta("lastShopRotation", now);
  } else {
    console.log("🛒 Shop is still current");
  }

  // ─── Slash command registration ───
  const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: adminCommands }
    );
    console.log("✅ Admin slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register admin slash commands", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "admin-commands") {
    if (!interaction.member.permissions.has("Administrator")) {
      await interaction.reply({
        content: "❌ Admins only.",
        ephemeral: true
      });
      return;
    }
    if (interaction.commandName === "change-stat") {
  if (!interaction.member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Admins only.",
      ephemeral: true
    });
    return;
  }

  const status = interaction.options.getString("status");
  botStatus = status;
  setMeta("botStatus", botStatus);

  await interaction.reply({
    content: `✅ Bot status set to **${botStatus}**`,
    ephemeral: true
  });
}

if (interaction.commandName === "update-add") {
  if (!interaction.member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Admins only.",
      ephemeral: true
    });
    return;
  }

  const msg = interaction.options.getString("message").slice(0, 200);
  updateMessage = msg;
  setMeta("updateMessage", updateMessage);

  await interaction.reply({
    content: "✅ Update message saved.",
    ephemeral: true
  });
}

    const embed = new MessageEmbed()
      .setTitle("🛠️ Admin Commands")
      .setColor("#ED4245")
      .setDescription(`
**Text Admin Commands**
• \`wadmingive <amount> @user\`
• \`wstats\`
• \`wblossomdrop\`

**Slash Commands**
• /admin-commands

**Inactive / Disabled**
• /wipe-user
• /force-rotation
• /economy-reset
      `)
      .addField(
        "📊 Bot Status",
        `Messages tracked: **${totalMessages}**
Active bloom: **${activeBloom ? "YES" : "NO"}**
Shop rotation: **Every ${SHOP_ROTATION_DAYS} days**`
      )
      .setFooter({ text: "Admin-only controls panel" });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
});

/* =====================
   LOGIN
===================== */
client.login(process.env.DISCORD_TOKEN);
