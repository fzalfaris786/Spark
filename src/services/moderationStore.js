import {getDatabase} from "../database/mongodb.js";

// Action history is intentionally NOT written to MongoDB. Successful actions are
// sent to a configured Discord log channel only. The records below are operational
// state required by quarantine and server configuration. Warning records stay in Discord.
const quarantineCache = new Map();
const settingsCache = new Map();
const key = (guildId, userId) => `${guildId}:${userId}`;
function database() { try { return getDatabase(); } catch { return null; } }

export const DEFAULT_MODERATION_SETTINGS = Object.freeze({
  logsChannelId: null,
  warningChannelId: null,
  quarantineRoleId: null,
  quarantineAppealChannelId: null,
});

export async function saveQuarantine(guildId, userId, record) {
  const db = database();
  if (db) {
    await db.collection("moderation_quarantine").updateOne(
      {guildId, userId},
      {$set: {...record, guildId, userId, updatedAt: new Date()}},
      {upsert: true},
    );
    return;
  }
  quarantineCache.set(key(guildId, userId), record);
}

export async function getQuarantine(guildId, userId) {
  const db = database();
  if (db) return (await db.collection("moderation_quarantine").findOne({guildId, userId})) || null;
  return quarantineCache.get(key(guildId, userId)) || null;
}

export async function deleteQuarantine(guildId, userId) {
  const db = database();
  if (db) { await db.collection("moderation_quarantine").deleteOne({guildId, userId}); return; }
  quarantineCache.delete(key(guildId, userId));
}

export async function getModerationSettings(guildId) {
  const db = database();
  let saved;
  if (db) saved = await db.collection("guild_moderation_settings").findOne({guildId});
  else saved = settingsCache.get(guildId);
  return {...DEFAULT_MODERATION_SETTINGS, ...(saved || {})};
}

export async function updateModerationSettings(guildId, patch) {
  const current = await getModerationSettings(guildId);
  const next = {...current, ...patch, guildId, updatedAt: new Date()};
  const db = database();
  if (db) {
    const {$set} = { $set: next };
    delete $set._id;
    await db.collection("guild_moderation_settings").updateOne({guildId}, {$set}, {upsert: true});
  } else {
    settingsCache.set(guildId, next);
  }
  return next;
}
