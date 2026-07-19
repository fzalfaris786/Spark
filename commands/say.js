const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Tumhara specific Allowed Role ID
const ALLOWED_ROLE = "1522039193256198154";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Send message as embed")
        .addChannelOption(opt =>
            opt.setName("channel")
                .setRequired(true)
                .setDescription("Select the channel to send embed")
        )
        .addStringOption(opt =>
            opt.setName("message")
                .setRequired(true)
                .setDescription("Type your message (Use \n for new lines)")
        ),

    async execute(interaction) {
        // Permission Check for Specific Role
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
            return interaction.reply({
                content: "❌ You do not have the required staff role to use this command.",
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel("channel");
        const message = interaction.options.getString("message");

        // Processing formatting strings for visual breakout text configurations
        const formattedMessage = message.replace(/\\n/g, '\n');

        const embed = new EmbedBuilder()
            .setDescription(formattedMessage)
            .setColor("Blue")
            .setFooter({ text: `Sent by ${interaction.user.tag}` })
            .setTimestamp();

        // Target channel validation deployment check
        if (!channel.isTextBased()) {
            return interaction.reply({
                content: "❌ Target channel must be a text channel.",
                ephemeral: true
            });
        }

        await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: "✅ Sent successfully as embed!",
            ephemeral: true
        });
    }
};
