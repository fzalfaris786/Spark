import {logEvent} from "../services/index.js";
import {cleanText} from "../../shared.js";
const val=v=>cleanText(v||"—",1000);
const actor=member=>`${member.user||member} (\`${member.id}\`)`;
export async function onMessageDelete(message){
  if(!message?.guild)return;
  if(message.partial)message=await message.fetch().catch(()=>message);
  await logEvent(message.guild,"messages","Message deleted",`A message was deleted in ${message.channel||"an unknown channel"}.`,[
    {name:"Author",value:message.author?actor(message.author):"Unknown / unavailable"},{name:"Channel",value:message.channel?`${message.channel} (\`${message.channel.id}\`)`:"Unknown"},{name:"Content",value:val(message.content||"[content unavailable or empty]")}]);
}
export async function onMessageUpdate(oldMessage,newMessage){
  if(!newMessage?.guild)return;
  if(newMessage.partial)newMessage=await newMessage.fetch().catch(()=>newMessage);
  if(oldMessage.partial)oldMessage=await oldMessage.fetch().catch(()=>oldMessage);
  if(oldMessage.content===newMessage.content)return;
  await logEvent(newMessage.guild,"messages","Message edited",`A message was edited in ${newMessage.channel||"an unknown channel"}.`,[
    {name:"Author",value:newMessage.author?actor(newMessage.author):"Unknown"},{name:"Channel",value:newMessage.channel?`${newMessage.channel} (\`${newMessage.channel.id}\`)`:"Unknown"},{name:"Before",value:val(oldMessage.content||"[empty]")},{name:"After",value:val(newMessage.content||"[empty]")}]);
}
export async function onMessageDeleteBulk(messages,channel){const guild=channel?.guild;if(!guild)return;await logEvent(guild,"messages","Bulk message deletion",`${messages.size} messages were bulk-deleted in ${channel}.`,[{name:"Channel",value:`${channel} (\`${channel.id}\`)`},{name:"Count",value:String(messages.size)}]);}
export async function onMemberAdd(member){await logEvent(member.guild,"members","Member joined",`${actor(member)} joined the server.`,[{name:"Account created",value:`<t:${Math.floor(member.user.createdTimestamp/1000)}:F>`}]);}
export async function onMemberRemove(member){await logEvent(member.guild,"members","Member left",`${actor(member)} left or was removed from the server.`,[{name:"Member ID",value:member.id}]);}
export async function onMemberUpdate(oldMember,newMember){
  if(oldMember.nickname!==newMember.nickname)await logEvent(newMember.guild,"members","Nickname changed",`${actor(newMember)} had a nickname change.`,[{name:"Before",value:val(oldMember.nickname||"None")},{name:"After",value:val(newMember.nickname||"None")}]);
  if(oldMember.communicationDisabledUntilTimestamp!==newMember.communicationDisabledUntilTimestamp){
    const describeUntil=value=>value?`Until <t:${Math.floor(value/1000)}:F>`:"Not timed out";
    await logEvent(newMember.guild,"moderation","Timeout status changed",`${actor(newMember)} had a timeout status change.`,[{name:"Before",value:describeUntil(oldMember.communicationDisabledUntilTimestamp)},{name:"After",value:describeUntil(newMember.communicationDisabledUntilTimestamp)}]);
  }
  const before=new Set(oldMember.roles.cache.keys()),after=new Set(newMember.roles.cache.keys()),added=[...after].filter(id=>!before.has(id)),removed=[...before].filter(id=>!after.has(id));
  if(added.length||removed.length)await logEvent(newMember.guild,"members","Member roles changed",`Role membership changed for ${actor(newMember)}.`,[{name:"Added",value:added.map(id=>newMember.guild.roles.cache.get(id)?.name||id).join(", ")||"None"},{name:"Removed",value:removed.map(id=>oldMember.guild.roles.cache.get(id)?.name||id).join(", ")||"None"}]);
}
export async function onBan(guildBan){await logEvent(guildBan.guild,"moderation","Member banned",`${actor(guildBan.user)} was banned.`,[{name:"Reason",value:val(guildBan.reason)}]);}
export async function onUnban(guild,user){await logEvent(guild,"moderation","Member unbanned",`${actor(user)} was unbanned.`,[]);}
export async function onChannelCreate(channel){if(channel.guild)await logEvent(channel.guild,"channels","Channel created",`${channel} was created.`,[{name:"Type",value:String(channel.type)},{name:"Channel ID",value:channel.id}]);}
export async function onChannelDelete(channel){if(channel.guild)await logEvent(channel.guild,"channels","Channel deleted",`A channel named **${val(channel.name)}** was deleted.`,[{name:"Channel ID",value:channel.id},{name:"Type",value:String(channel.type)}]);}
export async function onChannelUpdate(oldChannel,newChannel){if(newChannel.guild&&(oldChannel.name!==newChannel.name||oldChannel.topic!==newChannel.topic||oldChannel.nsfw!==newChannel.nsfw))await logEvent(newChannel.guild,"channels","Channel updated",`${newChannel} was updated.`,[{name:"Name",value:`${val(oldChannel.name)} → ${val(newChannel.name)}`},{name:"Topic",value:`${val(oldChannel.topic)} → ${val(newChannel.topic)}`}]);}
export async function onRoleCreate(role){await logEvent(role.guild,"roles","Role created",`${role} was created.`,[{name:"Role ID",value:role.id},{name:"Color",value:role.hexColor}]);}
export async function onRoleDelete(role){await logEvent(role.guild,"roles","Role deleted",`Role **${val(role.name)}** was deleted.`,[{name:"Role ID",value:role.id}]);}
export async function onRoleUpdate(oldRole,newRole){if(oldRole.name!==newRole.name||oldRole.hexColor!==newRole.hexColor||oldRole.hoist!==newRole.hoist||oldRole.mentionable!==newRole.mentionable)await logEvent(newRole.guild,"roles","Role updated",`${newRole} was updated.`,[{name:"Name",value:`${val(oldRole.name)} → ${val(newRole.name)}`},{name:"Color",value:`${oldRole.hexColor} → ${newRole.hexColor}`}]);}
export async function onVoiceStateUpdate(oldState,newState){const member=newState.member||oldState.member;if(!member?.guild)return;if(oldState.channelId===newState.channelId)return;const from=oldState.channel?oldState.channel.name:"outside voice",to=newState.channel?newState.channel.name:"outside voice";await logEvent(member.guild,"voice","Voice state changed",`${actor(member)} moved from **${from}** to **${to}**.`,[]);}

export async function onGuildUpdate(oldGuild,newGuild){if(oldGuild.name!==newGuild.name||oldGuild.description!==newGuild.description||oldGuild.verificationLevel!==newGuild.verificationLevel)await logEvent(newGuild,"server","Server settings updated","Some visible server settings changed.",[{name:"Name",value:`${val(oldGuild.name)} → ${val(newGuild.name)}`},{name:"Description",value:`${val(oldGuild.description)} → ${val(newGuild.description)}`},{name:"Verification level",value:`${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`}]);}
