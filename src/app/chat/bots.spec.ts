import { BOT_USERS } from '../core/models';
import { pickReply } from './bots';

describe('pickReply', () => {
  it('answers with the mentioned bot', () => {
    const r = pickReply({ roomId: 'general', text: 'oi @diego tudo bem' }, BOT_USERS, () => 0);
    expect(r.bot.id).toBe('bot-diego');
  });

  it('uses a generic answer for questions', () => {
    const r = pickReply({ roomId: 'angular', text: 'signals ou rxjs?' }, BOT_USERS, () => 0);
    expect(r.text).toContain('Boa pergunta');
  });

  it('falls back to the general pool for unknown rooms', () => {
    const r = pickReply({ roomId: 'nope', text: 'oi' }, BOT_USERS, () => 0);
    expect(r.text.length).toBeGreaterThan(0);
  });
});
