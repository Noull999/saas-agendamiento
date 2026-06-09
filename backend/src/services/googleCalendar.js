const { google } = require('googleapis');
const db = require('../db/database');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getRedirectUrl() {
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/integrations/google/callback`;
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[gcal] Google credentials not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUrl());
}

function getAuthUrl(state) {
  const client = getOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // ensures we always get a refresh_token
  });
}

async function getTokens(code) {
  const client = getOAuth2Client();
  if (!client) throw new Error('Google OAuth no está configurado');

  const { tokens } = await client.getToken(code);
  return tokens;
}

// Builds an authenticated OAuth2 client for a business, wiring up token refresh
// so that any refreshed access/refresh tokens get persisted back to the DB.
async function getAuthForBusiness(businessId) {
  const { rows } = await db.query(
    `SELECT access_token, refresh_token, calendar_id FROM integrations
     WHERE business_id = $1 AND type = 'google_calendar' AND active = true`,
    [businessId]
  );
  if (!rows[0]) return null;

  const auth = getOAuth2Client();
  if (!auth) return null;

  auth.setCredentials({
    access_token: rows[0].access_token,
    refresh_token: rows[0].refresh_token,
  });

  // Persist refreshed tokens (googleapis auto-refreshes when access_token expires)
  auth.on('tokens', (tokens) => {
    const sets = [];
    const params = [businessId];
    let i = 2;
    if (tokens.access_token) { sets.push(`access_token = $${i++}`); params.push(tokens.access_token); }
    if (tokens.refresh_token) { sets.push(`refresh_token = $${i++}`); params.push(tokens.refresh_token); }
    if (tokens.expiry_date) { sets.push(`token_expiry = $${i++}`); params.push(new Date(tokens.expiry_date)); }
    if (!sets.length) return;
    db.query(
      `UPDATE integrations SET ${sets.join(', ')} WHERE business_id = $1 AND type = 'google_calendar'`,
      params
    ).catch((err) => console.warn('[gcal] failed to persist refreshed tokens:', err.message));
  });

  return { auth, calendarId: rows[0].calendar_id || 'primary' };
}

async function createCalendarEvent(businessId, { summary, description, startISO, endISO, location, eventId = null }) {
  try {
    const ctx = await getAuthForBusiness(businessId);
    if (!ctx) return null;

    const calendar = google.calendar({ version: 'v3', auth: ctx.auth });

    const requestBody = {
      summary,
      description,
      start: { dateTime: startISO, timeZone: 'America/Santiago' },
      end: { dateTime: endISO, timeZone: 'America/Santiago' },
    };
    if (location) requestBody.location = location;
    if (eventId) requestBody.id = eventId; // optional: deterministic event ID for tracking

    const response = await calendar.events.insert({
      calendarId: ctx.calendarId,
      requestBody,
    });

    return response.data.id;
  } catch (err) {
    console.error('[gcal] createCalendarEvent error:', err.message);
    return null;
  }
}

async function deleteCalendarEvent(businessId, eventId) {
  if (!eventId) return false;

  try {
    const ctx = await getAuthForBusiness(businessId);
    if (!ctx) return false;

    const calendar = google.calendar({ version: 'v3', auth: ctx.auth });

    await calendar.events.delete({
      calendarId: ctx.calendarId,
      eventId,
    });

    return true;
  } catch (err) {
    // 404/410 means the event is already gone — treat as success enough, just log.
    console.warn('[gcal] deleteCalendarEvent error:', err.message);
    return false;
  }
}

module.exports = {
  getAuthUrl,
  getTokens,
  createCalendarEvent,
  deleteCalendarEvent,
};
