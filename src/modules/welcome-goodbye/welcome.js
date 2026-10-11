// Prefix group alias: !welcome setup/config/message/enable/disable/test
export default {
  name: "welcome",
  prefixOnly: true,
  async execute({message,args=[],client,env}) {
    const sub=(args[0]||"").toLowerCase();
    const allowed=new Set(["setup","config","message","enable","disable","test"]);
    if(!allowed.has(sub))return message.reply({content:`Usage: \`${env.prefix}welcome <${[...allowed].join("|")}>\`. Example: \`${env.prefix}welcome test\`.`});
    const target=client.prefixCommands.get(`welcome-${sub}`);
    if(!target)return message.reply({content:"Welcome command is not loaded. Please restart the bot."});
    return target.execute({message,client,args:args.slice(1),env});
  },
};
