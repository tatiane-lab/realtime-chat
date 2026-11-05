import { Message, User } from '../core/models';

const REPLIES: Record<string, string[]> = {
  general: [
    'Bom dia, time! Alguém já viu o último deploy?',
    'Boa! Vou revisar isso agora mesmo.',
    'Concordo. Podemos alinhar na daily.',
    'Tem café fresco na copa, só avisando.',
    'Ótima ideia, abre um card que eu pego.',
  ],
  angular: [
    'Signals deixaram o estado muito mais previsível, né?',
    'Já testou `computed()` no lugar daquele getter? Fica bem mais enxuto.',
    'OnPush + signals e o change detection fica quase de graça.',
    'Para listas grandes, trackBy (ou `track` no @for) faz diferença.',
    'Standalone components acabaram com a dor dos NgModules.',
  ],
  random: [
    'Hahaha, essa foi boa.',
    'Alguém indica uma série boa pro fim de semana?',
    'Eu sou time pão de queijo, sem discussão.',
    'Isso me lembrou um meme antigo de dev.',
    'Sextou! (mesmo sendo terça).',
  ],
};

export const GREETINGS: Record<string, { bot: string; text: string }[]> = {
  general: [
    { bot: 'bot-carla', text: 'Bem-vindos ao #general! Aqui rolam os avisos e as conversas do dia a dia.' },
    { bot: 'bot-diego', text: 'Dica: abra o app em duas abas, entre como Ana e como Bruno e converse em tempo real.' },
  ],
  angular: [{ bot: 'bot-diego', text: 'Canal para falar de Angular: signals, SSR, testes, performance...' }],
  random: [{ bot: 'bot-carla', text: 'Aqui vale tudo, menos spoiler de série.' }],
};

/** Escolhe qual bot responde e o que diz. Função pura, fácil de testar. */
export function pickReply(
  message: Pick<Message, 'roomId' | 'text'>,
  bots: readonly User[],
  rand: () => number = Math.random,
): { bot: User; text: string } {
  const bot = bots[Math.floor(rand() * bots.length)];
  const mentioned = bots.find((b) => message.text.toLowerCase().includes(`@${b.username.toLowerCase()}`));
  const chosen = mentioned ?? bot;
  const pool = REPLIES[message.roomId] ?? REPLIES['general'];
  const text = message.text.trim().endsWith('?')
    ? 'Boa pergunta! Acho que depende do contexto, mas eu começaria pelo mais simples.'
    : pool[Math.floor(rand() * pool.length)];
  return { bot: chosen, text };
}
