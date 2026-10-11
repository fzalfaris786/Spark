import {createEmbed, COLORS} from "../../utils/embeds.js";
export default {
  name: "ping",
  async execute({message, client}) {
    await message.reply({embeds: [createEmbed({
      title: "🏓 Pong!",
      description: "The bot is online and responding normally.",
      color: COLORS.success,
      fields: [
        {name: "Gateway latency", value: `\`${client.ws.ping} ms\``, inline: true},
        {name: "Status", value: "🟢 Operational", inline: true},
      ],
    })]});
  },
};
