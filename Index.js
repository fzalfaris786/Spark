require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { GuildConfig, StaffAppSession } = require('./models/GuildConfig');
const { GuildStore, OrderTicket } = require('./models/GuildStore');
const InviteData = require('./models/InviteData');

const parser = new Parser();
const guildInvites = new Map();

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

const OWNER_ID = '1266728371719508062';

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

    try {
        const owner = await client.users.fetch(OWNER_ID).catch(() => null);
        if (owner) {
            await owner.send(`🚀 **Bot Started Successfully!**\nConnected to **${client.guilds.cache.size}** servers. Type \`!bot panel\` here to manage servers.`);
        }
    } catch (e) {
        console.error("Could not send owner DM on boot:", e);
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
});

// ================= MESSAGE & OWNER DM INTERCEPTOR =================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Owner DM Panel Handler
    if (!message.guild && message.author.id === OWNER_ID) {
        const text = message.content.trim();
        if (text === '!bot panel' || text === '!panel') {
            const guilds = client.guilds.cache.map(g => ({ label: g.name.substring(0, 25), value: g.id }));
            if (guilds.length === 0) return message.reply('❌ Bot is in no servers.');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('dm_select_server_bot')
                    .setPlaceholder('Select a server to manage...')
                    .addOptions(guilds.slice(0, 25))
            );

            const leaveRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('dm_leave_server_btn')
                    .setLabel('Leave Selected Server')
                    .setStyle(ButtonStyle.Danger)
            );

            return message.reply({ content: `🤖 **Bot Management Panel**\nSelect a server below:`, components: [row, leaveRow] });
        }
        return;
    }

    if (!message.guild) return;

    // Staff Application Session Q&A Handler
    const activeSession = await StaffAppSession.findOne({ userId: message.author.id, guildId: message.guild.id });
    if (activeSession && message.channel.id === activeSession.channelId) {
        activeSession.answers.push(message.content);
        activeSession.currentQuestionIndex += 1;
        await message.delete().catch(() => {});

        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        const questions = config?.appQuestions || [];

        if (activeSession.currentQuestionIndex < questions.length) {
            const nextQ = questions[activeSession.currentQuestionIndex];
            await message.channel.send({ content: `${message.author}, **Question ${activeSession.currentQuestionIndex + 1}:** ${nextQ}` });
            await activeSession.save();
        } else {
            // Application completed, send data to staff channel
            await StaffAppSession.deleteOne({ _id: activeSession._id });
            await message.channel.send({ content: `✅ **Application Submitted Successfully!** Please make sure your Direct Messages (DMs) are open so you can receive approval/rejection updates. This channel will close in 5 seconds.` });

            const staffChan = message.guild.channels.cache.get(config.appStaffChannelId);
            if (staffChan) {
                const embed = new EmbedBuilder()
                    .setTitle('📝 NEW STAFF APPLICATION')
                    .setColor('#00FFCC')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Applicant', value: `${message.author} (\`${message.author.id}\`)`, inline: false }
                    );

                questions.forEach((q, idx) => {
                    embed.addFields({ name: `Q${idx + 1}: ${q}`, value: activeSession.answers[idx] || 'No answer', inline: false });
                });

                const evalRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_approve_${message.author.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`app_reject_${message.author.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
                );

                await staffChan.send({ embeds: [embed], components: [evalRow] });
            }

            setTimeout(() => message.channel.delete().catch(() => {}), 5000);
        }
        return;
    }

    // Auto Responses
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

// ================= WELCOME & INVITE TRACKER JOIN =================
client.on('guildMemberAdd', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (config && config.welcomeChannel) {
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
        if (config && config.totalMembersChan) {
            const chan = member.guild.channels.cache.get(config.totalMembersChan);
            if (chan) await chan.setName(`🪐 Total Members: ${member.guild.memberCount}`).catch(() => null);
        }

        const cachedInvites = guildInvites.get(member.guild.id) || new Map();
        const newInvites = await member.guild.invites.fetch().catch(() => null);
        
        let inviter = null;
        if (newInvites) {
            const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
            if (usedInvite && usedInvite.inviter) inviter = usedInvite.inviter;

            const codeUses = new Map();
            newInvites.forEach(inv => codeUses.set(inv.code, inv.uses));
            guildInvites.set(member.guild.id, codeUses);
        }

        if (inviter) {
            const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            const isFake = accountAgeDays < 7;

            const invData = await InviteData.findOne({ guildId: member.guild.id, userId: inviter.id }) || new InviteData({ guildId: member.guild.id, userId: inviter.id });

            if (isFake) invData.permFake += 1;
            else invData.permRegular += 1;
            await invData.save();

            if (config && config.inviteLogChannel) {
                const logChan = member.guild.channels.cache.get(config.inviteLogChannel);
                if (logChan) {
                    const lifetimeTotal = invData.permRegular - invData.permLeaves - invData.permFake;
                    const logCard = `👤 Member     : ${member.user.tag}\n🔗 Invited By : ${inviter.tag}\n--------------------------------\n📊 Lifetime Stats: ${lifetimeTotal} Total (${invData.permRegular} Reg | ${invData.permLeaves} Leaves)`;
                    const embed = new EmbedBuilder().setTitle('📥 MEMBER JOIN LOG').setDescription(logCard).setColor('#00FF00').setTimestamp();
                    await logChan.send({ embeds: [embed] }).catch(() => null);
                }
            }
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

// ================= INTERACTION ROUTER =================
client.on('interactionCreate', async (interaction) => {
    try {
        // Owner DM Panel
        if (!interaction.guild && interaction.user.id === OWNER_ID) {
            if (interaction.isStringSelectMenu() && interaction.customId === 'dm_select_server_bot') {
                const selectedGuildId = interaction.values[0];
                const guild = client.guilds.cache.get(selectedGuildId);
                if (!guild) return interaction.reply({ content: '❌ Guild not found.', ephemeral: true });

                return interaction.update({ 
                    content: `✅ Selected Server: **${guild.name}**\nClick below to leave this server if needed:`, 
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_leave_${selectedGuildId}`).setLabel(`Leave ${guild.name}`).setStyle(ButtonStyle.Danger)
                        )
                    ] 
                });
            }

            if (interaction.isButton() && interaction.customId.startsWith('confirm_leave_')) {
                const guildId = interaction.customId.split('_')[2];
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    const name = guild.name;
                    await guild.leave();
                    return interaction.update({ content: `✅ Successfully left server: **${name}**`, components: [] });
                }
                return interaction.update({ content: `❌ Server not found.`, components: [] });
            }
            return;
        }

        const guildId = interaction.guild?.id;
        if (!guildId) return;

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (command) await command.execute(interaction);
            return;
        }

        if (interaction.isButton()) {
            // Invite Leaderboard Button
            if (interaction.customId === 'btn_inv_guild_lb') {
                await interaction.deferReply();
                const fetchedInvites = await interaction.guild.invites.fetch().catch(() => null);
                
                let inviteMap = new Map();
                if (fetchedInvites) {
                    fetchedInvites.forEach(inv => {
                        if (inv.inviter) {
                            const prev = inviteMap.get(inv.inviter.id) || 0;
                            inviteMap.set(inv.inviter.id, prev + inv.uses);
                        }
                    });
                }

                const dbData = await InviteData.find({ guildId });
                dbData.forEach(d => {
                    const dbTotal = d.permRegular - d.permLeaves - d.permFake;
                    const inviterUses = inviteMap.get(d.userId) || 0;
                    inviteMap.set(d.userId, Math.max(dbTotal, inviterUses));
                });

                const sorted = Array.from(inviteMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

                if (sorted.length === 0) {
                    return await interaction.followUp({ content: '❌ No active invite links found in this server.' });
                }

                let str = '```text\n';
                const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️'];
                for (let i = 0; i < sorted.length; i++) {
                    const u = await interaction.client.users.fetch(sorted[i][0]).catch(() => null);
                    str += `${medals[i]} ${i+1}. ${(u ? u.username : 'Unknown').padEnd(12, ' ')} • ${sorted[i][1]} Invites\n`;
                }
                str += '```';

                const embed = new EmbedBuilder().setTitle('🏆 TOP 10 LIFETIME INVITES').setDescription(str).setColor('#00FF00');
                return await interaction.followUp({ embeds: [embed] });
            }

            if (interaction.customId === 'btn_inv_logs_cfg') {
                const modal = new ModalBuilder().setCustomId('modal_inv_logs').setTitle('Setup Invite Log Channel');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inv_log_input').setLabel('Invite Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short)));
                return await interaction.showModal(modal);
            }

            // Staff Application Setup Buttons
            if (interaction.customId === 'setup_app_config') {
                const store = await GuildConfig.findOne({ guildId });
                const modal = new ModalBuilder().setCustomId('modal_app_config').setTitle('Configure Staff Application');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_staff_chan').setLabel('Staff Review Channel ID').setRequired(true).setStyle(TextInputStyle.Short).setValue(store?.appStaffChannelId || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_role').setLabel('Staff Role ID (for ping/perms)').setRequired(true).setStyle(TextInputStyle.Short).setValue(store?.appStaffRoleId || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_qs').setLabel('Questions (Separated by ||)').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.appQuestions?.join(' || ') || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_dm_app').setLabel('Approval DM Message').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.appDmApproved || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_dm_rej').setLabel('Rejection DM Message').setRequired(true).setStyle(TextInputStyle.Paragraph).setValue(store?.appDmRejected || ''))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'deploy_app_panel') {
                const modal = new ModalBuilder().setCustomId('modal_deploy_app').setTitle('Deploy Application Button');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('app_target_chan').setLabel('Target Channel ID to send Panel').setRequired(true).setStyle(TextInputStyle.Short)));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_start_staff_apply') {
                const config = await GuildConfig.findOne({ guildId });
                if (!config || !config.appStaffChannelId) {
                    return await interaction.reply({ content: '❌ Staff application system is not fully configured by admins yet.', ephemeral: true });
                }

                const existingSession = await StaffAppSession.findOne({ userId: interaction.user.id, guildId });
                if (existingSession) {
                    return await interaction.reply({ content: '⚠️ You already have an active application session in <#' + existingSession.channelId + '>', ephemeral: true });
                }

                const appChannel = await interaction.guild.channels.create({
                    name: `app-${interaction.user.username}`,
                    parent: config.ticketParent || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        ...(config.appStaffRoleId ? [{ id: config.appStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                    ]
                });

                await StaffAppSession.create({
                    userId: interaction.user.id,
                    guildId,
                    channelId: appChannel.id,
                    currentQuestionIndex: 0,
                    answers: []
                });

                const firstQ = config.appQuestions[0] || 'What is your name?';
                await appChannel.send({ content: `${interaction.user} | <@&${config.appStaffRoleId}>\n\n📝 **Staff Application Started!**\n**Question 1:** ${firstQ}` });
                return await interaction.reply({ content: `✅ Application channel created: ${appChannel}`, ephemeral: true });
            }

            // Approve/Reject Staff Application Buttons
            if (interaction.customId.startsWith('app_approve_') || interaction.customId.startsWith('app_reject_')) {
                const isApprove = interaction.customId.startsWith('app_approve_');
                const targetUserId = interaction.customId.replace(isApprove ? 'app_approve_' : 'app_reject_', '');
                
                const config = await GuildConfig.findOne({ guildId });
                const targetUser = await client.users.fetch(targetUserId).catch(() => null);

                if (targetUser) {
                    const msgTemplate = isApprove ? (config?.appDmApproved || 'Your application was approved!') : (config?.appDmRejected || 'Your application was rejected.');
                    const finalMsg = msgTemplate.replace(/{{server}}/g, interaction.guild.name);
                    await targetUser.send({ content: finalMsg }).catch(() => {});
                }

                const resultEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(isApprove ? '#00FF00' : '#FF0000')
                    .addFields({ name: '⚡ Status', value: isApprove ? `✅ Approved by ${interaction.user.tag}` : `❌ Rejected by ${interaction.user.tag}`, inline: false });

                await interaction.update({ embeds: [resultEmbed], components: [] });
                return;
            }

            // --- SUPPORT TICKET CLAIM & PING LOGIC ---
            const config = await GuildConfig.findOne({ guildId });
            if (interaction.customId === 'claim_ticket') {
                if (config && config.ticketRole && !interaction.member.roles.cache.has(config.ticketRole)) {
                    return await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
                }

                if (interaction.channel.name.startsWith('claimed-')) {
                    return await interaction.reply({ content: '⚠️ This ticket is already claimed!', ephemeral: true });
                }

                const newName = interaction.channel.name.replace('ticket-', 'claimed-');
                await interaction.channel.setName(newName).catch(() => {});
                await interaction.reply({ content: `🔒 Ticket claimed by ${interaction.user}` });

                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claimed').setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
                );
                return await interaction.message.edit({ components: [newRow] });
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

            if (interaction.customId === 'modal_inv_logs') {
                const channelId = interaction.fields.getTextInputValue('inv_log_input').trim();
                await GuildConfig.findOneAndUpdate({ guildId }, { inviteLogChannel: channelId }, { upsert: true });
                return await interaction.editReply({ content: `✅ **Saved!** Invite logs channel updated to <#${channelId}>.` });
            }

            if (interaction.customId === 'modal_app_config') {
                const staffChanId = interaction.fields.getTextInputValue('app_staff_chan').trim();
                const staffRoleId = interaction.fields.getTextInputValue('app_role').trim();
                const qsRaw = interaction.fields.getTextInputValue('app_qs').trim();
                const dmApp = interaction.fields.getTextInputValue('app_dm_app').trim();
                const dmRej = interaction.fields.getTextInputValue('app_dm_rej').trim();

                const questions = qsRaw.split('||').map(q => q.trim()).filter(Boolean);

                await GuildConfig.findOneAndUpdate({ guildId }, {
                    appStaffChannelId: staffChanId,
                    appStaffRoleId: staffRoleId,
                    appQuestions: questions,
                    appDmApproved: dmApp,
                    appDmRejected: dmRej
                }, { upsert: true });

                return await interaction.editReply({ content: '✅ **Staff Application Settings Saved Successfully!**' });
            }

            if (interaction.customId === 'modal_deploy_app') {
                const targetChanId = interaction.fields.getTextInputValue('app_target_chan').trim();
                const targetChan = interaction.guild.channels.cache.get(targetChanId);
                if (!targetChan) return await interaction.editReply({ content: '❌ Invalid channel ID.' });

                const embed = new EmbedBuilder()
                    .setTitle('🛡️ STAFF APPLICATION')
                    .setDescription('Want to join our staff team? Click the button below to start your application process.')
                    .setColor('#5865F2')
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_start_staff_apply').setLabel('Apply for Staff').setStyle(ButtonStyle.Primary).setEmoji('📋')
                );

                await targetChan.send({ embeds: [embed], components: [row] });
                return await interaction.editReply({ content: `✅ Successfully deployed Staff Application panel in <#${targetChanId}>` });
            }

            if (interaction.customId === 'modal_ticket') {
                const logsData = interaction.fields.getTextInputValue('t_logs').split(',');
                const cats = interaction.fields.getTextInputValue('t_cats').split(',').map(c => c.trim());
                const descData = interaction.fields.getTextInputValue('t_desc').split('||');
                const panelDescription = descData[0]?.trim();
                const panelImage = descData[1]?.trim() || '';

                await GuildConfig.findOneAndUpdate({ guildId }, {
                    ticketDescription: panelDescription,
                    ticketParent: interaction.fields.getTextInputValue('t_parent'),
                    ticketLogs: logsData[0]?.trim(),
                    ticketRole: logsData[1]?.trim(),
                    ticketMessage: interaction.fields.getTextInputValue('t_msg').trim()
                }, { upsert: true, new: true });

                const embed = new EmbedBuilder().setTitle('🎫 Create a Ticket').setDescription(panelDescription).setColor('#5865F2');
                if (panelImage && panelImage.startsWith('http')) embed.setImage(panelImage);

                const options = cats.map(cat => ({ label: cat, value: cat }));
                const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').addOptions(options);
                await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
                return await interaction.editReply({ content: '✅ Deployed Support Tickets Panel Successfully!' });
            }
        }

        // Select Menus (Tickets)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_select') {
                const config = await GuildConfig.findOne({ guildId });
                if (!config) return;

                const selectedCategory = interaction.values[0]; 
                const name = `ticket-${interaction.user.username.toLowerCase()}`;
                
                if (interaction.guild.channels.cache.find(c => c.name === name || c.name.startsWith(`claimed-${interaction.user.username.toLowerCase()}`))) {
                    return await interaction.reply({ content: '❌ You already have an active ticket.', ephemeral: true });
                }
                
                await interaction.deferReply({ ephemeral: true });
                const ch = await interaction.guild.channels.create({
                    name, parent: config.ticketParent || null,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        ...(config.ticketRole ? [{ id: config.ticketRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                    ]
                });

                let parsedMessage = config.ticketMessage || 'Thank you for contacting support.';
                parsedMessage = parsedMessage.replace(/{user}/g, `${interaction.user}`).replace(/{{User.Mention}}/g, `${interaction.user}`).replace(/{{user.mention}}/g, `${interaction.user}`);
                
                // Specific ping requirement for ticket creator & ticket role staff
                const staffPing = config.ticketRole ? `<@&${config.ticketRole}>` : '';
                const fullPingContent = `${interaction.user} ${staffPing}`;

                const embed = new EmbedBuilder().setTitle('🎫 Ticket Support Terminal').setDescription(parsedMessage).addFields({ name: '🗂️ Category', value: `\`${selectedCategory}\``, inline: false }).setColor('#00ffcc');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));

                await ch.send({ content: fullPingContent, embeds: [embed], components: [row] });
                return await interaction.editReply({ content: `Generated: ${ch}` });
            }
        }
    } catch (err) {
        console.error("Interaction Exception Handled:", err);
    }
});

client.login(process.env.DISCORD_TOKEN);
