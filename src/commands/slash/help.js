import {SlashCommandBuilder} from "discord.js";
import {brandEmbed} from "../../utils/embeds.js";
export default {
  name:"help",
  data:new SlashCommandBuilder().setName("help").setDescription("Show available bot commands."),
  async execute({interaction,env}){
    const p=env.prefix;
    const embed=brandEmbed("✦ Command Centre","The Origin Labs • Module command guide",{fields:[
      {name:"General",value:"`/ping` · `/botinfo` · `/help`",inline:false},
      {name:"Moderation",value:"`/ban` · `/unban` · `/kick` · `/softban` · `/timeout` · `/untimeout` · `/warn` · `/warnings` · `/clearwarnings` · `/purge` · `/slowmode` · `/lock` · `/unlock` · `/nick` · `/quarantine` · `/unquarantine` · `/modconfig`",inline:false},
      {name:"Welcome & Goodbye",value:"`/welcome-setup` · `/welcome-config` · `/welcome-message` · `/welcome-enable` · `/welcome-disable` · `/welcome-test`\n`/goodbye-setup` · `/goodbye-config` · `/goodbye-message` · `/goodbye-enable` · `/goodbye-disable` · `/goodbye-test`",inline:false},
      {name:"AutoRole",value:"`/autorole-add` · `/autorole-remove` · `/autorole-list` · `/autorole-enable` · `/autorole-disable`\n`/selfrole-add` · `/selfrole-remove` · `/selfrole-list` · `/selfrole-panel`\n`/reactionrole-add` · `/reactionrole-remove` · `/reactionrole-list`",inline:false},
      {name:"AutoMod",value:"`/automod-setup` · `/automod-enable` · `/automod-disable` · `/automod-status` · `/automod-config` · `/automod-word-add` · `/automod-word-remove` · `/automod-word-list` · `/automod-exempt` · `/automod-test`",inline:false},
      {name:"Logging",value:"`/logging-setup` · `/logging-enable` · `/logging-disable` · `/logging-status` · `/logging-config` · `/logging-test`",inline:false},
      {name:"Tickets 🎟️",value:"`/tickets-setup` · `/tickets-panel` · `/tickets-config` · `/tickets-enable` · `/tickets-disable` · `/tickets-status` · `/tickets-stats`\n`/ticket-close` · `/ticket-claim` · `/ticket-reopen` · `/ticket-add` · `/ticket-remove` · `/ticket-rename` · `/ticket-transcript`",inline:false},
      {name:"Prefix commands",value:`Use the configured prefix ${p} followed by the same command name, e.g. \`${p}ping\`, \`${p}welcome-test\`, \`${p}ticket-transcript\`. For role, user and channel options use mentions. Slash commands provide guided options.`,inline:false},
      {name:"Setup note",value:"Welcome/AutoRole need Server Members Intent. AutoMod and message logs need Message Content Intent. The bot also needs the relevant permissions and correct role hierarchy.",inline:false},
    ]});
    await interaction.reply({embeds:[embed],ephemeral:true});
  },
};
