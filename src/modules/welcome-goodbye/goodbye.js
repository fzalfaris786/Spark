// Prefix group alias: !goodbye setup/config/message/enable/disable/test
export default {
  name: "goodbye",
  prefixOnly: true,
  async execute({message,args=[],client,env}) {
    const sub=(args[0]||"").toLowerCase();
    const allowed=new Set(["setup","config","message","enable","disable","test"]);
    if(!allowed.has(sub))return message.reply({content:`Usage: \`${env.prefix}goodbye <${[...allowed].join("|")}>\`. Example: \`${env.prefix}goodbye test\`.`});
    const target=client.prefixCommands.get(`goodbye-${sub}`);
    if(!target)return message.reply({content:"Goodbye command is not loaded. Please restart the bot."});
    return target.execute({message,client,args:args.slice(1),env});
  },
};
