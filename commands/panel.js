const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Naye Bot Ka Configurations Control Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Admin Only Access
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Bot Setup & Orchestration System')
            .setDescription('System setup run karne ke liye niche wale buttons trigger karein.')
            .setColor('#1a1a1a');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_welcome_setup').setLabel('Setup Welcome Form').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_ticket_setup').setLabel('Setup Ticket Panel').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};
