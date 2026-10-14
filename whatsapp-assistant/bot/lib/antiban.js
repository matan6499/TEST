// Guard rails that keep the bot's number looking like a calm human user, so WhatsApp
// has no reason to ban it: it never messages anyone who did not write first, sends at
// a human pace, caps volume per chat and per day, and joins groups sparingly.

export const LIMITS = Object.freeze({
  minGapMs: 1500,          // at least this long between any two outgoing messages
  jitterMs: 1500,          // plus a random extra, so the rhythm is not robotic
  perChatPerMinute: 8,     // replies into one chat per minute
  perDay: 300,             // outgoing messages per day, all chats together
  inboundWindowMs: 24 * 60 * 60_000, // a chat counts as "wrote to us" for 24h
  floodPerMinute: 6,       // incoming triggers from one chat per minute before we pause
  joinsPerDay: 3,          // group invite links accepted per day
});

export class OutboundGuard {
  constructor({ limits = LIMITS, now = () => Date.now(), random = Math.random } = {}) {
    this.limits = limits;
    this.now = now;
    this.random = random;
    this.lastInbound = new Map();   // jid -> last time they wrote to us
    this.sentLog = [];               // [{ t, jid }]
    this.inLog = new Map();          // jid -> [times] of incoming triggers
    this.joins = [];
    this.lastSendAt = 0;
  }

  noteInbound(jid) { if (jid) this.lastInbound.set(jid, this.now()); }

  // Replies only: owner and approved groups are always fine, anyone else must have
  // written to the bot in the last 24 hours.
  checkRecipient(jid, { isOwnerJid = false, allowedChats = [] } = {}) {
    if (isOwnerJid || allowedChats.includes(jid)) return null;
    const last = this.lastInbound.get(jid);
    if (last && this.now() - last < this.limits.inboundWindowMs) return null;
    return 'הבוט לא שולח הודעה ראשונה למי שלא כתב לו';
  }

  checkVolume(jid) {
    const t = this.now();
    this.sentLog = this.sentLog.filter(e => t - e.t < 24 * 60 * 60_000);
    if (this.sentLog.length >= this.limits.perDay) return 'הגענו למכסת ההודעות היומית';
    const recent = this.sentLog.filter(e => e.jid === jid && t - e.t < 60_000).length;
    if (recent >= this.limits.perChatPerMinute) return 'יותר מדי הודעות לצ\'אט הזה בדקה האחרונה';
    return null;
  }

  // How long to wait before this send, to keep a human pace.
  delayBeforeSend() {
    const gap = this.limits.minGapMs + Math.floor(this.random() * this.limits.jitterMs);
    return Math.max(0, this.lastSendAt + gap - this.now());
  }

  recordSend(jid) {
    this.lastSendAt = this.now();
    this.sentLog.push({ t: this.lastSendAt, jid });
  }

  // True when a chat is firing triggers faster than a person would (a loop or spam).
  isFlooding(jid) {
    const t = this.now();
    const list = (this.inLog.get(jid) || []).filter(x => t - x < 60_000);
    list.push(t);
    this.inLog.set(jid, list);
    return list.length > this.limits.floodPerMinute;
  }

  canJoin() {
    const t = this.now();
    this.joins = this.joins.filter(x => t - x < 24 * 60 * 60_000);
    return this.joins.length < this.limits.joinsPerDay;
  }
  recordJoin() { this.joins.push(this.now()); }
}
