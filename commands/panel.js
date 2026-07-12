const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open the bot configuration control panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const embed = {
                title: '⚙️ Bot Configuration Dashboard',
                description: 'Welcome to the control panel. Select a module below to configure your server setup dynamically.',
                color: 0x5865F2
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_tickets_btn')
                    .setLabel('Setup Tickets')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('setup_welcome_btn')
                    .setLabel('Setup Welcome')
                    .setEmoji('✨')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('setup_stats_btn')
                    .setLabel('Setup Server Stats')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup_youtube_btn')
                    .setLabel('Setup YouTube')
                    .setEmoji('📺')
                    .setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // --- BUTTON CLICKS HANDLING ---
        if (interaction.isButton()) {
            // SERVER STATS BUTTON
            if (interaction.customId === 'setup_stats_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_stats_setup') // Matched perfectly with Index.js
                    .setTitle('📊 Server Stats Setup');

                const totalInput = new TextInputBuilder()
                    .setCustomId('stats_total_input')
                    .setLabel('Total Members Voice Channel ID')
                    .setPlaceholder('Paste total channel ID here...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const onlineInput = new TextInputBuilder()
                    .setCustomId('stats_online_input')
                    .setLabel('Online Players Voice Channel ID')
                    .setPlaceholder('Paste online channel ID here...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(totalInput),
                    new ActionRowBuilder().addComponents(onlineInput)
                );

                return await interaction.showModal(modal);
            }

            // 📺 YOUTUBE BUTTON (Matched perfectly with Index.js routing)
            if (interaction.customId === 'setup_youtube_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('youtube_modal_submit')
                    .setTitle('📺 YouTube System Setup');

                const ytIdInput = new TextInputBuilder()
                    .setCustomId('yt_channel_id_input')
                    .setLabel('YouTube Channel ID (e.g. UCxxxx...)')
                    .setPlaceholder('Paste your YouTube Channel ID...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const liveChanInput = new TextInputBuilder()
                    .setCustomId('yt_live_chan_input')
                    .setLabel('Live Stream Alert Channel ID')
                    .setPlaceholder('Channel ID for Live alerts...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const uploadChanInput = new TextInputBuilder()
                    .setCustomId('yt_upload_chan_input')
                    .setLabel('Uploads Alert Channel ID')
                    .setPlaceholder('Channel ID for Video Upload alerts...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(ytIdInput),
                    new ActionRowBuilder().addComponents(liveChanInput),
                    new ActionRowBuilder().addComponents(uploadChanInput)
                );

                return await interaction.showModal(modal);
            }
        }
    }
};
