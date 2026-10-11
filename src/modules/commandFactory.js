import {SlashCommandBuilder, ChannelType, PermissionFlagsBits} from "discord.js";
import {brandEmbed, errorEmbed, successEmbed, warningEmbed, infoEmbed} from "../utils/embeds.js";
import {createPrefixExecutor} from "./prefixAdapter.js";
import {moduleEmbed} from "./shared.js";

const channelTypeMap = {
  text: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
  category: [ChannelType.GuildCategory],
  voice: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
};

export function createModuleCommand(name, description, options, handler, {prefix = true} = {}) {
  const data = new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
  for (const spec of options || []) {
    const methodByType = {string: "addStringOption", integer: "addIntegerOption", boolean: "addBooleanOption", user: "addUserOption", channel: "addChannelOption", role: "addRoleOption"};
    const method = methodByType[spec.type];
    if (!method) throw new Error(`Unknown command option type '${spec.type}' for ${name}`);
    data[method](o => {
      o.setName(spec.name).setDescription(spec.description).setRequired(Boolean(spec.required));
      if (spec.choices) o.addChoices(...spec.choices.map(c => ({name: c.name, value: c.value})));
      if (spec.type === "string") {
        if (spec.minLength !== undefined) o.setMinLength(spec.minLength);
        if (spec.maxLength !== undefined) o.setMaxLength(spec.maxLength);
      }
      if (spec.type === "integer") {
        if (spec.min !== undefined) o.setMinValue(spec.min);
        if (spec.max !== undefined) o.setMaxValue(spec.max);
      }
      if (spec.type === "channel") o.addChannelTypes(...(channelTypeMap[spec.channelType || "text"] || channelTypeMap.text));
      return o;
    });
  }
  const command = {name, data, async execute(context) { return handler(context.interaction, context.client, context.env); }};
  if (prefix) command.prefixExecute = createPrefixExecutor(command);
  return command;
}

export function managerOnly(interaction, permission = PermissionFlagsBits.ManageGuild) {
  return Boolean(interaction.memberPermissions?.has(permission) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
export async function denyPermission(interaction, needed = "Manage Server") {
  return safeReply(interaction, errorEmbed("Permission required", `You need **${needed}** (or Administrator) to use this command.`), true);
}
export async function safeReply(interaction, embedOrPayload, ephemeral = true) {
  const payload = embedOrPayload?.data || embedOrPayload?.toJSON
    ? {embeds: [embedOrPayload], ephemeral}
    : {...embedOrPayload, ephemeral};
  if (interaction.deferred && interaction.editReply) {
    // Ephemerality is fixed by deferReply; it cannot be changed by editReply.
    return interaction.editReply(stripEphemeral(payload));
  }
  const finalPayload = interaction.isPrefixAdapter ? stripEphemeral(payload) : payload;
  if (interaction.replied && interaction.followUp) return interaction.followUp(finalPayload);
  return interaction.reply(finalPayload);
}
function stripEphemeral(payload) {
  const copy = {...payload};
  delete copy.ephemeral;
  return copy;
}
export const ok = (i, title, description, options) => safeReply(i, successEmbed(title, description, options));
export const fail = (i, title, description, options) => safeReply(i, errorEmbed(title, description, options));
export const note = (i, title, description, options) => safeReply(i, infoEmbed(title, description, options));
export const warn = (i, title, description, options) => safeReply(i, warningEmbed(title, description, options));
export const branded = (title, description, options) => brandEmbed(title, description, options);
export {PermissionFlagsBits, ChannelType, infoEmbed, moduleEmbed};
