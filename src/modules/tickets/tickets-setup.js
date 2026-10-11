import {ChannelType, PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getTicketConfig} from "./services/index.js";

export default createModuleCommand(
  "tickets-setup",
  "Configure the category, support role and transcript log channel.",
  [
    {type: "channel", name: "category", description: "Category that will contain private ticket channels", required: true, channelType: "category"},
    {type: "role", name: "support_role", description: "Role allowed to view and manage tickets"},
    {type: "channel", name: "log_channel", description: "Optional transcript and ticket event channel", channelType: "text"}
  ],
  async interaction => {
    if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
    if (!managerOnly(interaction)) return denyPermission(interaction);
    const category = interaction.options.getChannel("category", true);
    const role = interaction.options.getRole("support_role");
    const log = interaction.options.getChannel("log_channel");
    const bot = interaction.guild.members.me;
    if (category.type !== ChannelType.GuildCategory) return fail(interaction, "Invalid category", "Choose a category channel.");
    if (!bot?.permissions.has(P.ManageChannels)) return fail(interaction, "Manage Channels required", "Give the bot Manage Channels before enabling ticket creation.");
    if (log && !log.isTextBased?.()) return fail(interaction, "Invalid log channel", "Choose a text channel.");
    if (log && !log.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles])) {
      return fail(interaction, "Log channel permissions missing", "Give the bot View Channel, Send Messages, Embed Links and Attach Files in the selected transcript channel.");
    }
    const previous = await getTicketConfig(interaction.guild.id);
    await saveConfig("tickets", interaction.guild.id, {categoryId: category.id, ...(role ? {supportRoleId: role.id} : {}), ...(log ? {logChannelId: log.id} : {}), enabled: true});
    const supportLabel = role ? `${role}` : previous.supportRoleId ? `<@&${previous.supportRoleId}> (kept)` : "Not set";
    const logLabel = log ? `${log}` : previous.logChannelId ? `<#${previous.logChannelId}> (kept)` : "Not set";
    return ok(interaction, "Ticket system configured", `Category: ${category}\nSupport role: ${supportLabel}\nTranscript/log channel: ${logLabel}\nNew tickets are enabled.`);
  }
);
