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
            if (interaction.customId === 'setup_stats_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('stats_modal_submit')
                    .setTitle('📊 Server Stats Setup');

                const totalInput = new TextInputBuilder()
                    .setCustomId('total_chan_input')
                    .setLabel('Total Members Voice Channel ID')
                    .setPlaceholder('Paste the channel ID...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const onlineInput = new TextInputBuilder()
                    .setCustomId('online_chan_input')
                    .setLabel('Online Players Voice Channel ID')
                    .setPlaceholder('Paste the channel ID...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(totalInput),
                    new ActionRowBuilder().addComponents(onlineInput)
                );

                await interaction.showModal(modal);
            }

            // 📺 YOUTUBE SETUP MODAL OPENER
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

                await interaction.showModal(modal);
            }
        }

        // --- MODAL SUBMISSIONS HANDLING ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'stats_modal_submit') {
                await interaction.deferReply({ ephemeral: true });

                const totalChanId = interaction.fields.getTextInputValue('total_chan_input').trim();
                const onlineChanId = interaction.fields.getTextInputValue('online_chan_input').trim();

                const chan1 = interaction.guild.channels.cache.get(totalChanId);
                const chan2 = interaction.guild.channels.cache.get(onlineChanId);

                if (!chan1 || !chan2 || chan1.type !== 2 || chan2.type !== 2) {
                    return interaction.editReply({ 
                        content: '❌ **Setup Failed:** Both IDs must belong to valid **Voice Channels** in this server!' 
                    });
                }

                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { totalMembersChan: totalChanId, onlinePlayersChan: onlineChanId },
                    { upsert: true, new: true }
                );

                return interaction.editReply({ 
                    content: `✅ **Server Stats Configuration Saved!**\n🪐 Total Channel: <#${totalChanId}>\n🟢 Online Channel: <#${onlineChanId}>`
                });
            }

            // 📺 YOUTUBE CONFIGURATION SAVE HANDLER
            if (interaction.customId === 'youtube_modal_submit') {
                await interaction.deferReply({ ephemeral: true });

                const ytChannelId = interaction.fields.getTextInputValue('yt_channel_id_input').trim();
                const liveChanId = interaction.fields.getTextInputValue('yt_live_chan_input').trim();
                const uploadChanId = interaction.fields.getTextInputValue('yt_upload_chan_input').trim();

                const checkLiveChan = interaction.guild.channels.cache.get(liveChanId);
                const checkUploadChan = interaction.guild.channels.cache.get(uploadChanId);

                if (!checkLiveChan || !checkUploadChan) {
                    return interaction.editReply({ content: '❌ **Setup Failed:** Alert channels must be valid text channels within this server!' });
                }

                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { ytChannelId, ytLiveChannel: liveChanId, ytUploadChannel: uploadChanId },
                    { upsert: true, new: true }
                );

                return interaction.editReply({
                    content: `✅ **YouTube Notification Tracker Connected!**\n📺 Channel ID: \`${ytChannelId}\`\n🎥 Live Alerts: <#${liveChanId}>\n🎬 Upload Alerts: <#${uploadChanId}>`
                });
            }
        }
    }
};
