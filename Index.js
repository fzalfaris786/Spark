const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const GuildConfig = require('./models/GuildConfig');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = [];

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
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

// ================= WELCOME EVENT =================
client.on('guildMemberAdd', async (member) => {
    try {
        const config = await GuildConfig.findOne({ guildId: member.guild.id });
        if (!config || !config.welcomeChannel) return;

        const channel = member.guild.channels.cache.get(config.welcomeChannel);
        if (channel) {
            let descText = config.welcomeMessage || 'Welcome!';
            descText = descText.replace(/{user}/g, `${member}`).replace(/{memberCount}/g, `${member.guild.memberCount}`);

            const embed = new EmbedBuilder()
                .setTitle(config.welcomeTitle || 'Welcome!')
                .setDescription(descText)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('#00ffcc');

            if (config.welcomeThumbnail && config.welcomeThumbnail.startsWith('http')) embed.setImage(config.welcomeThumbnail);
            await channel.send({ embeds: [embed] });
        }
        if (config.welcomeDm) {
            try { await member.send(config.welcomeDm); } catch (e) {}
        }
    } catch (err) { console.error(err); }
});

// ================= DYNAMIC INTERACTIONS =================
client.on('interactionCreate', async (interaction) => {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
    }

    if (interaction.isButton()) {
        const config = await GuildConfig.findOne({ guildId });

        if (interaction.customId === 'btn_welcome_setup') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Welcome Configuration');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Embed Title').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Message ({user}, {memberCount})').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner Image URL (Optional)').setRequired(false).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_dm').setLabel('DM Text on Join (Optional)').setRequired(false).setStyle(TextInputStyle.Paragraph))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_ticket_setup') {
            const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Advanced Ticket Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Panel Description').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_cats').setLabel('Dropdown (Support, Billing)').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Ticket Category Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('Logs Channel ID & Staff Role ID (Comma)').setPlaceholder('LOGS_ID, STAFF_ROLE_ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Message Inside & Optional Banner URL').setPlaceholder('Welcome Message || Image URL').setRequired(true).setStyle(TextInputStyle.Paragraph))
            );
            return await interaction.showModal(modal);
        }

        // --- BUTTON ACTIONS STAFF ONLY ROLE VERIFICATION ---
        if (interaction.customId === 'claim_ticket' || interaction.customId === 'close_ticket') {
            if (config && config.ticketRole && !interaction.member.roles.cache.has(config.ticketRole)) {
                return await interaction.reply({ content: '❌ Only designated Staff can manage this ticket.', ephemeral: true });
            }
        }

        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `🔒 Ticket claimed by ${interaction.user}` });
            interaction.component.setDisabled(true);
            return await interaction.message.edit({ components: [interaction.message.components[0]] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 Generating transcript and cleaning up in 5 seconds...');
            
            // TRANSCRIPT GENERATION LOGIC
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcriptText = `--- TICKET TRANSCRIPT FOR #${interaction.channel.name} ---\n\n`;
            
            [...fetchedMessages.values()].reverse().forEach(msg => {
                transcriptText += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
            });

            const buffer = Buffer.from(transcriptText, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

            if (config && config.ticketLogs) {
                const logChan = interaction.guild.channels.cache.get(config.ticketLogs);
                if (logChan) {
                    await logChan.send({ 
                        content: `🗑️ Ticket \`${interaction.channel.name}\` permanently closed by ${interaction.user.tag}. Logs attached below.`,
                        files: [attachment] 
                    });
                }
            }
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.customId === 'modal_welcome') {
            await GuildConfig.findOneAndUpdate(
                { guildId },
                {
                    welcomeTitle: interaction.fields.getTextInputValue('w_title'),
                    welcomeMessage: interaction.fields.getTextInputValue('w_msg'),
                    welcomeChannel: interaction.fields.getTextInputValue('w_chan'),
                    welcomeThumbnail: interaction.fields.getTextInputValue('w_thumb') || '',
                    welcomeDm: interaction.fields.getTextInputValue('w_dm') || ''
                },
                { upsert: true, new: true }
            );
            return await interaction.editReply({ content: '✅ Welcome configurations successfully saved!' });
        }

        if (interaction.customId === 'modal_ticket') {
            try {
                const rawLogsRole = interaction.fields.getTextInputValue('t_logs').split(',');
                const logsId = rawLogsRole[0]?.trim();
                const roleId = rawLogsRole[1]?.trim();

                const rawMsgImg = interaction.fields.getTextInputValue('t_msg').split('||');
                const mainMsg = rawMsgImg[0]?.trim();
                const imgBanner = rawMsgImg[1]?.trim() || '';

                const categories = interaction.fields.getTextInputValue('t_cats').split(',').map(c => c.trim());
                
                const config = await GuildConfig.findOneAndUpdate(
                    { guildId },
                    {
                        ticketDescription: interaction.fields.getTextInputValue('t_desc'),
                        ticketParent: interaction.fields.getTextInputValue('t_parent'),
                        ticketLogs: logsId,
                        ticketRole: roleId,
                        ticketMessage: mainMsg,
                        ticketImage: imgBanner
                    },
                    { upsert: true, new: true }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🎫 Create a Support Ticket')
                    .setDescription(config.ticketDescription)
                    .setColor('#5865F2');

                if (config.ticketImage && config.ticketImage.startsWith('http')) embed.setImage(config.ticketImage);

                const options = categories.map(cat => ({ label: cat, value: cat, description: `Open ticket for ${cat}` }));
                const selectMenu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choose a topic...').addOptions(options);
                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.channel.send({ embeds: [embed], components: [row] });
                return await interaction.editReply({ content: '✅ Advanced Ticket Panel deployed!' });
            } catch (e) {
                console.error(e);
                return await interaction.editReply({ content: '❌ Input parse processing error.' });
            }
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const config = await GuildConfig.findOne({ guildId });
        if (!config) return;

        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) return await interaction.reply({ content: '❌ Aapki ek ticket pehle se active hai!', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            parent: config.ticketParent || null,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...(config.ticketRole ? [{ id: config.ticketRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
            ]
        });

        const embed = new EmbedBuilder().setTitle('Ticket Panel Initialized').setDescription(config.ticketMessage).setColor('#57F287');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: `Ticket channel has been generated: ${ticketChannel}` });
    }
});

// ================= GLOBAL BACKGROUND STATS ENGINE =================
const GuildConfig = require('./models/GuildConfig');

setInterval(async () => {
    try {
        // Database se un saare servers ki list nikalo jinhone stats setup kiya hai
        const configs = await GuildConfig.find({ 
            totalMembersChan: { $ne: null }, 
            onlinePlayersChan: { $ne: null } 
        });
        
        for (const config of configs) {
            const guild = await client.guilds.fetch(config.guildId).catch(() => null);
            if (!guild) continue;

            const totalMembers = guild.memberCount;
            
            // Online players fetch karne ke liye presences lazmi hain
            const members = await guild.members.fetch({ withPresences: true }).catch(() => null);
            const onlinePlayers = members ? members.filter(m => m.presence && m.presence.status !== 'offline').size : 0;

            // Total Members Channel Update
            if (config.totalMembersChan) {
                const chan = guild.channels.cache.get(config.totalMembersChan);
                if (chan) await chan.setName(`🪐 Total Members: ${totalMembers}`).catch(() => null);
            }

            // Online Players Channel Update
            if (config.onlinePlayersChan) {
                const chan = guild.channels.cache.get(config.onlinePlayersChan);
                if (chan) await chan.setName(`🟢 Online Players: ${onlinePlayers}`).catch(() => null);
            }
        }
    } catch (err) {
        console.error("Background Stats Engine Error:", err);
    }
}, 600000); // Har 10 minute mein auto-update loop chalaega

// client.login(process.env.TOKEN); <-- IS LINE KE THEEK UPAR PASTE KARNA HAI


client.login(process.env.DISCORD_TOKEN);
