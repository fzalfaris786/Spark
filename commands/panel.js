const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open the bot configuration control panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Agar buttons ya modal submit handle karne ke liye alag handler hai, toh ye slash execution text/buttons ke liye hai
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
                    .setStyle(ButtonStyle.Secondary)
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
            // Yahan par aapke baaki buttons (tickets/welcome) ke customId checks handle honge...
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
                    content: `✅ **Server Stats Configuration Saved!**\n🪐 Total Channel: <#${totalChanId}>\n🟢 Online Channel: <#${onlineChanId}>\n\n*The channels will start live updates every 10 minutes.*`
                });
            }
            // Yahan par aapke baaki modals (tickets/welcome) ke customId checks handle honge...
        }
    }
};
