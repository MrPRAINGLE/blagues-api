import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteraction,
  ComponentType,
  GuildMember,
  InteractionReplyOptions,
  Message,
  MessageComponentInteraction,
  MessageOptions,
  TextChannel,
  User
} from 'discord.js';
import { diffWords } from 'diff';
import { APIEmbed } from 'discord-api-types/v10';
import { godfatherRoleId } from './constants';
import { suggestionsChannelId, correctionsChannelId, reportsChannelId } from './constants';

type UniversalInteractionOptions = Omit<InteractionReplyOptions, 'flags'>;
type UniversalMessageOptions = Omit<MessageOptions, 'flags'>;

export function problem(message: string): APIEmbed {
  return {
    description: `❌ ${message}`,
    color: 0xff0000
  };
}

export function messageProblem(message: string): UniversalMessageOptions {
  return {
    content: '',
    embeds: [problem(message)],
    components: []
  };
}

export function interactionProblem(message: string, ephemeral = true): UniversalInteractionOptions {
  return {
    content: '',
    embeds: [problem(message)],
    components: [],
    ephemeral
  };
}

export function info(message: string): APIEmbed {
  return {
    description: `💡 ${message}`,
    color: 0xffd983
  };
}

export function messageInfo(message: string): UniversalMessageOptions {
  return {
    content: '',
    embeds: [info(message)],
    components: []
  };
}

export function interactionInfo(message: string, ephemeral = true): UniversalInteractionOptions {
  return {
    content: '',
    embeds: [info(message)],
    components: [],
    ephemeral
  };
}

export function validate(message: string): APIEmbed {
  return {
    description: `✅ ${message}`,
    color: 0x7fef34
  };
}

export function messageValidate(message: string): UniversalMessageOptions {
  return {
    content: '',
    embeds: [validate(message)],
    components: []
  };
}

export function interactionValidate(message: string, ephemeral = true): UniversalInteractionOptions {
  return {
    content: '',
    embeds: [validate(message)],
    components: [],
    ephemeral
  };
}

export function showPositiveDiffs(oldValue: string, newValue: string): string {
  return diffWords(oldValue, newValue)
    .filter((part) => !part.removed)
    .map((part) => `${part.added ? '`' : ''}${part.value}${part.added ? '`' : ''}`)
    .join('');
}

export function showNegativeDiffs(oldValue: string, newValue: string): string {
  return diffWords(oldValue, newValue)
    .filter((part) => !part.added)
    .map((part) => `${part.removed ? '~~`' : ''}${part.value}${part.removed ? '`~~' : ''}`)
    .join('');
}

export function isEmbedable(channel: TextChannel) {
  const permissions = channel.permissionsFor(channel.guild.members.me!);
  return permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks']);
}

export function tDelete(timeout = 6000) {
  return (message: Message) => setTimeout(() => message.deletable && message.delete().catch(() => null), timeout);
}

export function messageLink(guildId: string, channelId: string, messageId: string) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function isParrain(member: GuildMember) {
  return member.roles.cache.has(godfatherRoleId);
}

export async function interactionWaiter(message: Message<true>, user: User) {
  return new Promise<ButtonInteraction<'cached'>>((resolve, reject) => {
    const collector = message
      .createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 60_000
      })
      .on('collect', async (interaction) => {
        if (interaction.user.id !== user.id) {
          await interaction.reply(interactionInfo("Vous n'êtes pas autorisé à interagir avec ce message."));
          return;
        }
        collector.stop('finish');
        resolve(interaction);
      })
      .once('end', (_interactions, reason) => {
        if (reason !== 'finish') reject(reason);
      });
  });
}

export async function paginate(
  interaction: CommandInteraction<'cached'>,
  embed: APIEmbed,
  pages: string[],
  page = 0,
  oldMessage: Message<true> | null = null
): Promise<void> {
  const message =
    oldMessage ||
    (await interaction.reply({
      embeds: [embed],
      components:
        pages.length > 1
          ? [
              {
                type: ComponentType.ActionRow,
                components: [
                  { type: ComponentType.Button, label: 'Précedent', style: ButtonStyle.Primary, customId: 'last' },
                  { type: ComponentType.Button, label: 'Suivant', style: ButtonStyle.Primary, customId: 'next' }
                ]
              }
            ]
          : [],
      fetchReply: true
    }));

  if (pages.length <= 1) return;

  try {
    const buttonInteraction = await interactionWaiter(message, interaction.user);
    if (!buttonInteraction) return;

    switch (buttonInteraction.customId) {
      case 'last':
        page = (page > 0 ? page : pages.length) - 1;
        break;
      case 'next':
        page = page < pages.length - 1 ? page + 1 : 0;
        break;
    }

    embed.description = pages[page];
    embed.footer = { ...(embed.footer ?? {}), text: `Page ${page + 1}/${pages.length} • Blagues-API` };

    await buttonInteraction.update({ embeds: [embed] });
  } catch (error) {
    // TOOD: Catch les erreurs
  }

  return paginate(interaction, embed, pages, page, message);
}

export async function waitForConfirmation(
  interaction: ChatInputCommandInteraction,
  embed: APIEmbed,
  sendType: string
): Promise<ButtonInteraction | null> {
  const message = await interaction.reply({
    content: `Êtes-vous sûr de vouloir confirmer la proposition de ce${
      sendType === 'report' ? ' signalement' : 'tte blague'
    } ?`,
    embeds: [embed],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label: 'Envoyer',
            customId: 'send',
            style: ButtonStyle.Success
          },
          {
            type: ComponentType.Button,
            label: 'Annuler',
            customId: 'cancel',
            style: ButtonStyle.Danger
          }
        ]
      }
    ],
    ephemeral: true,
    fetchReply: true
  });

  return new Promise((resolve) => {
    const collector = message.createMessageComponentCollector({
      max: 1,
      componentType: ComponentType.Button,
      filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id,
      time: 60_000
    });
    collector.once('end', async (interactions, reason) => {
      const buttonInteraction = interactions.first();
      if (!buttonInteraction) {
        if (reason !== 'time') resolve(null);
        if (message.deletable) await message.delete();
        await interaction.reply(interactionInfo('Les 60 secondes se sont ecoulées.'));
        return resolve(null);
      }

      return resolve(buttonInteraction);
    });
  });
}

type DeclarationTemplate = {
  WORD: string;
  WORD_CAPITALIZED: string;
  WITH_UNDEFINED_ARTICLE: string;
  WITH_DEMONSTRATIVE_DETERMINANT: string;
};

export const Declaration: Record<string, DeclarationTemplate> = {
  [suggestionsChannelId]: {
    WORD: 'blague',
    WORD_CAPITALIZED: 'Blague',
    WITH_UNDEFINED_ARTICLE: 'une blague',
    WITH_DEMONSTRATIVE_DETERMINANT: 'Cette blague'
  },
  [correctionsChannelId]: {
    WORD: 'correction',
    WORD_CAPITALIZED: 'Correction',
    WITH_UNDEFINED_ARTICLE: 'une correction',
    WITH_DEMONSTRATIVE_DETERMINANT: 'Cette correction'
  },
  [reportsChannelId]: {
    WORD: 'signalement',
    WORD_CAPITALIZED: 'Signalement',
    WITH_UNDEFINED_ARTICLE: 'un signalement',
    WITH_DEMONSTRATIVE_DETERMINANT: 'Ce signalement'
  }
} as const;
