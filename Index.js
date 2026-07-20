require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const GuildConfig = require('./models/GuildConfig');
const { GuildStore, OrderTicket } = require('./models/GuildStore');

const parser = new Parser();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
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
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray }); } catch (e) { console.error("Slash Reg Error:", e); }
});

// ================= DYNAMIC AUTO RESPONSE INTERCEPTOR =================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const userMessage = message.content.toLowerCase();

    try {
        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config || !config.autoResponses || config.autoResponses.length === 0) return;

        const matched = config.autoResponses.find(r => {
            const regex = new RegExp(`\\b${r.trigger}\\b`, 'i');
            return regex.test(userMessage);
        });
        
        if (matched && matched.replyText) {
            let replyText = matched.replyText.replace(/\\n/g, '\n');
            const responseEmbed = new EmbedBuilder().setColor("Blue").setTimestamp();

            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const foundUrls = replyText.match(urlRegex);

            if (foundUrls && foundUrls.length > 0) {
                const imageUrl = foundUrls.find(url => url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net'));
                if (imageUrl) {
                    responseEmbed.setImage(imageUrl);
                    replyText = replyText.replace(imageUrl, '').trim();
                }
            }

            if (replyText.length > 0) responseEmbed.setDescription(replyText);
            return message.reply({ embeds: [responseEmbed] });
        }
    } catch (err) { console.error("Auto response exception:", err); }
});

// ================= WELCOME & INSTANT STATS ON JOIN =================
client.on('guildMemberAdd', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (!config) return;
        if (config.welcomeChannel) {
            const channel = member.guild.channels.cache.get(config.welcomeChannel);
            if (channel) {
                let descText = config.welcomeMessage || 'Welcome!';
                descText = descText
                    .replace(/{user}/g, `${member}`)
                    .replace(/{{User.Mention}}/g, `${member}`)
                    .replace(/{{user.mention}}/g, `${member}`)
                    .replace(/{memberCount}/g, `${member.guild.memberCount}`);
                
                const createdAtFormatted = member.user.createdAt.toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
                descText = descText.replace(/{accountCreated}/g, createdAtFormatted);
                
                const embed = new EmbedBuilder()
                    .setTitle(config.welcomeTitle || '✨ WELCOME ✨')
                    .setDescription(descText)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setColor('#FFCC00')
                    .setFooter({ text: `Member #${member.guild.memberCount}` })
                    .setTimestamp();
                
                if (config.welcomeThumbnail && config.welcomeThumbnail.startsWith('http')) {
                    embed.setImage(config.welcomeThumbnail);
                }
                await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
            }
        }
        if (config.totalMembersChan) {
            const chan = member.guild.channels.cache.get(config.totalMembersChan);
            if (chan) await chan.setName(`🪐 Total Members: ${member.guild.memberCount}`).catch(() => null);
        }
    } catch (err) { console.error(err); }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.totalMembersChan) {
            const chan = member.guild.channels.cache.get(config.totalMembersChan);
            if (chan) await chan.setName(`🪐 Total Members: ${member.guild.memberCount}`).catch(() => null);
        }
    } catch (err) { console.error(err); }
});

// ================= DYNAMIC INTERACTIONS (INTERCEPTOR ROUTER) =================
client.on('interactionCreate', async (interaction) => {
    try {
        const guildId = interaction.guild?.id;
        if (!guildId) return;

        // 1. SLASH COMMANDS
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (command) await command.execute(interaction);
            return;
        }

        // 2. BUTTON INTERACTIONS
        if (interaction.isButton()) {
            if (interaction.customId === 'setup_store_cfg') {
                const modal = new ModalBuilder().setCustomId('modal_store_cfg').setTitle('1. Basic Setup & Stock');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_name').setLabel('Server Name').setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder('e.g., SparkleMc')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_role').setLabel('Admin Role ID').setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder('e.g., 123456789012345678')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_logs').setLabel('Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short).setPlaceholder('e.g., 123456789012345678')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cfg_items').setLabel('Items & Stock Setup').setRequired(true).setStyle(TextInputStyle.Paragraph).setPlaceholder('Ranks:Elite-100 || Keys:Shine Key-50'))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_store_visual') {
                const modal = new ModalBuilder().setCustomId('modal_store_visual').setTitle('2. Visual Panel Deploy');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_title').setLabel('Embed Header Title').setRequired(true).setStyle(TextInputStyle.Short).setValue('🛒 SERVER STOREFRONT')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_desc').setLabel('Embed Description Text').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue('Select a category below to view items.')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_banner').setLabel('Banner Image CDN Link').setRequired(false).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pnl_chan').setLabel('Target Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_store_execution') {
                const modal = new ModalBuilder().setCustomId('modal_store_execution').setTitle('3. Console & Commands');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exe_console').setLabel('Console Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exe_cmds').setLabel('Command Mappings').setRequired(true).setStyle(TextInputStyle.Paragraph).setPlaceholder('Elite:lp user {name} parent set elite || Shine Key:givekey {name} shine 1'))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_store_dms') {
                const store = await GuildStore.findOne({ guildId });
                const modal = new ModalBuilder().setCustomId('modal_store_dms').setTitle('4. DM Alert Templates');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_app').setLabel('Approved DM Text').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.dmApproved || "📦 Order Approved [{{server}}]! Item: {{item}}")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_rej').setLabel('Rejected DM Text').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.dmRejected || "❌ Order Rejected [{{server}}]! Item: {{item}}")),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dm_pend').setLabel('12h Pending Reminder DM Text').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.dmPendingReminder || "⏰ Pending Order Reminder [{{server}}]! Item: {{item}}"))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_stats_btn') {
                const modal = new ModalBuilder().setCustomId('modal_stats_setup').setTitle('📊 Server Stats Setup');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_total_input').setLabel('Total Members Voice ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stats_online_input').setLabel('Online Players Voice ID').setRequired(true).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_youtube_btn') {
                const modal = new ModalBuilder().setCustomId('youtube_modal_submit').setTitle('📺 YouTube System Setup');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_channel_id_input').setLabel('YouTube Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_live_chan_input').setLabel('Live Alert Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_upload_chan_input').setLabel('Upload Alert Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_welcome_btn') {
                const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Welcome Configuration');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Embed Title').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Message').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner Image URL').setRequired(false).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_dm').setLabel('DM Text').setRequired(false).setStyle(TextInputStyle.Paragraph))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_tickets_btn') {
                const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Advanced Ticket Setup');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Description').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_cats').setLabel('Categories (Comma separated)').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Category ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('LOGS_ID, STAFF_ROLE_ID').setRequired(true).setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Welcome Message').setRequired(true).setStyle(TextInputStyle.Paragraph))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'setup_auto_btn') {
                const modal = new ModalBuilder().setCustomId('modal_auto_response').setTitle('💬 Auto Response Core');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('auto_input_box')
                            .setLabel('Format: trigger:reply || trigger:reply')
                            .setPlaceholder('e.g., ip:play.sparklemc.in || upi:Scanner text')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Paragraph)
                    )
                );
                return await interaction.showModal(modal);
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
                    await interaction.reply({ content: '🗑️ Closing space arrays permanently in 5 seconds...' });
                    await OrderTicket.deleteOne({ channelId: interaction.channel.id });
                    setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
                }
            }
                }
        
                // 3. MODAL SUBMISSIONS HANDLER
        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'modal_stats_setup') {
                const tId = interaction.fields.getTextInputValue('stats_total_input').trim();
                const oId = interaction.fields.getTextInputValue('stats_online_input').trim();
                await GuildConfig.findOneAndUpdate({ guildId }, { totalMembersChan: tId, onlinePlayersChan: oId }, { upsert: true });
                return await interaction.editReply({ content: '✅ **Saved Stats Configuration Successfully!** Voice channels connected.' });
            }

            if (interaction.customId === 'youtube_modal_submit') {
                const ytId = interaction.fields.getTextInputValue('yt_channel_id_input').trim();
                const lId = interaction.fields.getTextInputValue('yt_live_chan_input').trim();
                const uId = interaction.fields.getTextInputValue('yt_upload_chan_input').trim();
                await GuildConfig.findOneAndUpdate({ guildId }, { ytChannelId: ytId, ytLiveChannel: lId, ytUploadChannel: uId }, { upsert: true });
                return await interaction.editReply({ content: '✅ **Connected YouTube System Successfully!** Alerts enabled.' });
            }

            if (interaction.customId === 'modal_store_cfg') {
                const serverName = interaction.fields.getTextInputValue('cfg_name');
                const adminRoleId = interaction.fields.getTextInputValue('cfg_role');
                const logsChannelId = interaction.fields.getTextInputValue('cfg_logs');
                const bulkInput = interaction.fields.getTextInputValue('cfg_items');

                const categories = [];
                const items = [];

                if (bulkInput) {
                    const categoryBlocks = bulkInput.split('||');
                    categoryBlocks.forEach(block => {
                        const parts = block.split(':');
                        if (parts.length < 2) return;
                        const catName = parts[0].trim();
                        const itemsRaw = parts[1].split(',');
                        if (!categories.includes(catName) && catName) categories.push(catName);
                        itemsRaw.forEach(iRaw => {
                            const itemParts = iRaw.split('-');
                            if (itemParts.length < 2) return;
                            const iName = itemParts[0].trim();
                            const iPrice = parseInt(itemParts[1].replace(/[^0-9]/g, ''), 10);
                            if (iName && !isNaN(iPrice)) {
                                items.push({ category: catName, name: iName, price: iPrice, command: '' });
                            }
                        });
                    });
                }

                await GuildStore.findOneAndUpdate({ guildId }, { serverName, adminRoleId, logsChannelId, categories, items }, { upsert: true });
                return await interaction.editReply({ content: '✅ **Button 1 Saved!** Stock & Categories updated.' });
            }

            if (interaction.customId === 'modal_store_visual') {
                const panelTitle = interaction.fields.getTextInputValue('pnl_title');
                const panelDescription = interaction.fields.getTextInputValue('pnl_desc');
                const panelBanner = interaction.fields.getTextInputValue('pnl_banner');
                const targetChanId = interaction.fields.getTextInputValue('pnl_chan');

                const store = await GuildStore.findOneAndUpdate({ guildId }, { panelTitle, panelDescription, panelBanner }, { upsert: true, new: true });
                const targetChannel = interaction.guild.channels.cache.get(targetChanId);

                if (!targetChannel) return await interaction.editReply({ content: '❌ Invalid Destination Channel ID!' });

                const embed = new EmbedBuilder().setTitle(panelTitle).setDescription(panelDescription).setColor('#5865F2').setTimestamp();
                if (panelBanner && panelBanner.startsWith('http')) embed.setImage(panelBanner);

                if (!store.categories || store.categories.length === 0) {
                    return await interaction.editReply({ content: '❌ Please setup Button 1 (Stock) first!' });
                }

                const options = store.categories.map(cat => ({ label: cat, value: `store_cat_${cat}` }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('store_category_select').setPlaceholder('🗂️ Choose a Category...').addOptions(options)
                );

                await targetChannel.send({ embeds: [embed], components: [row] });
                return await interaction.editReply({ content: `🚀 **Button 2 Complete!** Store deployed in <#${targetChanId}>.` });
            }

            if (interaction.customId === 'modal_store_execution') {
                const consoleChannelId = interaction.fields.getTextInputValue('exe_console');
                const mappingsRaw = interaction.fields.getTextInputValue('exe_cmds').split('||').map(m => m.trim());

                const store = await GuildStore.findOne({ guildId });
                if (!store) return await interaction.editReply({ content: '❌ Setup Button 1 first!' });

                store.consoleChannelId = consoleChannelId;
                mappingsRaw.forEach(mapping => {
                    const parts = mapping.split(':');
                    const iName = parts[0]?.trim();
                    const iCmd = parts[1]?.trim();
                    const matchedItem = store.items.find(i => i.name.toLowerCase() === iName.toLowerCase());
                    if (matchedItem) matchedItem.command = iCmd;
                });

                await store.save();
                return await interaction.editReply({ content: '⚙️ **Button 3 Complete!** Commands mapped.' });
            }

            if (interaction.customId === 'modal_store_dms') {
                const dmApproved = interaction.fields.getTextInputValue('dm_app');
                const dmRejected = interaction.fields.getTextInputValue('dm_rej');
                const dmPendingReminder = interaction.fields.getTextInputValue('dm_pend');

                await GuildStore.findOneAndUpdate({ guildId }, { dmApproved, dmRejected, dmPendingReminder }, { upsert: true });
                return await interaction.editReply({ content: '✅ **Button 4 Complete!** Custom DM Alert templates saved.' });
            }

            if (interaction.customId === 'modal_auto_response') {
                const bulkInput = interaction.fields.getTextInputValue('auto_input_box');
                const autoResponses = [];
                if (bulkInput && bulkInput.trim().length > 0) {
                    const responseBlocks = bulkInput.split('||');
                    responseBlocks.forEach(block => {
                        const firstColonIndex = block.indexOf(':');
                        if (firstColonIndex === -1) return;
                        const triggerWord = block.substring(0, firstColonIndex).trim().toLowerCase();
                        const replyString = block.substring(firstColonIndex + 1).trim();
                        if (triggerWord && replyString) {
                            autoResponses.push({ trigger: triggerWord, replyText: replyString });
                        }
                    });
                }
                await GuildConfig.findOneAndUpdate({ guildId }, { autoResponses }, { upsert: true });
                return await interaction.editReply({ content: '✅ Custom auto-responses setup live!' });
            }

            if (interaction.customId.startsWith('modal_player_checkout_')) {
                const itemUniqueId = interaction.customId.replace('modal_player_checkout_', '');
                const buyerIGN = interaction.fields.getTextInputValue('player_ign');

                const store = await GuildStore.findOne({ guildId });
                const item = store?.items.find(i => i._id.toString() === itemUniqueId);

                if (!item) return await interaction.editReply({ content: '❌ Item expired or deleted.' });

                const ticketRoom = await interaction.guild.channels.create({
                    name: `order-${interaction.user.username}`,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        ...(store.adminRoleId ? [{ id: store.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                    ]
                });

                await OrderTicket.create({
                    guildId,
                    channelId: ticketRoom.id,
                    buyerId: interaction.user.id,
                    buyerIGN,
                    itemName: item.name,
                    itemPrice: item.price,
                    itemCategory: item.category
                });

                const embed = new EmbedBuilder()
                    .setTitle('📥 NEW INBOUND ORDER')
                    .setColor('#FFCC00')
                    .addFields(
                        { name: '👤 Buyer Account', value: `${interaction.user}`, inline: true },
                        { name: '🎮 IGN', value: `\`${buyerIGN}\``, inline: true },
                        { name: '📦 Selected Package', value: `**${item.name}** (${item.category})`, inline: false },
                        { name: '💰 Price', value: `\`${item.price} INR\``, inline: true }
                    )
                    .setTimestamp();

                const controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_order_approve').setLabel('Approve Order').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_order_reject').setLabel('Reject Order').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_order_delete').setLabel('Delete Room').setStyle(ButtonStyle.Secondary)
                );

                await ticketRoom.send({ content: `${interaction.user} | <@&${store.adminRoleId}>`, embeds: [embed], components: [controlRow] });
                return await interaction.editReply({ content: `🎯 Order channel opened: ${ticketRoom}` });
            }
        }

        // 4. SELECT MENUS HANDLER
        if (interaction.isStringSelectMenu()) {
            const store = await GuildStore.findOne({ guildId });
            if (!store) return;

            if (interaction.customId === 'store_category_select') {
                const chosenCat = interaction.values[0].replace('store_cat_', '');
                const filteredItems = store.items.filter(i => i.category === chosenCat);

                if (filteredItems.length === 0) return await interaction.reply({ content: '❌ No items in this category.', ephemeral: true });

                const options = filteredItems.map(i => ({ label: `${i.name} - ${i.price} INR`, value: `store_itm_${i._id.toString()}` }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('store_item_select').setPlaceholder('📦 Choose item to buy...').addOptions(options)
                );

                return await interaction.reply({ content: `📁 Category: **${chosenCat}**`, components: [row], ephemeral: true });
            }

            if (interaction.customId === 'store_item_select') {
                const itemDbId = interaction.values[0].replace('store_itm_', '');
                const targetItem = store.items.find(i => i._id.toString() === itemDbId);

                const buyRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`btn_trigger_checkout_${itemDbId}`).setLabel(`Order: ${targetItem.name} (${targetItem.price} INR)`).setStyle(ButtonStyle.Primary)
                );

                return await interaction.reply({ content: `🛒 Buy **${targetItem.name}**? Click checkout below:`, components: [buyRow], ephemeral: true });
            }
        }
    } catch (err) {
        console.error("Interaction Exception Handled:", err);
    }
});

// ================= TIMED LOOP (STATS REFRESH + 12H REMINDERS + YT NOTIFIER) =================
setInterval(async () => {
    try {
        // 1. Live Server Stats Refresh Loop
        const stats = await GuildConfig.find({ onlinePlayersChan: { $ne: null } });
        for (const config of stats) {
            const g = await client.guilds.fetch(config.guildId).catch(() => null);
            if (!g) continue;
            const mems = await g.members.fetch({ withPresences: true }).catch(() => null);
            const on = mems ? mems.filter(m => m.presence && m.presence.status !== 'offline').size : 0;
            if (config.onlinePlayersChan) {
                const chan = g.channels.cache.get(config.onlinePlayersChan);
                if (chan) await chan.setName(`🟢 Online Players: ${on}`).catch(() => null);
            }
        }

        // 2. Pending Order 12h Reminders
        const twelveHoursAgo = new Date(Date.now() - (12 * 60 * 60 * 1000));
        const pendingTickets = await OrderTicket.find({ lastReminderSent: { $lte: twelveHoursAgo } });

        for (const ticket of pendingTickets) {
            const store = await GuildStore.findOne({ guildId: ticket.guildId });
            if (!store) continue;

            const buyer = await client.users.fetch(ticket.buyerId).catch(() => null);
            if (buyer) {
                const msg = (store.dmPendingReminder || "⏰ **Pending Order Reminder [{{server}}]!** Your order for **{{item}}** is still pending.")
                    .replace(/{{server}}/g, store.serverName)
                    .replace(/{{item}}/g, ticket.itemName);

                await buyer.send({ content: msg }).catch(() => null);
                ticket.lastReminderSent = new Date();
                await ticket.save();
            }
        }

        // 3. YouTube Live & Upload Notifier
        const yts = await GuildConfig.find({ ytChannelId: { $ne: null } });
        for (const config of yts) {
            const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${config.ytChannelId}`).catch(() => null);
            if (!feed || !feed.items || feed.items.length === 0) continue;
            const item = feed.items[0];
            const vId = item.id.replace('yt:video:', '');
            if (config.ytLastVideoId === vId) continue;
            config.ytLastVideoId = vId;
            await config.save();
            const g = await client.guilds.fetch(config.guildId).catch(() => null);
            if (!g) continue;
            const isLive = item.title.toLowerCase().includes('live') || item.title.toLowerCase().includes('stream');
            const target = isLive ? config.ytLiveChannel : config.ytUploadChannel;
            if (target) {
                const c = g.channels.cache.get(target);
                if (c) {
                    const msg = isLive ? `🔴 **LIVE NOW!** \n📢 **${item.title}**\n👉 ${item.link} @everyone` : `🎬 **NEW UPLOAD!** \n📢 **${item.title}**\n👉 ${item.link} @everyone`;
                    await c.send({ content: msg }).catch(() => null);
                }
            }
        }
    } catch (e) { console.error("Background Loop Exception:", e); }
}, 300000);

client.login(process.env.DISCORD_TOKEN);
