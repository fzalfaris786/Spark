import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, PermissionFlagsBits as P, TextInputBuilder, TextInputStyle} from "discord.js";
import {getConfig, updateRecord, cleanText} from "../../shared.js";
import {ok, fail, infoEmbed, safeReply, branded} from "../../commandFactory.js";

export const DEFAULTS=Object.freeze({enabled:false,categoryId:null,logChannelId:null,supportRoleId:null,maxOpenPerMember:3,panelTitle:"The Origin Labs Support",panelDescription:"Press the button below to open a private support ticket. Please provide a clear subject and description."});
export async function getTicketConfig(guildId){return {...DEFAULTS,...(await getConfig("tickets",guildId))};}
export const botTicketPerms=[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.EmbedLinks,P.AttachFiles,P.ManageChannels];
export const requesterPerms=[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles,P.EmbedLinks, P.AddReactions];
export const toSafeChannelName=s=>String(s||"ticket").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"ticket";
export function parseTicket(channel){const match=String(channel?.topic||"").match(/(?:^|\s)origin-ticket:([0-9]{15,22}):(open|closed):([0-9]{15,22}|none)(?:$|\s)/);return match?{ownerId:match[1],status:match[2],claimedBy:match[3]==="none"?null:match[3]}:null;}
export async function getTextChannel(guild,id){if(!id)return null;const c=guild.channels.cache.get(id)||await guild.channels.fetch(id).catch(()=>null);return c?.isTextBased?.()?c:null;}
export async function saveTicketRecord(record){await updateRecord("ticket_records",{guildId:record.guildId,channelId:record.channelId},{$set:{...record,updatedAt:new Date()}},{upsert:true});}
export function isTicketChannel(channel){return Boolean(parseTicket(channel));}
export function isSupport(interaction,cfg){
  const member=interaction.member?.roles?.cache?interaction.member:interaction.guild?.members?.cache?.get(interaction.user?.id);
  return Boolean(interaction.memberPermissions?.has(P.ManageChannels)||interaction.memberPermissions?.has(P.ManageGuild)||interaction.memberPermissions?.has(P.Administrator)||(cfg.supportRoleId&&member?.roles?.cache?.has(cfg.supportRoleId)));
}
export function usageAllowed(interaction,ticket,cfg,{ownerAllowed=true}={}){return Boolean(isSupport(interaction,cfg)||(ownerAllowed&&interaction.user.id===ticket.ownerId));}
export async function ticketLog(guild,cfg,title,description,fields=[]){if(!cfg.logChannelId)return;const ch=await getTextChannel(guild,cfg.logChannelId),bot=guild.members.me;if(!ch||!bot||!ch.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return;await ch.send({embeds:[branded(`Tickets • ${title}`,description,{fields})]}).catch(e=>console.warn(`[tickets:log] ${e.message}`));}
export async function transcriptBuffer(channel){
  let before,all=[],pages=0;
  while(pages<10){const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})}).catch(()=>null);if(!batch?.size)break;all.push(...batch.values());before=batch.last().id;pages++;if(batch.size<100)break;}
  all.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
  const lines=[`The Origin Labs — Ticket Transcript`,`Channel: #${channel.name} (${channel.id})`,`Generated: ${new Date().toISOString()}`,"=".repeat(80),""];
  for(const m of all){lines.push(`[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag||"Unknown"} (${m.author?.id||"unknown"})`);if(m.content)lines.push(m.content.replace(/@everyone/g,"@\u200beveryone").replace(/@here/g,"@\u200bhere"));for(const a of m.attachments.values())lines.push(`Attachment: ${a.name||"file"} — ${a.url}`);if(m.embeds?.length)lines.push(`[${m.embeds.length} embed(s)]`);lines.push("");}
  let content=lines.join("\n");if(Buffer.byteLength(content,"utf8")>1_700_000)content=Buffer.from(content,"utf8").subarray(0,1_700_000).toString("utf8")+"\n[Transcript clipped at safe attachment size.]";
  return Buffer.from(content,"utf8");
}
export async function deliverTranscript(channel,cfg,buffer,name){
  const log=await getTextChannel(channel.guild,cfg.logChannelId),bot=channel.guild.members.me;
  if(!log||!bot||!log.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages,P.AttachFiles]))return false;
  try{await log.send({embeds:[branded("Ticket transcript",`Transcript captured for ${channel}.`,{fields:[{name:"Channel",value:channel.name},{name:"Created by",value:`<@${parseTicket(channel)?.ownerId||"0"}>`}]})],files:[new AttachmentBuilder(buffer,{name})]});return true;}
  catch(error){console.warn(`[tickets:transcript] ${error.message}`);return false;}
}
export function controls(closed=false){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("ticket:claim").setLabel("Claim ticket").setStyle(ButtonStyle.Secondary).setDisabled(closed),
  new ButtonBuilder().setCustomId("ticket:close").setLabel("Close ticket").setStyle(ButtonStyle.Danger).setDisabled(closed),
  new ButtonBuilder().setCustomId("ticket:reopen").setLabel("Reopen ticket").setStyle(ButtonStyle.Success).setDisabled(!closed),
);}
export async function createTicketFromModal(interaction){
  const guild=interaction.guild;if(!guild)return safeReply(interaction,failEmbed("Server only","Open tickets inside a server."));
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ephemeral:true});
  const cfg=await getTicketConfig(guild.id);if(!cfg.enabled)return safeReply(interaction,failEmbed("Tickets disabled","A server administrator has disabled new tickets."));
  const category=cfg.categoryId?guild.channels.cache.get(cfg.categoryId)||await guild.channels.fetch(cfg.categoryId).catch(()=>null):null;
  if(!category||category.type!==ChannelType.GuildCategory)return safeReply(interaction,failEmbed("Ticket setup incomplete","The configured ticket category is missing. Ask an administrator to run `/tickets-setup` again."));
  const supportRole=cfg.supportRoleId?(guild.roles.cache.get(cfg.supportRoleId)||await guild.roles.fetch(cfg.supportRoleId).catch(()=>null)):null;
  if(cfg.supportRoleId&&!supportRole)return safeReply(interaction,failEmbed("Support role missing","The configured support role was deleted. Ask an administrator to run `/tickets-setup` or `/tickets-config` again before creating tickets."));
  const active=category.children.cache.filter(ch=>{const t=parseTicket(ch);return t?.ownerId===interaction.user.id&&t.status==="open";}).size;
  if(active>=cfg.maxOpenPerMember)return safeReply(interaction,failEmbed("Open ticket limit reached",`You already have ${active} open ticket(s). Close one before creating another.`));
  const subject=cleanText(interaction.fields.getTextInputValue("ticket_subject").trim(),120);
  const details=cleanText(interaction.fields.getTextInputValue("ticket_details").trim(),1800);
  if(!subject||!details)return safeReply(interaction,failEmbed("Details required","Please enter a subject and description."));
  const bot=guild.members.me;if(!bot?.permissions.has([P.ManageChannels,P.ViewChannel,P.SendMessages]))return safeReply(interaction,failEmbed("Bot permissions missing","The bot needs Manage Channels, View Channel and Send Messages."));
  const overwrites=[{id:guild.roles.everyone.id,deny:[P.ViewChannel]},{id:interaction.user.id,allow:requesterPerms},{id:bot.id,allow:botTicketPerms}];
  if(supportRole)overwrites.push({id:supportRole.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles,P.EmbedLinks]});
  let channel;
  try{channel=await guild.channels.create({name:`ticket-${toSafeChannelName(interaction.user.username)}`,type:ChannelType.GuildText,parent:category.id,topic:`origin-ticket:${interaction.user.id}:open:none`,permissionOverwrites:overwrites,reason:`Support ticket opened by ${interaction.user.tag}`});}
  catch(error){console.error("[tickets:create]",error);return safeReply(interaction,failEmbed("Could not create ticket","Check the bot's Manage Channels permission and category access."));}
  try {
    await saveTicketRecord({guildId:guild.id,channelId:channel.id,ownerId:interaction.user.id,subject,details,status:"open",claimedBy:null,createdAt:new Date()});
    await channel.send({content:cfg.supportRoleId?`<@&${cfg.supportRoleId}>`:`<@${interaction.user.id}>`,allowedMentions:{users:[interaction.user.id],roles:cfg.supportRoleId?[cfg.supportRoleId]:[]},embeds:[branded(`Support ticket • ${subject}`,details,{fields:[{name:"Created by",value:`${interaction.user} (\`${interaction.user.id}\`)`,inline:true},{name:"Status",value:"Open",inline:true},{name:"Next steps",value:"A team member will respond here. Use the close button when your issue is resolved."}]})],components:[controls(false)]});
  } catch (error) {
    console.error("[tickets:create:initialize]",error);
    await channel.delete("Ticket setup failed before the conversation could start").catch(()=>{});
    return safeReply(interaction,failEmbed("Could not initialize ticket","The ticket channel could not be initialized, so it was cleaned up. Check bot permissions and try again."));
  }
  await ticketLog(guild,cfg,"Ticket created",`${channel} was opened by ${interaction.user}.`,[{name:"Subject",value:subject},{name:"Ticket owner",value:`${interaction.user} (\`${interaction.user.id}\`)`}]);
  await safeReply(interaction,infoEmbed("Ticket created",`Your private ticket is ready: ${channel}`),true);
}
export async function closeTicket(interaction,ticket,cfg){
  if(ticket.status==="closed")return fail(interaction,"Already closed","This ticket is already closed.");
  if(!usageAllowed(interaction,ticket,cfg))return fail(interaction,"Permission denied","Only the ticket creator or support staff can close this ticket.");
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ephemeral:true});
  const channel=interaction.channel,buffer=await transcriptBuffer(channel),name=`ticket-${channel.id}-transcript.txt`;
  try{await channel.permissionOverwrites.edit(ticket.ownerId,{SendMessages:false,AddReactions:false});await channel.setTopic(`origin-ticket:${ticket.ownerId}:closed:${ticket.claimedBy||"none"}`);if(!channel.name.startsWith("closed-"))await channel.setName(`closed-${channel.name}`.slice(0,100));await saveTicketRecord({guildId:interaction.guild.id,channelId:channel.id,ownerId:ticket.ownerId,status:"closed",claimedBy:ticket.claimedBy,closedAt:new Date()});await channel.send({embeds:[infoEmbed("Ticket closed","This ticket is now read-only for its creator. Staff can reopen it if more information is needed.")],components:[controls(true)]});const sent=await deliverTranscript(channel,cfg,buffer,name);await ticketLog(interaction.guild,cfg,"Ticket closed",`${channel} was closed by ${interaction.user}.`,[{name:"Owner",value:`<@${ticket.ownerId}>`},{name:"Transcript",value:sent?"Sent to log channel":"Not sent (no valid transcript destination)"}]);return ok(interaction,"Ticket closed",sent?"The ticket is read-only and its transcript was sent to the configured log channel.":"The ticket is read-only. Configure a ticket log channel if you want transcripts archived automatically.");}
  catch(error){console.error("[tickets:close]",error);return fail(interaction,"Could not close ticket","Check channel permission overwrites and Manage Channels permission.");}
}
export async function reopenTicket(interaction,ticket,cfg){
  if(ticket.status!=="closed")return fail(interaction,"Ticket is already open","This ticket does not need reopening.");if(!isSupport(interaction,cfg))return fail(interaction,"Staff permission required","Only support staff or users with Manage Channels can reopen tickets.");
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ephemeral:true});
  try{await interaction.channel.permissionOverwrites.edit(ticket.ownerId,{SendMessages:true,AddReactions:true});await interaction.channel.setTopic(`origin-ticket:${ticket.ownerId}:open:${ticket.claimedBy||"none"}`);if(interaction.channel.name.startsWith("closed-"))await interaction.channel.setName(interaction.channel.name.replace(/^closed-/,"").slice(0,100));await saveTicketRecord({guildId:interaction.guild.id,channelId:interaction.channel.id,ownerId:ticket.ownerId,status:"open",claimedBy:ticket.claimedBy,reopenedAt:new Date()});await interaction.channel.send({embeds:[infoEmbed("Ticket reopened",`This ticket was reopened by ${interaction.user}.`)],components:[controls(false)]});await ticketLog(interaction.guild,cfg,"Ticket reopened",`${interaction.channel} was reopened by ${interaction.user}.`);return ok(interaction,"Ticket reopened","The ticket creator can send messages again.");}catch(e){console.error("[tickets:reopen]",e);return fail(interaction,"Could not reopen","Check Manage Channels permission and ticket overwrites.");}
}
export function failEmbed(title,description){return branded(title,description,{color:0xF05D6C});}

export async function handleTicketInteraction(interaction){
  if(interaction.isButton?.()&&interaction.customId==="ticket:create"){
    const modal=new ModalBuilder().setCustomId("ticket:open-modal").setTitle("Create a support ticket").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ticket_subject").setLabel("What do you need help with?").setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(120).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ticket_details").setLabel("Describe your issue").setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true)),
    );await interaction.showModal(modal);return true;
  }
  if(interaction.isModalSubmit?.()&&interaction.customId==="ticket:open-modal"){await createTicketFromModal(interaction);return true;}
  if(!interaction.isButton?.()||!interaction.customId.startsWith("ticket:"))return false;
  const type=interaction.customId.slice("ticket:".length);if(!["claim","close","reopen"].includes(type))return false;
  if(!interaction.guild||!isTicketChannel(interaction.channel)){await interaction.reply({embeds:[failEmbed("Not a ticket","These buttons only work in a ticket channel.")],ephemeral:true}).catch(()=>{});return true;}
  const ticket=parseTicket(interaction.channel),cfg=await getTicketConfig(interaction.guild.id);
  if(type==="close"){await closeTicket(interaction,ticket,cfg);return true;}
  if(type==="reopen"){await reopenTicket(interaction,ticket,cfg);return true;}
  if(!isSupport(interaction,cfg)){await interaction.reply({embeds:[failEmbed("Support staff only","Only configured support staff or server managers can claim a ticket.")],ephemeral:true});return true;}
  if(ticket.status!=="open"){await interaction.reply({embeds:[failEmbed("Ticket closed","Reopen the ticket before claiming it.")],ephemeral:true});return true;}
  if(ticket.claimedBy&&ticket.claimedBy!==interaction.user.id){await interaction.reply({embeds:[failEmbed("Already claimed",`This ticket is already claimed by <@${ticket.claimedBy}>.`)],ephemeral:true});return true;}
  if(!interaction.deferred&&!interaction.replied)await interaction.deferReply({ephemeral:false});
  await interaction.channel.setTopic(`origin-ticket:${ticket.ownerId}:open:${interaction.user.id}`);await saveTicketRecord({guildId:interaction.guild.id,channelId:interaction.channel.id,ownerId:ticket.ownerId,status:"open",claimedBy:interaction.user.id});await interaction.editReply({embeds:[infoEmbed("Ticket claimed",`${interaction.user} is now handling this ticket.`)]});await ticketLog(interaction.guild,cfg,"Ticket claimed",`${interaction.channel} was claimed by ${interaction.user}.`);return true;
}

