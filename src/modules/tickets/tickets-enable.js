import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getTicketConfig} from "./services/index.js";

export default createModuleCommand("tickets-enable","Enable new ticket creation.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);const c=await getTicketConfig(i.guild.id);if(!c.categoryId)return fail(i,"Setup incomplete","Run `/tickets-setup` first.");await saveConfig("tickets",i.guild.id,{enabled:true});return ok(i,"Tickets enabled","Members can create tickets from configured panels.");});
