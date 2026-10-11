import {brandEmbed} from "../../utils/embeds.js";
export default {
  name:"help",
  async execute({message,env}){
    const p=env.prefix;
    await message.reply({embeds:[brandEmbed("✦ Command Centre","The Origin Labs • Module command guide",{fields:[
      {name:"General",value:`\`${p}ping\` · \`${p}help\``,inline:false},
      {name:"Welcome & Goodbye",value:`\`${p}welcome-setup\` · \`${p}welcome-config\` · \`${p}welcome-message\` · \`${p}welcome-enable\` · \`${p}welcome-disable\` · \`${p}welcome-test\`\n\`${p}goodbye-setup\` · \`${p}goodbye-config\` · \`${p}goodbye-message\` · \`${p}goodbye-enable\` · \`${p}goodbye-disable\` · \`${p}goodbye-test\``,inline:false},
      {name:"AutoRole / AutoMod",value:`\`${p}autorole-add\` · \`${p}autorole-remove\` · \`${p}autorole-list\` · \`${p}selfrole-add\` · \`${p}selfrole-panel\` · \`${p}reactionrole-add\` · \`${p}reactionrole-remove\` · \`${p}reactionrole-list\`\n\`${p}automod-setup\` · \`${p}automod-config\` · \`${p}automod-word-add\` · \`${p}automod-exempt\` · \`${p}automod-test\``,inline:false},
      {name:"Logging",value:`\`${p}logging-setup\` · \`${p}logging-config\` · \`${p}logging-test\``,inline:false},
      {name:"Tickets 🎟️",value:`\`${p}tickets-setup\` · \`${p}tickets-panel\` · \`${p}tickets-config\` · \`${p}tickets-status\`\n\`${p}ticket-close\` · \`${p}ticket-claim\` · \`${p}ticket-reopen\` · \`${p}ticket-transcript\``,inline:false},
      {name:"Moderation",value:"Use the slash commands listed in the `/help` page; moderation commands also accept the configured prefix and their slash option order.",inline:false},
      {name:"How to use prefix options",value:`Example: \`${p}welcome-setup #welcome-channel https://example.com/banner.gif\`. Use channel/role/user mentions. Slash commands are recommended for clearer validation.`,inline:false},
    ]})]});
  },
};
