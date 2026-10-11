import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {getAutoroleConfig} from "./services/index.js";

export default createModuleCommand("selfrole-list","List the available self-assignable roles.",[],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");const c=await getAutoroleConfig(i.guild.id);const lines=c.selfRoleIds.map(id=>{const role=i.guild.roles.cache.get(id);return role?`• ${role} — ${c.selfRoleDescriptions[id]||"No description"}`:`• Deleted role: \`${id}\``;});return safeReply(i,{embeds:[infoEmbed("Self-assignable roles",lines.join("\n").slice(0,4000)||"No self-roles are configured.")]});
  });
