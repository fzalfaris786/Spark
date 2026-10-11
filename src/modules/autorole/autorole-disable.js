import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("autorole-disable","Disable automatic join-role assignment.",[],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");await saveConfig("autorole",i.guild.id,{enabled:false});return ok(i,"AutoRole disabled","Existing roles remain unchanged; no join roles will be added until re-enabled.");
  });
