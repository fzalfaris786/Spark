import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getLoggingConfig} from "./services/index.js";

export default createModuleCommand("logging-enable","Enable configured server event logging.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);const c=await getLoggingConfig(i.guild.id);if(!c.channelId)return fail(i,"Log channel not configured","Run `/logging-setup` first.");await saveConfig("logging",i.guild.id,{enabled:true});return ok(i,"Logging enabled","Configured event categories will be logged.");});
