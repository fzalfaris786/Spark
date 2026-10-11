import {createModuleCommand, fail} from "../commandFactory.js";
import {getTicketConfig, parseTicket, isTicketChannel, closeTicket} from "./services/index.js";

export default createModuleCommand("ticket-close","Close the current ticket and archive a transcript.",[],async i=>{if(!i.guild||!isTicketChannel(i.channel))return fail(i,"Not a ticket","Run this inside a ticket channel.");return closeTicket(i,parseTicket(i.channel),await getTicketConfig(i.guild.id));});
