// Adapts a slash command's declared options to a simple prefix invocation.
// This keeps each command implementation single-sourced while allowing both
// /command option:value and !command value styles.
function tokenForOption(option, token, message) {
  if (token === undefined) return undefined;
  const text = String(token);
  switch (option.type) {
    case 4: {
      const number = Number.parseInt(text, 10);
      return Number.isInteger(number) ? number : undefined;
    }
    case 5:
      if (/^(true|yes|on|1)$/i.test(text)) return true;
      if (/^(false|no|off|0)$/i.test(text)) return false;
      return undefined;
    case 6: {
      const id = text.match(/\d{15,22}/)?.[0];
      if (!id) return undefined;
      return message.mentions?.users?.get(id) || message.client.users.cache.get(id) || undefined;
    }
    case 7: {
      const id = text.match(/\d{15,22}/)?.[0];
      return id ? (message.mentions?.channels?.get(id) || message.guild.channels.cache.get(id)) : undefined;
    }
    case 8: {
      const id = text.match(/\d{15,22}/)?.[0];
      return id ? (message.mentions?.roles?.get(id) || message.guild.roles.cache.get(id)) : undefined;
    }
    default:
      if (option.choices?.length) {
        const match = option.choices.find(c => String(c.value).toLowerCase() === text.toLowerCase() || c.name.toLowerCase() === text.toLowerCase());
        return match?.value;
      }
      return text;
  }
}

export function createPrefixExecutor(command) {
  return async ({message, args = [], client, env}) => {
    const schema = command.data.toJSON().options || [];
    const values = new Map();
    let cursor = 0;
    for (let index = 0; index < schema.length; index++) {
      const option = schema[index];
      const raw = args[cursor];
      if (option.type === 3 && !option.choices?.length && index === schema.length - 1 && raw !== undefined) {
        values.set(option.name, args.slice(cursor).join(" "));
        cursor = args.length;
        continue;
      }
      const value = tokenForOption(option, raw, message);
      if (value !== undefined) {
        values.set(option.name, value);
        cursor++;
      } else if (option.required) {
        await message.reply({embeds: [{color: 0xF4B740, title: "Command usage", description: `Usage: \`${env.prefix}${command.name} ${schema.map(o => o.required ? `<${o.name}>` : `[${o.name}]`).join(" ")}\`\nUse the slash command for guided options and clearer validation.`}]});
        return;
      }
    }
    const get = (name, required = false, type) => {
      const value = values.get(name);
      if (required && value === undefined) throw new Error(`Missing required option: ${name}`);
      if (type === "channel" && value?.id && !value.guild) return undefined;
      return value ?? null;
    };
    let replied = false;
    const fake = {
      isPrefixAdapter: true,
      guild: message.guild,
      guildId: message.guildId,
      channel: message.channel,
      channelId: message.channelId,
      user: message.author,
      member: message.member,
      memberPermissions: message.member?.permissions,
      client,
      options: {
        getString: (n, r) => get(n, r, "string"),
        getInteger: (n, r) => get(n, r, "integer"),
        getBoolean: (n, r) => get(n, r, "boolean"),
        getUser: (n, r) => get(n, r, "user"),
        getMember: (n, r) => { const user = get(n, r, "user"); return user ? message.guild.members.cache.get(user.id) || null : null; },
        getChannel: (n, r) => get(n, r, "channel"),
        getRole: (n, r) => get(n, r, "role"),
      },
      replied: false,
      deferred: false,
      inGuild: () => Boolean(message.guild),
      reply: async payload => { const result = await message.reply(stripEphemeral(payload)); fake.replied = true; replied = true; return result; },
      followUp: async payload => { const result = await message.reply(stripEphemeral(payload)); fake.replied = true; replied = true; return result; },
      editReply: async payload => message.reply(stripEphemeral(payload)),
      deferReply: async () => { fake.deferred = true; },
      isChatInputCommand: () => true,
    };
    try { await command.execute({interaction: fake, client, env}); }
    catch (error) {
      console.error(`[prefix:${command.name}]`, error);
      if (!replied) await message.reply({content: `Could not run this command. Try slash command /${command.name} for guided options.`}).catch(() => {});
    }
  };
}
function stripEphemeral(payload) { if (!payload || typeof payload !== "object") return payload; const out = {...payload}; delete out.ephemeral; return out; }
