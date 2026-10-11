import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig, manageableRole, safeSelfRole} from "./services/index.js";

export default createModuleCommand("selfrole-add","Allow members to assign or remove a safe role themselves.",[
    {type:"role",name:"role",description:"Role members may self-assign",required:true},
    {type:"string",name:"description",description:"Short explanation displayed on the panel",maxLength:90},
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");const role=i.options.getRole("role",true);
    if(!manageableRole(i.guild,role))return fail(i,"Role cannot be assigned","Check Manage Roles and bot role hierarchy.");if(!safeSelfRole(role))return fail(i,"Privileged role blocked","Roles granting administrator, moderation, channel or server-management privileges cannot be self-assigned.");
    const c=await getAutoroleConfig(i.guild.id),ids=[...new Set([...c.selfRoleIds,role.id])];if(ids.length>25)return fail(i,"Panel limit reached","A single button panel supports up to 25 self-roles. Remove one before adding another.");
    const desc=i.options.getString("description")||"Click the button to toggle this role.";await saveConfig("autorole",i.guild.id,{selfRoleIds:ids,selfRoleDescriptions:{...c.selfRoleDescriptions,[role.id]:desc}});return ok(i,"Self-role added",`${role} is now eligible for the self-role panel. Run /selfrole-panel to publish or refresh a panel.`);
  });
