import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("logging-disable","Disable server event logging.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);await saveConfig("logging",i.guild.id,{enabled:false});return ok(i,"Logging disabled","Event logging has been paused. Configuration is preserved.");});
