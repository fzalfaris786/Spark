import {handleMemberWelcome,handleMemberGoodbye} from "./welcome-goodbye/services/index.js";
import {handleAutoroleMemberAdd,handleAutoroleComponent,handleReactionRole} from "./autorole/services/index.js";
import {handleAutomodMessage} from "./automod/services/index.js";
import {handleTicketInteraction} from "./tickets/services/index.js";
import {onMessageDelete,onMessageUpdate,onMessageDeleteBulk,onMemberAdd,onMemberRemove,onMemberUpdate,onBan,onUnban,onChannelCreate,onChannelDelete,onChannelUpdate,onRoleCreate,onRoleDelete,onRoleUpdate,onVoiceStateUpdate,onGuildUpdate} from "./logging/events/index.js";

function report(label,promise){Promise.resolve(promise).catch(error=>console.error(`[module:${label}]`,error));}
export function registerModuleEvents(client,env){
  client.on("messageReactionAdd",(reaction,user)=>report("reaction-role-add",handleReactionRole(reaction,user,true)));
  client.on("messageReactionRemove",(reaction,user)=>report("reaction-role-remove",handleReactionRole(reaction,user,false)));
  client.on("guildMemberAdd",member=>{
    report("welcome",handleMemberWelcome(member));
    report("autorole",handleAutoroleMemberAdd(member));
    report("logging-member-add",onMemberAdd(member));
  });
  client.on("guildMemberRemove",member=>{
    report("goodbye",handleMemberGoodbye(member));
    report("logging-member-remove",onMemberRemove(member));
  });
  client.on("messageCreate",message=>report("automod",handleAutomodMessage(message,env.prefix,client)));
  client.on("messageDelete",message=>report("logging-message-delete",onMessageDelete(message)));
  client.on("messageUpdate",(before,after)=>report("logging-message-update",onMessageUpdate(before,after)));
  client.on("messageDeleteBulk",(messages,channel)=>report("logging-bulk-delete",onMessageDeleteBulk(messages,channel)));
  client.on("guildBanAdd",ban=>report("logging-ban",onBan(ban)));
  client.on("guildBanRemove",ban=>report("logging-unban",onUnban(ban.guild,ban.user)));
  client.on("guildMemberUpdate",(before,after)=>report("logging-member-update",onMemberUpdate(before,after)));
  client.on("channelCreate",channel=>report("logging-channel-create",onChannelCreate(channel)));
  client.on("channelDelete",channel=>report("logging-channel-delete",onChannelDelete(channel)));
  client.on("channelUpdate",(before,after)=>report("logging-channel-update",onChannelUpdate(before,after)));
  client.on("roleCreate",role=>report("logging-role-create",onRoleCreate(role)));
  client.on("roleDelete",role=>report("logging-role-delete",onRoleDelete(role)));
  client.on("roleUpdate",(before,after)=>report("logging-role-update",onRoleUpdate(before,after)));
  client.on("voiceStateUpdate",(before,after)=>report("logging-voice",onVoiceStateUpdate(before,after)));
  client.on("guildUpdate",(before,after)=>report("logging-guild-update",onGuildUpdate(before,after)));
  console.log("[modules] Welcome/Goodbye, AutoRole, AutoMod, Logging and Tickets event handlers registered");
}
export async function handleModuleInteraction(interaction){
  if(await handleAutoroleComponent(interaction))return true;
  if(await handleTicketInteraction(interaction))return true;
  return false;
}
