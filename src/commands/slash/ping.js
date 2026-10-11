import {SlashCommandBuilder} from "discord.js";
import {createEmbed, COLORS} from "../../utils/embeds.js";
export default {
  name: "ping",
  data: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency."),
  async execute({interaction, client}) {
    const latency = client.ws.ping;
    await interaction.reply({embeds: [createEmbed({
      title: "🏓 Pong!",
      description: "The bot is online and responding normally.",
      color: COLORS.success,
      fields: [
        {name: "Gateway latency", value: `\`${latency} ms\``, inline: true},
        {name: "Status", value: "🟢 Operational", inline: true},
      ],
    })]});
  },
};
