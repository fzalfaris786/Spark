const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const activeGiveaways = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Start a giveaway")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(o => o.setName("channel").setDescription("Giveaway channel").setRequired(true))
        .addStringOption(o => o.setName("reward").setDescription("Prize / Reward").setRequired(true))
        .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setRequired(true))
        .addStringOption(o => o.setName("time").setDescription("Time in seconds (e.g. 60) or format (1m / 1h)").setRequired(true)),

    async execute(interaction) {
        try {
            const channel = interaction.options.getChannel("channel");
            const reward = interaction.options.getString("reward");
            const winners = interaction.options.getInteger("winners");
            const time = interaction.options.getString("time");

            const ms = parseTime(time);
            const endTime = Date.now() + ms;

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle("<a:gift_icon:1522037241419923456> 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘 𝐒𝐓𝐀𝐑𝐓𝐄𝐃 <a:gift_icon:1522037241419923456>")
                .setDescription(`
⟢ Host         : ${interaction.user}
⟢ Reward       : ${reward}
⟢ Winners      : ${winners}
⟢ Ends         : <t:${Math.floor(endTime / 1000)}:R>

────────────────────

➥ React with <a:participate:1522133751679680602> to participate.
`);

            const msg = await channel.send({ embeds: [embed] });
            await msg.react("<a:participate:1522133751679680602>");

            activeGiveaways.set(msg.id, {
                channelId: channel.id,
                reward,
                winners,
                endTime
            });

            setTimeout(() => {
                endGiveaway(msg.id, interaction.client);
            }, ms);

            return interaction.reply({ content: "✅ Giveaway started successfully!", ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Something went wrong in giveaway", ephemeral: true });
        }
    }
};

async function endGiveaway(messageId, client) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return;

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    const reaction = message.reactions.cache.find(r => r.emoji.id === "1522133751679680602");
    if (!reaction) {
        activeGiveaways.delete(messageId);
        return;
    }

    const reactedUsers = await reaction.users.fetch({ limit: 100 });
    const users = [...reactedUsers.values()].filter(user => !user.bot);
    let winnersList = [];

    for (let i = 0; i < giveaway.winners; i++) {
        if (users.length === 0) break;
        const index = Math.floor(Math.random() * users.length);
        winnersList.push(`<@${users[index].id}>`);
        users.splice(index, 1);
    }

    const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("<a:gift_icon:1522037241419923456> 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘 𝐄𝐍𝐃𝐄𝐃 <a:gift_icon:1522037241419923456>")
        .setDescription(`
⟢ Reward       : ${giveaway.reward}
⟢ Winners      : ${giveaway.winners}

────────────────────

<a:reward:1522037245153116322> **WINNERS**
${winnersList.length ? winnersList.map(u => `▸ ${u}`).join("\n") : "▸ No valid entries"}

────────────────────

<a:celebration:1522037235099242548> Congratulations!
`);

    await channel.send({ embeds: [embed] });
    await message.delete().catch(() => null);
    activeGiveaways.delete(messageId);
}

function parseTime(t) {
    if (!t || typeof t !== "string") return 60000;
    
    // IF JUST A NUMBER (e.g., 60), Treat as SECONDS
    if (!isNaN(t)) return parseInt(t) * 1000;

    const num = parseInt(t);
    if (isNaN(num)) return 60000;

    if (t.includes("m")) return num * 60000;
    if (t.includes("h")) return num * 3600000;
    if (t.includes("d")) return num * 86400000;
    if (t.includes("s")) return num * 1000;
    return 60000;
}
