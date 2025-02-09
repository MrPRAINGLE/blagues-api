import { FastifyInstance, FastifyReply } from 'fastify';
import { generateAPIToken, generateKey } from '../../utils';
import prisma from '../../prisma';
import got from 'got';
import { APIUser, OAuth2Routes, RESTPostOAuth2AccessTokenResult } from 'discord-api-types/v9';
import { DashboardAuthLogin, DashboardAuthUser, RegenerateReply, RegenerateRequest } from '../types';
import { MissingKey } from '../Errors';

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.route({
    url: '/auth/user',
    method: 'GET',
    onRequest: fastify.apiAuth,
    handler: async (req: DashboardAuthUser, res) => {
      try {
        const discordUser = await got('https://discord.com/api/v10/users/@me', {
          headers: {
            Authorization: req.headers.authorization
          }
        }).json<APIUser>();
        const user = await prisma.user.findUnique({
          select: { token: true, token_key: true },
          where: { user_id: discordUser.id }
        });
        if (!user) {
          return res.code(404).send({ error: 'User not found' });
        }
        return res.code(200).send({
          id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
          token: user.token,
          token_key: user.token_key
        });
      } catch (error) {
        console.error(error);
        return res.code(401).send({ error });
      }
    }
  });
  fastify.route({
    url: '/auth/token',
    method: 'POST',
    handler: async (req: DashboardAuthLogin, res: FastifyReply) => {
      const authData = await got
        .post(OAuth2Routes.tokenURL, {
          form: req.body
        })
        .json<RESTPostOAuth2AccessTokenResult>();

      const discordUser = await got('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${authData.access_token}`
        }
      }).json<APIUser>();

      const key = generateKey();
      const token = generateAPIToken(discordUser.id, key, 100);

      await prisma.user.upsert({
        create: {
          user_id: discordUser.id,
          user_name: discordUser.username,
          user_avatar: discordUser.avatar ?? '',
          user_token: authData.access_token,
          user_token_refresh: authData.refresh_token,
          token_key: key,
          token,
          limit: 100
        },
        update: {
          user_name: discordUser.username,
          user_token: authData.access_token,
          user_token_refresh: authData.refresh_token
        },
        where: { user_id: discordUser.id }
      });

      return res.code(200).send(authData);
    }
  });
  fastify.route({
    url: '/regenerate',
    method: 'POST',
    onRequest: fastify.apiAuth,
    handler: async (req: RegenerateRequest, res: FastifyReply) => {
      if (!req.body || req.body.key !== req.auth!.key) {
        return res.code(400).send(MissingKey);
      }

      const token_key = generateKey();
      const token = generateAPIToken(req.auth!.user_id, token_key, 100);
      const data: RegenerateReply = {
        token_key,
        token
      };

      await prisma.user.update({
        data,
        where: { user_id: req.auth!.user_id }
      });

      return res.code(200).send(data);
    }
  });
};
