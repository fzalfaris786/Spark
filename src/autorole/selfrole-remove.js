import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig} from "./services/index.js";

export default createModuleCommand("selfrole-remove","Remove a role from the self-role panel.",[{type:"role",name:"role",description:"Role to remove",required:true}],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");const role=i.options.getRole("role",true),c=await getAutoroleConfig(i.guild.id);await saveConfig("autorole",i.guild.id,{selfRoleIds:c.selfRoleIds.filter(id=>id!==role.id),selfRoleDescriptions:Object.fromEntries(Object.entries(c.selfRoleDescriptions).filter(([id])=>id!==role.id))});return ok(i,"Self-role removed",`${role} was removed from the configured list. Previously published panels may need to be republished.`);
  });
