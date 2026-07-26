require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const GuildConfig = require('./models/GuildConfig');
const { GuildStore, OrderTicket } = require('./models/GuildStore');
const InviteData = require('./models/InviteData');
const Ticket = require('./models/Ticket');
const ServerConfig = require('./models/ServerConfig');
const Invite = require('./models/Invite');

const parser = new Parser();
const guildInvites = new Map();
const userSelectedGuilds = new Map();

const OWNER_ID = '1266728371719508062';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
const commandsArray = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} online!`);
    if (process.env.MONGO_URI) {
        try { await mongoose.connect(process.env.MONGO_URI); } catch (err) { console.error("Mongo Error:", err); }
    }

    client.guilds.cache.forEach(async (guild) => {
        try {
            const invites = await guild.invites.fetch();
            const codeUses = new Map();
            invites.forEach(inv => codeUses.set(inv.code, inv.uses));
            guildInvites.set(guild.id, codeUses);
        } catch (e) {}
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray }); } catch (e) { console.error("Slash Reg Error:", e); }

    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) {
            await owner.send(`🟢 **Spark Bot is Online & Ready!**\nLogged in as: \`${client.user.tag}\``).catch(() => null);
        }
    } catch (e) {}
});

process.on('SIGINT', async () => {
    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) { await owner.send(`🔴 **Spark Bot is Offline!**`).catch(() => null); }
    } catch (e) {}
    process.exit(0);
});

// ================= OWNER DM CONTROL PANELS & AUTO-RESPONSE =================
client.on('messageCreate', async (message) => {
    if (!message.guild && message.author.id === OWNER_ID) {
        const text = message.content.trim();

        if (text === '!bot panel') {
            const guilds = client.guilds.cache.map(g => ({ label: g.name.substring(0, 25), value: g.id }));
            if (guilds.length === 0) return message.reply('❌ Bot is in no servers.');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('dm_select_server_bot').setPlaceholder('Select a server to manage...').addOptions(guilds.slice(0, 25))
            );
            const leaveRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dm_leave_server_btn').setLabel('Leave Selected Server').setStyle(ButtonStyle.Danger)
            );
            return message.reply({ content: `🤖 **Spark Bot Management Panel**`, components: [row, leaveRow] });
        }

        if (text === '!panel') {
            const guilds = client.guilds.cache.map(g => ({ label: g.name.substring(0, 25), value: g.id }));
            if (guilds.length === 0) return message.reply('❌ Bot is in no servers.');

            const serverSelectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('dm_master_server_select').setPlaceholder('🌐 Select Target Server First...').addOptions(guilds.slice(0, 25))
            );

            const embed = new EmbedBuilder()
                .setTitle('🎛️ Spark Master Setup & Panel Dashboard')
                .setDescription('Select a server from the dropdown below to open setup panels.')
                .setColor('#5865F2');

            return message.reply({ embeds: [embed], components: [serverSelectRow] });
        }
        return;
    }

    if (message.author.bot || !message.guild) return;
    const userMessage = message.content.toLowerCase();

    try {
        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config || !config.autoResponses || config.autoResponses.length === 0) return;

        const matched = config.autoResponses.find(r => new RegExp(`\\b${r.trigger}\\b`, 'i').test(userMessage));
        if (matched && matched.replyText) {
            let replyText = matched.replyText.replace(/\\n/g, '\n');
            const responseEmbed = new EmbedBuilder().setColor("Blue").setTimestamp();
            if (replyText.length > 0) responseEmbed.setDescription(replyText);
            return message.reply({ embeds: [responseEmbed] });
        }
    } catch (err) { console.error(err); }
});

// ================= WELCOME & INVITE TRACKER JOIN =================
client.on('guildMemberAdd', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.welcomeChannel) {
            const channel = member.guild.channels.cache.get(config.welcomeChannel);
            if (channel) {
                let descText = (config.welcomeMessage || 'Welcome!').replace(/{user}/g, `${member}`).replace(/{memberCount}/g, `${member.guild.memberCount}`);
                const embed = new EmbedBuilder().setTitle(config.welcomeTitle || '✨ WELCOME ✨').setDescription(descText).setColor('#FFCC00').setTimestamp();
                await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
            }
        }
    } catch (err) { console.error(err); }
});

// ================= DYNAMIC INTERACTIONS (SAFE DM & GUILD PANELS) =================
client.on('interactionCreate', async (interaction) => {
    try {
        const guildId = interaction.guild?.id;

        if (!interaction.guild && interaction.user.id === OWNER_ID) {
            if (interaction.isStringSelectMenu()) {
                const selectedGuildId = interaction.values[0];
                userSelectedGuilds.set(interaction.user.id, selectedGuildId);
                
                await interaction.update({ content: '⏳ Loading panel...', components: [] }).catch(() => {});

                const guild = client.guilds.cache.get(selectedGuildId);
                if (!guild) return interaction.editReply({ content: '❌ Guild not found.', components: [] });

                if (interaction.customId === 'dm_select_server_bot') {
                    return interaction.editReply({ content: `✅ Selected Server: **${guild.name}**`, components: [
                        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dm_leave_server_action').setLabel(`Leave ${guild.name}`).setStyle(ButtonStyle.Danger))
                    ] });
                }

                if (interaction.customId === 'dm_master_server_select') {
                    const embedMain = new EmbedBuilder()
                        .setTitle(`🎛️ Master Panel // ${guild.name}`)
                        .setDescription(`Target Server: **${guild.name}**\n\nChoose a panel below:`)
                        .setColor('#5865F2');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_open_store').setLabel('🛒 Store Panel').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('dm_open_ticket').setLabel('🎫 Ticket / Bot Panel').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('dm_open_invite').setLabel('📊 Invite Panel').setStyle(ButtonStyle.Secondary)
                    );

                    return interaction.editReply({ content: null, embeds: [embedMain], components: [row] });
                }
            }

            if (interaction.isButton()) {
                const selectedGuildId = userSelectedGuilds.get(interaction.user.id);
                const guild = client.guilds.cache.get(selectedGuildId);

                if (interaction.customId === 'dm_leave_server_action' && guild) {
                    const name = guild.name;
                    await guild.leave();
                    return interaction.reply({ content: `✅ Left server: **${name}**`, components: [] }).catch(() => {});
                }

                if (!guild && interaction.customId.startsWith('dm_open_')) {
                    return interaction.reply({ content: '⚠️ Please select a server from `!panel` dropdown first!', ephemeral: true }).catch(() => {});
                }

                if (interaction.customId === 'dm_open_store') {
                    const embed = new EmbedBuilder().setTitle(`🛒 Store Dashboard // ${guild.name}`).setColor('#5865F2');
                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_store_cfg').setLabel('1. Basic Setup & Stock').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('dm_btn_store_visual').setLabel('2. Deploy Visual Panel').setStyle(ButtonStyle.Success)
                    );
                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_store_exe').setLabel('3. Console & Commands').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('dm_btn_store_dms').setLabel('4. DM Alerts Settings').setStyle(ButtonStyle.Danger)
                    );
                    return interaction.reply({ embeds: [embed], components: [row1, row2] }).catch(() => {});
                }

                if (interaction.customId === 'dm_open_ticket') {
                    const embed = new EmbedBuilder().setTitle(`🎫 Bot Config Dashboard // ${guild.name}`).setColor('#00FF00');
                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_tix').setLabel('Setup Tickets').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('dm_btn_wel').setLabel('Setup Welcome').setStyle(ButtonStyle.Success)
                    );
                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_stats').setLabel('Setup Server Stats').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('dm_btn_yt').setLabel('Setup YouTube').setStyle(ButtonStyle.Danger)
                    );
                    const row3 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_auto').setLabel('Auto Response').setStyle(ButtonStyle.Primary)
                    );
                    return interaction.reply({ embeds: [embed], components: [row1, row2, row3] }).catch(() => {});
                }

                if (interaction.customId === 'dm_open_invite') {
                    const embed = new EmbedBuilder().setTitle(`📊 Invite Panel // ${guild.name}`).setColor('#FFCC00');
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('dm_btn_inv_logs_cfg').setLabel('Setup Log Channel').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('dm_btn_inv_guild_lb').setLabel('Leaderboard').setStyle(ButtonStyle.Primary)
                    );
                    return interaction.reply({ embeds: [embed], components: [row] }).catch(() => {});
                }

                // Modal Triggers from DM
                if (interaction.customId === 'dm_btn_tix') {
                    const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Setup Support Tickets');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('Logs Channel ID, Staff Role ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_cats').setLabel('Categories (Comma separated)').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Panel Description || Image URL').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Parent Category ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Welcome Message Inside Ticket').setRequired(true).setStyle(TextInputStyle.Paragraph))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_wel') {
                    const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Setup Welcome System');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Embed Title').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Welcome Message').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner URL (Optional)').setRequired(false).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_dm').setLabel('DM Welcome (Optional)').setRequired(false).setStyle(TextInputStyle.Paragraph))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_stats') {
                    const modal = new ModalBuilder().setCustomId('modal_stats_setup').setTitle('Setup Server Stats Channels');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_total_input').setLabel('Total Members Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_online_input').setLabel('Online Players Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_yt') {
                    const modal = new ModalBuilder().setCustomId('youtube_modal_submit').setTitle('Setup YouTube Integration');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_channel_id_input').setLabel('YouTube Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_live_chan_input').setLabel('Live Alert Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_upload_chan_input').setLabel('Upload Alert Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_auto') {
                    const modal = new ModalBuilder().setCustomId('modal_auto_response').setTitle('Setup Auto Responses');
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('auto_input_box').setLabel('Format: trigger:reply || trigger2:reply2').setRequired(true).setStyle(TextInputStyle.Paragraph)));
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_store_cfg') {
                    const modal = new ModalBuilder().setCustomId('modal_store_cfg').setTitle('1. Basic Setup & Stock');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_name').setLabel('Server Name').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_role').setLabel('Admin Role ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_logs').setLabel('Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_items').setLabel('Cat: Item1-100, Item2-200 || Cat2...').setRequired(true).setStyle(TextInputStyle.Paragraph))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_store_visual') {
                    const modal = new ModalBuilder().setCustomId('modal_store_visual').setTitle('2. Deploy Visual Panel');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_title').setLabel('Panel Title').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_desc').setLabel('Panel Description').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_banner').setLabel('Banner Image URL (Optional)').setRequired(false).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_chan').setLabel('Destination Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_store_exe') {
                    const modal = new ModalBuilder().setCustomId('modal_store_execution').setTitle('3. Console & Commands');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exe_console').setLabel('Console Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exe_cmds').setLabel('ItemName: give {name} diamond 1 || ...').setRequired(true).setStyle(TextInputStyle.Paragraph))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_store_dms') {
                    const modal = new ModalBuilder().setCustomId('modal_store_dms').setTitle('4. DM Alerts Settings');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_app').setLabel('Approved DM Template').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_rej').setLabel('Rejected DM Template').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_pend').setLabel('Pending Reminder DM Template').setRequired(true).setStyle(TextInputStyle.Paragraph))
                    );
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'dm_btn_inv_guild_lb') {
                    await interaction.deferReply();
                    const dbData = await InviteData.find({ guildId: selectedGuildId });
                    const sorted = dbData.map(d => ({ userId: d.userId, total: d.permRegular - d.permLeaves - d.permFake })).sort((a, b) => b.total - a.total).slice(0, 10);

                    if (sorted.length === 0) return await interaction.followUp({ content: '❌ No invite data found.' });

                    let str = '```text\n';
                    for (let i = 0; i < sorted.length; i++) {
                        const u = await interaction.client.users.fetch(sorted[i].userId).catch(() => null);
                        str += `${i+1}. ${(u ? u.username : 'Unknown').padEnd(12, ' ')} • ${sorted[i].total} Invites\n`;
                    }
                    str += '```';
                    const embed = new EmbedBuilder().setTitle(`🏆 TOP 10 LEADERBOARD // ${guild.name}`).setDescription(str).setColor('#00FF00');
                    return await interaction.followUp({ embeds: [embed] });
                }

                if (interaction.customId === 'dm_btn_inv_logs_cfg') {
                    const modal = new ModalBuilder().setCustomId('modal_inv_logs').setTitle('Setup Invite Log Channel');
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inv_log_input').setLabel('Invite Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short)));
                    return await interaction.showModal(modal);
                }
            }
            return;
        }
        
                if (!guildId) return;

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (command) await command.execute(interaction);
            return;
        }

        if (interaction.isButton()) {
            // In-guild button triggers for setup panels (if opened via slash commands or messages)
            if (interaction.customId === 'setup_tickets_btn') {
                const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Setup Support Tickets');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('Logs Channel ID, Staff Role ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_cats').setLabel('Categories (Comma separated)').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Panel Description || Image URL').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Parent Category ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Welcome Message Inside Ticket').setRequired(true).setStyle(TextInputStyle.Paragraph))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_welcome_btn') {
                const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Setup Welcome System');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Embed Title').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Welcome Message').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner URL (Optional)').setRequired(false).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_stats_btn') {
                const modal = new ModalBuilder().setCustomId('modal_stats_setup').setTitle('Setup Server Stats Channels');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_total_input').setLabel('Total Members Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_online_input').setLabel('Online Players Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_auto_btn') {
                const modal = new ModalBuilder().setCustomId('modal_auto_response').setTitle('Setup Auto Responses');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('auto_input_box').setLabel('Format: trigger:reply || trigger2:reply2').setRequired(true).setStyle(TextInputStyle.Paragraph)));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_inv_guild_lb') {
                await interaction.deferReply();
                const dbData = await InviteData.find({ guildId });
                const sorted = dbData.map(d => ({ userId: d.userId, total: d.permRegular - d.permLeaves - d.permFake })).sort((a, b) => b.total - a.total).slice(0, 10);

                if (sorted.length === 0) return await interaction.followUp({ content: '❌ No invite data found.' });

                let str = '```text\n';
                for (let i = 0; i < sorted.length; i++) {
                    const u = await interaction.client.users.fetch(sorted[i].userId).catch(() => null);
                    str += `${i+1}. ${(u ? u.username : 'Unknown').padEnd(12, ' ')} • ${sorted[i].total} Invites\n`;
                }
                str += '```';
                const embed = new EmbedBuilder().setTitle('🏆 TOP 10 LEADERBOARD').setDescription(str).setColor('#00FF00');
                return await interaction.followUp({ embeds: [embed] });
            }

            if (interaction.customId === 'btn_inv_logs_cfg') {
                const modal = new ModalBuilder().setCustomId('modal_inv_logs').setTitle('Setup Invite Log Channel');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inv_log_input').setLabel('Invite Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short)));
                return await interaction.showModal(modal);
            }

            const config = await GuildConfig.findOne({ guildId });
            if (interaction.customId === 'claim_ticket') {
                if (config && config.ticketRole && !interaction.member.roles.cache.has(config.ticketRole)) {
                    return await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
                }

                const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
                if (ticketDoc && ticketDoc.status === 'claimed') {
                    return await interaction.reply({ content: `⚠️ Already claimed by <@${ticketDoc.claimedBy}>!`, ephemeral: true });
                }

                if (ticketDoc) {
                    ticketDoc.status = 'claimed';
                    ticketDoc.claimedBy = interaction.user.id;
                    await ticketDoc.save();
                } else {
                    await Ticket.create({ guildId, channelId: interaction.channel.id, claimedBy: interaction.user.id, status: 'claimed' });
                }

                try { await interaction.channel.setName(`claimed-${interaction.user.username}`); } catch (e) {}
                await interaction.reply({ content: `🔒 Ticket claimed by **${interaction.user.tag}**!` });
                return await interaction.message.edit({ components: [interaction.message.components[0]] }).catch(() => {});
            }

            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 Closing channel in 5 seconds...');
                await Ticket.deleteOne({ channelId: interaction.channel.id });
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }

            if (interaction.customId.startsWith('btn_trigger_checkout_')) {
                const itemObjectId = interaction.customId.replace('btn_trigger_checkout_', '');
                const playerModal = new ModalBuilder().setCustomId(`modal_player_checkout_${itemObjectId}`).setTitle('Player Verification');
                playerModal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player_ign').setLabel('Enter In-Game Username (IGN)').setRequired(true).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(playerModal);
            }

            const ticket = await OrderTicket.findOne({ channelId: interaction.channel.id });
            if (ticket) {
                const store = await GuildStore.findOne({ guildId });
                if (interaction.customId === 'btn_order_approve') {
                    await interaction.deferReply();
                    const storeItem = store?.items.find(i => i.name.toLowerCase() === ticket.itemName.toLowerCase());
                    if (store?.consoleChannelId && storeItem && storeItem.command) {
                        const consoleChan = interaction.guild.channels.cache.get(store.consoleChannelId);
                        if (consoleChan) {
                            const finalCmd = storeItem.command.replace(/{name}/g, ticket.buyerIGN);
                            await consoleChan.send({ content: finalCmd });
                        }
                    }
                    const buyer = await interaction.client.users.fetch(ticket.buyerId).catch(() => null);
                    if (buyer) {
                        const msg = (store?.dmApproved || "📦 Order Approved!").replace(/{{server}}/g, store?.serverName || "Server").replace(/{{item}}/g, ticket.itemName);
                        await buyer.send({ content: msg }).catch(() => null);
                    }
                    await interaction.editReply({ content: '✅ **Order Approved!** Command executed.' });
                    return await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_order_delete').setLabel('Delete Room').setStyle(ButtonStyle.Secondary))] });
                }

                if (interaction.customId === 'btn_order_reject') {
                    await interaction.deferReply();
                    const buyer = await interaction.client.users.fetch(ticket.buyerId).catch(() => null);
                    if (buyer) {
                        const msg = (store?.dmRejected || "❌ Order Rejected!").replace(/{{server}}/g, store?.serverName || "Server").replace(/{{item}}/g, ticket.itemName);
                        await buyer.send({ content: msg }).catch(() => null);
                    }
                    await interaction.editReply({ content: '🚫 **Order Rejected!** Buyer notified.' });
                    return await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_order_delete').setLabel('Delete Room').setStyle(ButtonStyle.Secondary))] });
                }

                if (interaction.customId === 'btn_order_delete') {
                    await interaction.reply({ content: '🗑️ Closing space...' });
                    await OrderTicket.deleteOne({ channelId: interaction.channel.id });
                    setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
                }
            }
        }

        if (interaction.isModalSubmit()) {
            const targetGuildId = userSelectedGuilds.get(interaction.user.id) || guildId;

            if (interaction.customId === 'modal_inv_logs') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const channelId = interaction.fields.getTextInputValue('inv_log_input').trim();
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, { inviteLogChannel: channelId }, { upsert: true });
                return await interaction.editReply({ content: `✅ Invite logs channel updated to <#${channelId}>.` });
            }

            if (interaction.customId === 'modal_ticket') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const logsData = interaction.fields.getTextInputValue('t_logs').split(',');
                const cats = interaction.fields.getTextInputValue('t_cats').split(',').map(c => c.trim());
                const descData = interaction.fields.getTextInputValue('t_desc').split('||');
                
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, {
                    ticketDescription: descData[0]?.trim(),
                    ticketParent: interaction.fields.getTextInputValue('t_parent'),
                    ticketLogs: logsData[0]?.trim(),
                    ticketRole: logsData[1]?.trim(),
                    ticketMessage: interaction.fields.getTextInputValue('t_msg').trim()
                }, { upsert: true, new: true });

                const targetGuild = client.guilds.cache.get(targetGuildId);
                const targetChannel = targetGuild?.channels.cache.find(c => c.isTextBased() && c.permissionsFor(targetGuild.members.me)?.has(PermissionFlagsBits.SendMessages));
                if (targetChannel) {
                    const embed = new EmbedBuilder().setTitle('🎫 Create a Ticket').setDescription(descData[0]?.trim()).setColor('#5865F2');
                    const options = cats.map(cat => ({ label: cat, value: cat }));
                    const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').addOptions(options);
                    await targetChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
                }
                return await interaction.editReply({ content: '✅ Deployed Support Tickets Panel Successfully!' });
            }

            if (interaction.customId === 'modal_welcome') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, {
                    welcomeTitle: interaction.fields.getTextInputValue('w_title'),
                    welcomeMessage: interaction.fields.getTextInputValue('w_msg'),
                    welcomeChannel: interaction.fields.getTextInputValue('w_chan'),
                    welcomeThumbnail: interaction.fields.getTextInputValue('w_thumb') || '',
                    welcomeDm: interaction.fields.getTextInputValue('w_dm') || ''
                }, { upsert: true });
                return await interaction.editReply({ content: '✅ Saved Welcome Settings!' });
            }

            if (interaction.customId === 'modal_stats_setup') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, {
                    totalMembersChan: interaction.fields.getTextInputValue('stats_total_input').trim(),
                    onlinePlayersChan: interaction.fields.getTextInputValue('stats_online_input').trim()
                }, { upsert: true });
                return await interaction.editReply({ content: '✅ Saved Stats Configuration!' });
            }

            if (interaction.customId === 'youtube_modal_submit') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, {
                    ytChannelId: interaction.fields.getTextInputValue('yt_channel_id_input').trim(),
                    ytLiveChannel: interaction.fields.getTextInputValue('yt_live_chan_input').trim(),
                    ytUploadChannel: interaction.fields.getTextInputValue('yt_upload_chan_input').trim()
                }, { upsert: true });
                return await interaction.editReply({ content: '✅ Connected YouTube System Successfully!' });
            }

            if (interaction.customId === 'modal_auto_response') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const bulkInput = interaction.fields.getTextInputValue('auto_input_box');
                const autoResponses = [];
                if (bulkInput) {
                    bulkInput.split('||').forEach(b => {
                        const p = b.split(':');
                        if (p.length >= 2) autoResponses.push({ trigger: p[0].trim().toLowerCase(), replyText: p[1].trim() });
                    });
                }
                await GuildConfig.findOneAndUpdate({ guildId: targetGuildId }, { autoResponses }, { upsert: true });
                return await interaction.editReply({ content: '✅ Auto-responses saved!' });
            }

            if (interaction.customId === 'modal_store_cfg') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const bulkInput = interaction.fields.getTextInputValue('cfg_items');
                const categories = []; const items = [];
                if (bulkInput) {
                    bulkInput.split('||').forEach(block => {
                        const parts = block.split(':');
                        if (parts.length >= 2) {
                            const catName = parts[0].trim();
                            if (!categories.includes(catName)) categories.push(catName);
                            parts[1].split(',').forEach(iRaw => {
                                const iParts = iRaw.split('-');
                                if (iParts.length >= 2) {
                                    items.push({ category: catName, name: iParts[0].trim(), price: parseInt(iParts[1].replace(/[^0-9]/g, ''), 10) || 0, command: '' });
                                }
                            });
                        }
                    });
                }
                await GuildStore.findOneAndUpdate({ guildId: targetGuildId }, { serverName: interaction.fields.getTextInputValue('cfg_name'), adminRoleId: interaction.fields.getTextInputValue('cfg_role'), logsChannelId: interaction.fields.getTextInputValue('cfg_logs'), categories, items }, { upsert: true });
                return await interaction.editReply({ content: '✅ Store stock updated.' });
            }

            if (interaction.customId === 'modal_store_visual') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const panelTitle = interaction.fields.getTextInputValue('pnl_title');
                const panelDescription = interaction.fields.getTextInputValue('pnl_desc');
                const panelBanner = interaction.fields.getTextInputValue('pnl_banner');
                const targetChanId = interaction.fields.getTextInputValue('pnl_chan');
                const store = await GuildStore.findOneAndUpdate({ guildId: targetGuildId }, { panelTitle, panelDescription, panelBanner }, { upsert: true, new: true });
                const targetGuild = client.guilds.cache.get(targetGuildId);
                const targetChannel = targetGuild?.channels.cache.get(targetChanId);
                if (targetChannel) {
                    const embed = new EmbedBuilder().setTitle(panelTitle).setDescription(panelDescription).setColor('#5865F2');
                    if (panelBanner && panelBanner.startsWith('http')) embed.setImage(panelBanner);
                    const options = store.categories.map(cat => ({ label: cat, value: `store_cat_${cat}` }));
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('store_category_select').setPlaceholder('🗂️ Choose Category...').addOptions(options));
                    await targetChannel.send({ embeds: [embed], components: [row] });
                }
                return await interaction.editReply({ content: '🚀 Store deployed!' });
            }

            if (interaction.customId === 'modal_store_execution') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const consoleChannelId = interaction.fields.getTextInputValue('exe_console');
                const mappingsRaw = interaction.fields.getTextInputValue('exe_cmds').split('||').map(m => m.trim());
                const store = await GuildStore.findOne({ guildId: targetGuildId });
                if (!store) return await interaction.editReply({ content: '❌ Setup Stock first!' });
                store.consoleChannelId = consoleChannelId;
                mappingsRaw.forEach(mapping => {
                    const parts = mapping.split(':');
                    const matchedItem = store.items.find(i => i.name.toLowerCase() === parts[0]?.trim().toLowerCase());
                    if (matchedItem) matchedItem.command = parts[1]?.trim();
                });
                await store.save();
                return await interaction.editReply({ content: '⚙️ Commands mapped.' });
            }

            if (interaction.customId === 'modal_store_dms') {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                await GuildStore.findOneAndUpdate({ guildId: targetGuildId }, {
                    dmApproved: interaction.fields.getTextInputValue('dm_app'),
                    dmRejected: interaction.fields.getTextInputValue('dm_rej'),
                    dmPendingReminder: interaction.fields.getTextInputValue('dm_pend')
                }, { upsert: true });
                return await interaction.editReply({ content: '✅ Custom DM templates saved.' });
            }

            if (interaction.customId.startsWith('modal_player_checkout_')) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const itemUniqueId = interaction.customId.replace('modal_player_checkout_', '');
                const buyerIGN = interaction.fields.getTextInputValue('player_ign');
                const store = await GuildStore.findOne({ guildId });
                const item = store?.items.find(i => i._id.toString() === itemUniqueId);

                if (!item) return await interaction.editReply({ content: '❌ Item expired.' });

                const ticketRoom = await interaction.guild.channels.create({
                    name: `order-${interaction.user.username}`,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        ...(store.adminRoleId ? [{ id: store.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                    ]
                });

                await OrderTicket.create({
                    guildId, channelId: ticketRoom.id, buyerId: interaction.user.id,
                    buyerIGN, itemName: item.name, itemPrice: item.price, itemCategory: item.category
                });

                const embed = new EmbedBuilder().setTitle('📥 NEW INBOUND ORDER').setColor('#FFCC00').addFields(
                    { name: '👤 Buyer', value: `${interaction.user}`, inline: true },
                    { name: '🎮 IGN', value: `\`${buyerIGN}\``, inline: true },
                    { name: '📦 Package', value: `**${item.name}**`, inline: false }
                );

                const controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_order_approve').setLabel('Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_order_reject').setLabel('Reject').setStyle(ButtonStyle.Danger)
                );

                await ticketRoom.send({ content: `${interaction.user} | <@&${store.adminRoleId}>`, embeds: [embed], components: [controlRow] });
                return await interaction.editReply({ content: `🎯 Order room opened: ${ticketRoom}` });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_select') {
                const config = await GuildConfig.findOne({ guildId });
                if (!config) return;
                const selectedCategory = interaction.values[0]; 
                const name = `ticket-${interaction.user.username.toLowerCase()}`;
                
                await interaction.deferReply({ ephemeral: true });
                const ch = await interaction.guild.channels.create({
                    name, parent: config.ticketParent || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const embed = new EmbedBuilder().setTitle('🎫 Ticket Support').setDescription(config.ticketMessage || 'Support terminal').setColor('#00ffcc');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
                await ch.send({ embeds: [embed], components: [row] });
                return await interaction.editReply({ content: `Generated: ${ch}` });
            }

            const store = await GuildStore.findOne({ guildId });
            if (store && interaction.customId === 'store_category_select') {
                const chosenCat = interaction.values[0].replace('store_cat_', '');
                const filteredItems = store.items.filter(i => i.category === chosenCat);
                if (filteredItems.length === 0) return await interaction.reply({ content: '❌ No items found.', ephemeral: true });

                const options = filteredItems.map(i => ({ label: `${i.name} - ${i.price} INR`, value: `store_itm_${i._id.toString()}` }));
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('store_item_select').setPlaceholder('📦 Choose item...').addOptions(options));
                return await interaction.reply({ content: `📁 Category: **${chosenCat}**`, components: [row], ephemeral: true });
            }

            if (store && interaction.customId === 'store_item_select') {
                const itemDbId = interaction.values[0].replace('store_itm_', '');
                const targetItem = store.items.find(i => i._id.toString() === itemDbId);
                const buyRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_trigger_checkout_${itemDbId}`).setLabel(`Order: ${targetItem.name} (${targetItem.price} INR)`).setStyle(ButtonStyle.Primary));
                return await interaction.reply({ content: `🛒 Buy **${targetItem.name}**? Click below:`, components: [buyRow], ephemeral: true });
            }
        }
    } catch (err) { console.error("Error:", err); }
});

setInterval(async () => {
    try {
        const stats = await GuildConfig.find({ onlinePlayersChan: { $ne: null } });
        for (const config of stats) {
            const g = await client.guilds.fetch(config.guildId).catch(() => null);
            if (!g) continue;
            const mems = await g.members.fetch({ withPresences: true }).catch(() => null);
            const on = mems ? mems.filter(m => m.presence && m.presence.status !== 'offline').size : 0;
            const chan = g.channels.cache.get(config.onlinePlayersChan);
            if (chan) await chan.setName(`🟢 Online Players: ${on}`).catch(() => null);
        }
    } catch (e) {}
}, 300000);

client.login(process.env.DISCORD_TOKEN);
