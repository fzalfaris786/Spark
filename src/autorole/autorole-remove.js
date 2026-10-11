import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig} from "./services/index.js";

export default createModuleCommand("autorole-remove","Remove a role from automatic assignment.",[
    {type:"role",name:"role",description:"Role to remove",required:true},
    {type:"string",name:"target",description:"Which assignment list to edit",required:true,choices:[{name:"Human members",value:"member"},{name:"Bots",value:"bot"},{name:"Both",value:"both"}]},
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");
    const role=i.options.getRole("role",true),target=i.options.getString("target",true),c=await getAutoroleConfig(i.guild.id);
    const patch={};if(target==="member"||target==="both")patch.memberRoleIds=c.memberRoleIds.filter(x=>x!==role.id);if(target==="bot"||target==="both")patch.botRoleIds=c.botRoleIds.filter(x=>x!==role.id);
    await saveConfig("autorole",i.guild.id,patch);return ok(i,"Automatic role removed",`Removed ${role} from the selected assignment list(s). Existing member roles are not removed.`);
  });
