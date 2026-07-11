const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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

// Load Commands dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
}

// Global Core ready Engine
client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} naye avatar me online hai!`);
    
    if (process.env.MONGO_URI) {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('🍃 MongoDB successfully connected via Railway!');
        } catch (err) {
            console.error('❌ Database connection error:', err);
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray });
        console.log('✅ Registered global slash commands!');
    } catch (error) {
        console.error(error);
    }
});

// ================= WELCOME HANDLER EVENT =================
client.on('guildMemberAdd', async (member) => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config || !config.welcomeChannel) return;

    const channel = member.guild.channels.cache.get(config.welcomeChannel);
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle(config.welcomeTitle || 'Welcome!')
            .setDescription(config.welcomeMessage.replace(/{user}/g, `${member}`))
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true })) // Notes matching constraint (Always right side)
            .setColor('#00ffcc');

        if (config.welcomeThumbnail) embed.setImage(config.welcomeThumbnail);
        await channel.send({ embeds: [embed] });
    }

    if (config.welcomeDm) {
        try { await member.send(config.welcomeDm); } catch (e) {}
    }
});

// ================= DYNAMIC INTERACTIONS (INTERACTION CREATE) =================
client.on('interactionCreate', async (interaction) => {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_welcome_setup') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Welcome Configuration');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Embed Title').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Message Content ({user} for tags)').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner/Image URL (Optional)').setRequired(false).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_dm').setLabel('DM Text on Join (Optional)').setRequired(false).setStyle(TextInputStyle.Short))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_ticket_setup') {
            const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Ticket Configuration');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Panel Description').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_cats').setLabel('Dropdown Items (comma separated)').setPlaceholder('Support, Billing, Staff').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Ticket Category Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('Logs Channel ID').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_msg').setLabel('Message inside open ticket').setRequired(true).setStyle(TextInputStyle.Paragraph))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `🔒 Ticket claimed by ${interaction.user}` });
            interaction.component.setDisabled(true);
            return await interaction.message.edit({ components: [interaction.message.components[0]] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 Closing ticket and cleaning channel in 5 seconds...');
            const config = await GuildConfig.findOne({ guildId });
            if (config && config.ticketLogs) {
                const logChan = interaction.guild.channels.cache.get(config.ticketLogs);
                if (logChan) logChan.send(`🗑️ Ticket channel \`${interaction.channel.name}\` closed permanently by ${interaction.user.tag}`);
            }
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_welcome') {
            await GuildConfig.findOneAndUpdate(
                { guildId },
                {
                    welcomeTitle: interaction.fields.getTextInputValue('w_title'),
                    welcomeMessage: interaction.fields.getTextInputValue('w_msg'),
                    welcomeChannel: interaction.fields.getTextInputValue('w_chan'),
                    welcomeThumbnail: interaction.fields.getTextInputValue('w_thumb'),
                    welcomeDm: interaction.fields.getTextInputValue('w_dm')
                },
                { upsert: true, new: true }
            );
            return await interaction.reply({ content: '✅ Welcome configurations successfully saved to Database!', ephemeral: true });
        }

        if (interaction.customId === 'modal_ticket') {
            const categories = interaction.fields.getTextInputValue('t_cats').split(',').map(c => c.strip ? c.strip() : c.trim());
            const config = await GuildConfig.findOneAndUpdate(
                { guildId },
                {
                    ticketDescription: interaction.fields.getTextInputValue('t_desc'),
                    ticketParent: interaction.fields.getTextInputValue('t_parent'),
                    ticketLogs: interaction.fields.getTextInputValue('t_logs'),
                    ticketMessage: interaction.fields.getTextInputValue('t_msg')
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setTitle('🎫 Create a Support Ticket')
                .setDescription(config.ticketDescription)
                .setColor('#5865F2');

            const options = categories.map(cat => ({ label: cat, value: cat, description: `Open ticket for ${cat}` }));
            const selectMenu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choose a topic...').addOptions(options);
            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({ content: '✅ Ticket Panel deployed below!', ephemeral: true });
            return await interaction.channel.send({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const config = await GuildConfig.findOne({ guildId });
        if (!config) return;

        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        
        if (existingChannel) {
            return await interaction.reply({ content: '❌ Aapki ek ticket pehle se active hai!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            parent: config.ticketParent || null,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder().setTitle('Ticket Panel Initialized').setDescription(config.ticketMessage).setColor('#57F287');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ embeds: [embed], components: [row] });
        
        try { await interaction.user.send(`✅ Aapki ticket successfully create ho gayi hai: ${ticketChannel}`); } catch (e) {}
        await interaction.editReply({ content: `Ticket channel has been generated: ${ticketChannel}` });
    }
});

client.login(process.env.DISCORD_TOKEN);
