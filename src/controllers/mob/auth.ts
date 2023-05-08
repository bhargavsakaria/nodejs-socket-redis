import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import AccessTokens from '../../entities/AccessTokens.postgres';
import { relativeJWTExpiry, seniorJWTExpiry, YesNo } from '../../utils/constants';
import { HttpStatus } from '../../typings/global/http-status.enum';
import { getPasswordResetURL, resetPasswordTemplate, transporter, usePasswordHashToMakeToken } from '../email';
import User from '../../entities/User.postgres';
import { UserRepository } from '../../repositories/user.repository';
import { getCustomRepository, getRepository } from 'typeorm';
const JWT_SECRET = process.env['JWT_SECRET'] as string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email_or_username, password, device_token, platform } = req.body;

    const user: User = await getCustomRepository(UserRepository).getUserByEmailOrUsername(email_or_username);

    if (!user) {
      throw { message: req.t('backend:error.user_not_found'), code: HttpStatus.NOT_FOUND };
    }

    const isValid = await user.validatePassword(password);

    if (!isValid) {
      throw { message: req.t('backend:error.password_does_not_match'), code: HttpStatus.FORBIDDEN };
    }

    if (user.socketId !== null) {
      throw { message: req.t('backend:error.session_active_in_another_device'), code: HttpStatus.FORBIDDEN };
    }

    const payload = {
      user_id: user.id,
      role: user.role
    };

    let access_tokens = await getRepository(AccessTokens).find({
      where: { isRevoked: YesNo.NO, userId: user.id }
    });

    if (access_tokens) {
      access_tokens.forEach(async (element) => {
        element.isRevoked = YesNo.YES;
        await getRepository(AccessTokens).save(element);
      });
    }

    let token;
    if (user.isSenior) {
      token = jwt.sign(payload, JWT_SECRET, { expiresIn: seniorJWTExpiry });
    } else {
      token = jwt.sign(payload, JWT_SECRET, { expiresIn: relativeJWTExpiry });
    }

    const access_token = await getRepository(AccessTokens).save({
      token,
      userId: user.id,
      deviceToken: device_token,
      platform: platform
    });

    const new_user = user.newUser === null ? 0 : user.newUser;
    if (user.newUser || user.newUser === null) {
      user.newUser = YesNo.NO;
      await getRepository(User).save(user);
    }

    const role = await getCustomRepository(UserRepository).getCorrectRole(user.id);

    return res.mobDeliver(
      {
        access_token: access_token.token,
        role,
        new_user,
        user_id: user.id,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl === null ? '' : user.imageUrl,
        it_support: user.hasItSupport === null ? '' : user.hasItSupport
      },
      req.t('backend:success.logged_in')
    );
  } catch (error: any) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const id = req.user?.id;

    const user: User = await getCustomRepository(UserRepository).getUser({ id });

    if (user) {
      user.socketId = null;
      await getRepository(User).save(user);
    }

    const access_token = await getRepository(AccessTokens).findOne({
      where: {
        userId: id,
        isRevoked: YesNo.NO
      }
    });

    if (access_token) {
      access_token.isRevoked = YesNo.YES;

      await getRepository(AccessTokens).save(access_token);
      return res.mobDeliver({}, req.t('backend:success.logged_out'));
    }
  } catch (error: any) {
    next(error);
  }
};

export const sendResetPasswordLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    const token = usePasswordHashToMakeToken(user);
    const url = getPasswordResetURL(user, token);
    const emailTemplate = resetPasswordTemplate(user, url);

    const sendEmail = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      transporter.sendMail(emailTemplate, (error, info) => {
        if (error) {
          throw { message: error.message };
        }
      });
    };
    sendEmail();
    res.mobDeliver({}, req.t('backend:success.email_sent'));
  } catch (error) {
    next(error);
  }
};
