import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig, manageableRole, safeSelfRole} from "./services/index.js";

export default createModuleCommand("autorole-add","Add a role to the automatic join-role list.",[
    {type:"role",name:"role",description:"Role to assign automatically",required:true},
    {type:"string",name:"target",description:"Which joining accounts receive this role",required:true,choices:[{name:"Human members",value:"member"},{name:"Bots",value:"bot"},{name:"Both",value:"both"}]},
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");
    const role=i.options.getRole("role",true),target=i.options.getString("target",true);if(!manageableRole(i.guild,role))return fail(i,"Role cannot be assigned","Ensure the bot has Manage Roles and its highest role is above the selected role.");if(!safeSelfRole(role))return fail(i,"Privileged role blocked","Automatic join roles cannot grant administrator, moderation, channel or server-management privileges.");
    const c=await getAutoroleConfig(i.guild.id),member=[...c.memberRoleIds],bot=[...c.botRoleIds];
    if((target==="member"||target==="both")&&!member.includes(role.id)&&member.length>=25)return fail(i,"Human join-role limit reached","A server can configure up to 25 human join roles in this module. Remove a role first if you need to replace one.");
    if((target==="bot"||target==="both")&&!bot.includes(role.id)&&bot.length>=25)return fail(i,"Bot join-role limit reached","A server can configure up to 25 bot join roles in this module. Remove a role first if you need to replace one.");
    if(target==="member"||target==="both"){if(!member.includes(role.id))member.push(role.id);}
    if(target==="bot"||target==="both"){if(!bot.includes(role.id))bot.push(role.id);}
    await saveConfig("autorole",i.guild.id,{memberRoleIds:member,botRoleIds:bot});return ok(i,"Automatic role added",`${role} will be assigned to **${target==='both'?'human members and bots':target==='bot'?'bots':'human members'}** when they join.`);
  });
