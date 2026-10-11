import {createModuleCommand, fail} from "../commandFactory.js";
import {getTicketConfig, parseTicket, isTicketChannel, reopenTicket} from "./services/index.js";

export default createModuleCommand("ticket-reopen","Reopen a closed ticket.",[],async i=>{if(!i.guild||!isTicketChannel(i.channel))return fail(i,"Not a ticket","Run this inside a ticket channel.");return reopenTicket(i,parseTicket(i.channel),await getTicketConfig(i.guild.id));});
