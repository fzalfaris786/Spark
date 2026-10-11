import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {getAutoroleConfig} from "./services/index.js";

export default createModuleCommand("autorole-list","View automatic and self-assignable roles.",[],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");const c=await getAutoroleConfig(i.guild.id);const fmt=ids=>ids?.length?ids.map(id=>i.guild.roles.cache.get(id)?.toString()||`Deleted role (\`${id}\`)`).join(", "):"None configured";
    return safeReply(i,{embeds:[infoEmbed("Role automation",`Enabled: **${c.enabled}**`,{fields:[{name:"Human join roles",value:fmt(c.memberRoleIds)},{name:"Bot join roles",value:fmt(c.botRoleIds)},{name:"Self-assignable roles",value:fmt(c.selfRoleIds)},{name:"Reaction-role mappings",value:String((c.reactionRoles||[]).length)}]})]});
  });
