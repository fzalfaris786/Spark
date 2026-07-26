const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const InviteData = require('../models/InviteData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite tracking and management system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('panel').setDescription('Open the invite control panel'))
        .addSubcommand(s => 
            s.setName('check')
             .setDescription('Check invites for a member')
             .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(false))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'panel') {
            const embed = new EmbedBuilder()
                .setTitle('📩 INVITE TRACKER DASHBOARD')
                .setDescription('Manage your server invite logs and view the top 10 lifetime leaderboard below.')
                .setColor('#5865F2')
                .setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_inv_guild_lb').setLabel('Top 10 Leaderboard').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_inv_logs_cfg').setLabel('Setup Log Channel ID').setStyle(ButtonStyle.Secondary)
            );

            return await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
        }

        if (sub === 'check') {
            await interaction.deferReply();

            const target = interaction.options.getUser('user') || interaction.user;
            const data = await InviteData.findOne({ guildId, userId: target.id }) || { permRegular: 0, permLeaves: 0, permFake: 0 };
            
            const reg = data.permRegular;
            const lvs = data.permLeaves;
            const fk = data.permFake;
            const total = reg - lvs - fk;

            const card = `👤 User      : ${target.tag}\n📊 Total Invites : ${total}\n--------------------------------\n🟢 Regular   : ${reg}\n🔴 Leaves    : ${lvs}\n⚠️ Fake      : ${fk}`;

            const embed = new EmbedBuilder()
                .setTitle('⚡ PLAYER INVITE PROFILE')
                .setDescription(card)
                .setColor('#FFCC00')
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }
    }
};
