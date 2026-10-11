import {SlashCommandBuilder} from "discord.js";
import {brandEmbed} from "../../utils/embeds.js";
export default {
  name: "botinfo",
  data: new SlashCommandBuilder().setName("botinfo").setDescription("Show basic bot information."),
  async execute({interaction, client}) {
    const embed = brandEmbed(`🤖 ${client.user.username}`, "A multipurpose Discord bot project by The Origin Labs.", {
      thumbnail: client.user.displayAvatarURL({size: 256}),
      fields: [
        {name: "Servers", value: `\`${client.guilds.cache.size}\``, inline: true},
        {name: "Runtime", value: `\`${process.version}\``, inline: true},
        {name: "Library", value: "discord.js v14", inline: true},
      ],
    });
    await interaction.reply({embeds: [embed]});
  },
};
