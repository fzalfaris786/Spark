const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const GuildConfig = require('./models/GuildConfig');

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
        try { await mongoose.connect(process.env.MONGO_URI); } catch (err) { console.error(err); }
    }
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray }); } catch (e) { console.error(e); }
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
                descText = descText.replace(/{user}/g, `${member}`).replace(/{memberCount}/g, `${member.guild.memberCount}`);
                
                // 🌟 FIXED: Added dynamic member avatar thumbnail here
                const embed = new EmbedBuilder()
                    .setTitle(config.welcomeTitle || 'Welcome!')
                    .setDescription(descText)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setColor('#00ffcc');
                
                if (config.welcomeThumbnail && config.welcomeThumbnail.startsWith('http')) {
                    embed.setImage(config.welcomeThumbnail);
                }
                await channel.send({ embeds: [embed] }).catch(() => null);
            }
        }
        if (config.totalMembersChan) {
            const chan = member.guild.channels.cache.get(config.totalMembersChan);
            if (chan) await chan.setName(`🪐 Total Members: ${member.guild.memberCount}`).catch(() => null);
        }
    } catch (err) { console.error(err); }
});

// ================= INSTANT STATS ON LEAVE =================
client.on('guildMemberRemove', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.totalMembersChan) {
            const chan = member.guild.channels.cache.get(config.totalMembersChan);
            if (chan) await chan.setName(`🪐 Total Members: ${member.guild.memberCount}`).catch(() => null);
        }
    } catch (err) { console.error(err); }
});

// ================= DYNAMIC INTERACTIONS =================
client.on('interactionCreate', async (interaction) => {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) try { await command.execute(interaction); } catch (e) { console.error(e); }
    }

    if (interaction.isButton()) {
        const config = await GuildConfig.findOne({ guildId });
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
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Welcome Message || Banner URL').setRequired(true).setStyle(TextInputStyle.Paragraph))
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
        if (interaction.customId === 'claim_ticket' || interaction.customId === 'close_ticket') {
            if (config && config.ticketRole && !interaction.member.roles.cache.has(config.ticketRole)) {
                return await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
            }
        }
        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `🔒 Ticket claimed by ${interaction.user}` });
            return await interaction.message.edit({ components: [interaction.message.components[0]] });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 Closing channel in 5 seconds...');
            const fetched = await interaction.channel.messages.fetch({ limit: 100 });
            let txt = '';
            [...fetched.values()].reverse().forEach(m => { txt += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });
            const attachment = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: 'transcript.txt' });
            if (config && config.ticketLogs) {
                const c = interaction.guild.channels.cache.get(config.ticketLogs);
                if (c) await c.send({ content: `🗑️ Closed by ${interaction.user.tag}`, files: [attachment] }).catch(() => null);
            }
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true });
        if (interaction.customId === 'modal_welcome') {
            await GuildConfig.findOneAndUpdate({ guildId }, {
                welcomeTitle: interaction.fields.getTextInputValue('w_title'),
                welcomeMessage: interaction.fields.getTextInputValue('w_msg'),
                welcomeChannel: interaction.fields.getTextInputValue('w_chan'),
                welcomeThumbnail: interaction.fields.getTextInputValue('w_thumb') || '',
                welcomeDm: interaction.fields.getTextInputValue('w_dm') || ''
            }, { upsert: true });
            return await interaction.editReply({ content: '✅ Saved Welcome!' });
        }
        if (interaction.customId === 'modal_ticket') {
            const logsData = interaction.fields.getTextInputValue('t_logs').split(',');
            const msgData = interaction.fields.getTextInputValue('t_msg').split('||');
            const cats = interaction.fields.getTextInputValue('t_cats').split(',').map(c => c.trim());
            const config = await GuildConfig.findOneAndUpdate({ guildId }, {
                ticketDescription: interaction.fields.getTextInputValue('t_desc'),
                ticketParent: interaction.fields.getTextInputValue('t_parent'),
                ticketLogs: logsData[0]?.trim(),
                ticketRole: logsData[1]?.trim(),
                ticketMessage: msgData[0]?.trim(),
                ticketImage: msgData[1]?.trim() || ''
            }, { upsert: true, new: true });
            const embed = new EmbedBuilder().setTitle('🎫 Create a Ticket').setDescription(config.ticketDescription).setColor('#5865F2');
            const options = cats.map(cat => ({ label: cat, value: cat }));
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').addOptions(options);
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
            return await interaction.editReply({ content: '✅ Deployed Tickets!' });
        }
        if (interaction.customId === 'modal_stats_setup') {
            const tId = interaction.fields.getTextInputValue('stats_total_input').trim();
            const oId = interaction.fields.getTextInputValue('stats_online_input').trim();
            await GuildConfig.findOneAndUpdate({ guildId }, { totalMembersChan: tId, onlinePlayersChan: oId }, { upsert: true });
            return await interaction.editReply({ content: '✅ Saved Stats!' });
        }
        if (interaction.customId === 'youtube_modal_submit') {
            const ytId = interaction.fields.getTextInputValue('yt_channel_id_input').trim();
            const lId = interaction.fields.getTextInputValue('yt_live_chan_input').trim();
            const uId = interaction.fields.getTextInputValue('yt_upload_chan_input').trim();
            await GuildConfig.findOneAndUpdate({ guildId }, { ytChannelId: ytId, ytLiveChannel: lId, ytUploadChannel: uId }, { upsert: true });
            return await interaction.editReply({ content: '✅ Connected YouTube!' });
        }
    }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const config = await GuildConfig.findOne({ guildId });
        if (!config) return;
        
        // Konsi category select ki hai usko variable me liya
        const selectedCategory = interaction.values[0]; 
        const name = `ticket-${interaction.user.username.toLowerCase()}`;
        
        if (interaction.guild.channels.cache.find(c => c.name === name)) {
            return await interaction.reply({ content: '❌ You already have an active ticket.', ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        // Ticket Channel Create Logic
        const ch = await interaction.guild.channels.create({
            name, 
            parent: config.ticketParent || null,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...(config.ticketRole ? [{ id: config.ticketRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
            ]
        });

        // User variables replace karne ke liye
        let finalMessage = config.ticketMessage || 'Thank you for creating a ticket.';
        finalMessage = finalMessage
            .replace(/{user}/g, `${interaction.user}`)
            .replace(/{{User.Mention}}/g, `${interaction.user}`);

        // Staff Role to ping inside the text
        if (config.ticketRole) {
            finalMessage = `${finalMessage}\n\n🔔 **Staff Ping:** <@&${config.ticketRole}>`;
        }

        // Final Embed with Selected Category Field
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket Support Terminal')
            .setDescription(finalMessage)
            .addFields({ name: '🗂️ Selected Category', value: `\`${selectedCategory}\``, inline: false })
            .setColor('#00ffcc');

        // Banner URL image rendering logic
        if (config.ticketImage && config.ticketImage.startsWith('http')) {
            embed.setImage(config.ticketImage);
        }

        // Claim and Close Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success), 
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await ch.send({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: `Generated your ticket room: ${ch}` });
        }
    
});

// ================= TIMED LIVE REFRESH LOOP =================
setInterval(async () => {
    try {
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
    } catch (e) { console.error(e); }
}, 300000);

client.login(process.env.DISCORD_TOKEN);
                                                                                                                                                              
