import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("automod-disable","Disable AutoMod message filtering.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);await saveConfig("automod",i.guild.id,{enabled:false});return ok(i,"AutoMod disabled","Messages will no longer be filtered by this module.");});
