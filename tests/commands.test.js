import test from "node:test";
import assert from "node:assert/strict";
import ping from "../src/commands/slash/ping.js";
import help from "../src/commands/slash/help.js";
import info from "../src/commands/slash/botinfo.js";
import pp from "../src/commands/prefix/ping.js";
import ph from "../src/commands/prefix/help.js";
import {createModerationCommand} from "../src/utils/moderationCommands.js";

const moderationNames = [
  "ban", "unban", "kick", "softban", "timeout", "untimeout", "warn", "warnings", "clearwarnings",
  "purge", "slowmode", "lock", "unlock", "nick", "quarantine", "unquarantine", "modconfig",
];

test("base slash command metadata", () => {
  for (const command of [ping, help, info]) {
    assert.equal(typeof command.name, "string");
    assert.equal(typeof command.execute, "function");
    assert.equal(typeof command.data.toJSON, "function");
  }
});

test("prefix command metadata", () => {
  for (const command of [pp, ph]) {
    assert.equal(typeof command.name, "string");
    assert.equal(typeof command.execute, "function");
  }
});

test("all 17 moderation slash commands export valid command metadata", () => {
  assert.equal(new Set(moderationNames).size, 17);
  for (const name of moderationNames) {
    const command = createModerationCommand(name);
    assert.equal(command.name, name);
    assert.equal(typeof command.execute, "function");
    assert.equal(command.data.toJSON().name, name);
  }
});

test("ban/kick DM attempts do not have a delivery-required config switch", () => {
  const config = createModerationCommand("modconfig").data.toJSON();
  const optionNames = config.options.map(option => option.name);
  assert.ok(optionNames.includes("setup_warning_channel"));
  assert.ok(optionNames.includes("disable_logs"));
  assert.ok(!optionNames.includes("kick_dm_enabled"));
});
