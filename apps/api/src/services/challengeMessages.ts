import type { ChallengeActionType } from '@gogz/shared';

export interface MessageContext {
  actorName: string;
  prize: string;
  link: string;
  winnerName?: string;
}

/** Text sent to the other player after each move. */
export function challengeMessage(
  event: ChallengeActionType | 'create',
  ctx: MessageContext,
): string {
  const { actorName, prize, link } = ctx;
  const p = `"${prize}"`;
  switch (event) {
    case 'create':
      return `⛳ ${actorName} challenged you to a round for ${p}. Accept, decline or counter: ${link}`;
    case 'counter':
      return `⛳ ${actorName} countered your challenge: ${p}. Your move: ${link}`;
    case 'accept':
      return `⛳ ${actorName} accepted your challenge for ${p}. Game on! ${link}`;
    case 'decline':
      return `⛳ ${actorName} declined your challenge for ${p}. ${link}`;
    case 'cancel':
      return `⛳ ${actorName} withdrew their challenge for ${p}. ${link}`;
    case 'report':
      return `⛳ ${actorName} says ${ctx.winnerName ?? 'someone'} won ${p}. Confirm or dispute: ${link}`;
    case 'confirm':
      return `⛳ ${actorName} confirmed the result for ${p}. ${link}`;
    case 'dispute':
      return `⛳ ${actorName} disputed the result for ${p}. Report it again once you agree: ${link}`;
  }
}
