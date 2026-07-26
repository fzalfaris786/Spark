const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('application')
        .setDescription('Staff application panel configuration system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('panel').setDescription('Deploy the staff application panel')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'panel') {
            const embed = new EmbedBuilder()
                .setTitle('📝 STAFF APPLICATION SETUP')
                .setDescription('Click the button below to configure channels, staff roles, questions, and DM notifications.')
                .setColor('#5865F2')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_app_config').setLabel('Configure Application System').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('deploy_app_panel').setLabel('Deploy Apply Panel').setStyle(ButtonStyle.Success)
            );

            return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
};
