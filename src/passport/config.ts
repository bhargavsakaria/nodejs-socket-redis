import passportLocal from 'passport-local';
import bcrypt from 'bcryptjs';
import passportJWT, { ExtractJwt } from 'passport-jwt';

import User from '../entities/User.postgres';
import { Request } from 'express';
import AccessTokens from '../entities/AccessTokens.postgres';
import { YesNo } from '../utils/constants';
import { HttpStatus } from '../typings/global/http-status.enum';
import { UserRepository } from '../repositories/user.repository';
import { getCustomRepository } from 'typeorm';

const LocalStrategy = passportLocal.Strategy;
const JWTStrategy = passportJWT.Strategy;
const JWTMobStrategy = passportJWT.Strategy;

export const local = new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username: string, password: string, done: any) => {
    try {
      const user = await User.findOne({
        select: ['id', 'username', 'password', 'role'],
        where: { username: username },
        relations: ['group', 'group.members', 'orders', 'orders.services']
      });

      if (!user) {
        return done(null, false, { message: `Username ${username} not found` });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      return done(
        null,
        await User.findOne({
          where: { id: user.id },
          relations: ['group', 'group.members', 'orders', 'orders.services']
        })
      );
    } catch (error) {
      console.log('error', error);
    }
  }
);
export const jwt = new JWTStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  },
  async (jwtPayload, done) => {
    const { id, role } = jwtPayload;

    if (role === 'customer') {
      const user = await User.findOne(id, {
        relations: ['group', 'group.members', 'orders', 'orders.services']
      });
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    }
    if (role !== 'customer') {
      const user = await User.findOne(id, {
        relations: ['group', 'group.members']
      });
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    }
  }
);

export const mob = new JWTMobStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
  },
  // @ts-ignore
  async (req: Request, jwtPayload, done) => {
    try {
      const { user_id: id } = jwtPayload;

      const user = await getCustomRepository(UserRepository).getUser({ id });

      const authorizationToken = req.headers.authorization?.split(' ')[1];

      const accessToken = await AccessTokens.findOne({
        where: { token: authorizationToken, isRevoked: YesNo.NO, userId: user.id }
      });

      if (!accessToken) {
        throw { message: req.t('backend:error.invalid_token'), code: HttpStatus.UNAUTHORIZED };
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }
);
