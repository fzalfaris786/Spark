import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("tickets-disable","Disable new ticket creation without deleting existing tickets.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);await saveConfig("tickets",i.guild.id,{enabled:false});return ok(i,"Tickets disabled","New tickets are blocked; existing ticket channels remain accessible.");});
