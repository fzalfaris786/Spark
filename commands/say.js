const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Bot se chat me kuch bhi bolwayen')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Jo aap bot se bolwana chahte hain')
                .setRequired(true)
        ),

    async execute(interaction) {
        const botMessage = interaction.options.getString('message');
        
        // Target channel me bolne ke baad trigger interaction ko acknowledge karega
        await interaction.channel.send({ content: botMessage });
        return await interaction.reply({ content: '✅ Message sent successfully!', ephemeral: true });
    }
};
