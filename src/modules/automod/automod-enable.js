import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("automod-enable","Enable AutoMod message filtering.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);await saveConfig("automod",i.guild.id,{enabled:true});return ok(i,"AutoMod enabled","Configured filters will now be checked on new messages.");});
