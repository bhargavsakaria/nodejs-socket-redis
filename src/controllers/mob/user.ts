import { NextFunction, Request, Response } from 'express';
import UserSettings from '../../entities/UserSettings.postgres';
import { HttpStatus } from '../../typings/global/http-status.enum';
import Notifications from '../../entities/Notifications.postgres';
import SupportStaffs from '../../entities/SupportStaffs.postgres';
import { aws_bucket, aws_credentials, aws_region } from '../../utils/awsConfiguration';
import AWS, { S3 } from 'aws-sdk';
import { YesNo, Role, dateFormat, timeFormat } from '../../utils/constants';
import CallHistory from '../../entities/CallHistory.postgres';
import User from '../../entities/User.postgres';
import moment from 'moment';
import ApplicationVersions from '../../entities/ApplicationVersions.postgres';
import { getCustomRepository, getRepository, IsNull } from 'typeorm';
import { isToday, isYesterday } from '../../helpers/dateHelper';
import firebase from '../../helpers/firebase';
import upload from '../../helpers/fileUpload';
import AccessTokens from '../../entities/AccessTokens.postgres';
import { UserRepository } from '../../repositories/user.repository';

AWS.config.update({
  apiVersion: 'latest',
  credentials: aws_credentials,
  region: aws_region
});

export const changeAutoAnswerStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const id = req.user?.id;
    const status = req.body.status;

    const user = await getCustomRepository(UserRepository).getUser({ id: id });

    if (user && user.isSenior) {
      const userSetting = await getRepository(UserSettings).findOne({
        // @ts-ignore
        where: { userId: user.id }
      });

      if (userSetting) {
        userSetting.autoAnswer = status;
        await getRepository(UserSettings).save(userSetting);
      }

      if (!userSetting) {
        const newUserSettings = getRepository(UserSettings).create({
          userId: user.id,
          autoAnswer: status
        });

        await getRepository(UserSettings).save(newUserSettings);
      }

      return res.mobDeliver({ status }, req.t('backend:success.auto_answer_status_changed'));
    }

    throw { message: req.t('backend:error.user_not_senior'), code: HttpStatus.BAD_REQUEST };
  } catch (error) {
    next(error);
  }
};

export const getAutoAnswerStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const id = req.user?.id;

    const user = await getCustomRepository(UserRepository).getUser({ id: id });

    if (user && user.isSenior) {
      const userSetting = await getRepository(UserSettings).findOne({
        // @ts-ignore
        where: { userId: user.id }
      });

      if (userSetting) {
        return res.mobDeliver({ status: userSetting.autoAnswer }, req.t('backend:success.auto_answer_status'));
      } else {
        return res.mobDeliver({ status: YesNo.NO }, req.t('backend:success.auto_answer_status'));
      }
    }
    throw { message: req.t('backend:error.user_not_senior'), code: HttpStatus.BAD_REQUEST };
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const id = req.user?.id;

    const user = await getCustomRepository(UserRepository).getUser({ id: id });

    const staff = await getRepository(SupportStaffs).findOne({
      select: ['id'],
      where: { user: user }
    });

    if (user && staff && (user.role === Role.NURSE || user.role === Role.IT)) {
      const notifications = await getRepository(Notifications).find({
        where: { staffId: staff.id },
        order: { id: 'DESC' }
      });

      const unReadMessages = notifications.map((entry) => {
        return {
          name: entry.name === null ? '' : entry.name,
          message: entry.message,
          read: entry.isRead,
          received_at: isToday(entry.createdAt)
            ? `${req.t('backend:misc.today')} ${moment(entry.createdAt).format(timeFormat)}`
            : isYesterday(entry.createdAt)
            ? `${req.t('backend:misc.yesterday')} ${moment(entry.createdAt).format(timeFormat)}`
            : moment(entry.createdAt).format(dateFormat)
        };
      });

      notifications.forEach(async (entry) => {
        entry.isRead = YesNo.YES;
        await getRepository(Notifications).save(entry);
      });

      return res.mobDeliver(unReadMessages, req.t('backend:success.unread_notifications'));
    } else {
      throw { message: req.t('backend:error.unauthorized_access'), code: HttpStatus.UNAUTHORIZED };
    }
  } catch (error) {
    next(error);
  }
};

export const resetApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const user_id = req.user?.id;

    const callsReceived = await getRepository(CallHistory).find({
      where: {
        receiverId: user_id,
        deletedForReceiver: IsNull()
      }
    });

    if (callsReceived.length) {
      callsReceived.forEach(async (received) => {
        received.deletedForReceiver = new Date();
        if (received.deletedForSender !== null && received.deletedAt === null) {
          received.deletedAt = new Date();
        }
        await getRepository(CallHistory).save(received);
      });
    }

    const callsMade = await getRepository(CallHistory).find({
      where: {
        senderId: user_id,
        deletedForSender: IsNull()
      }
    });

    if (callsMade.length) {
      callsMade.forEach(async (sent) => {
        sent.deletedForSender = new Date();
        if (sent.deletedForReceiver !== null && sent.deletedAt === null) {
          sent.deletedAt = new Date();
        }
        await getRepository(CallHistory).save(sent);
      });
    }

    return res.mobDeliver({}, req.t('backend:success.call_history_cleared'));
  } catch (error) {
    next(error);
  }
};

export const updateProfileImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    upload(req, res, async (error) => {
      if (error && error.code === 'LIMIT_FILE_SIZE') {
        throw { message: req.t('backend:error.image_too_large'), code: HttpStatus.BAD_REQUEST };
      }

      const s3 = new AWS.S3();

      const file = req.file;

      // @ts-ignore
      const user = await getCustomRepository(UserRepository).getUser({ id: req.user?.id });

      s3.deleteObject({ Bucket: aws_bucket, Key: `users-profile/${user.image}` }, async (error, data) => {
        if (error) {
          throw { message: error.message, code: HttpStatus.NOT_FOUND };
        }

        if (data.DeleteMarker) {
          let s3Response: S3.ManagedUpload.SendData;

          if (file) {
            const imageName = Math.floor(Date.now() / 1000) + '_' + file.originalname;

            const uploadOptions: S3.Types.PutObjectRequest = {
              Bucket: aws_bucket,
              Key: `users-profile/${imageName}`,
              Body: file.buffer,
              ContentType: file.mimetype,
              ACL: 'public-read'
            };
            s3Response = await s3.upload(uploadOptions).promise();

            user.image = imageName;
            user.imageUrl = s3Response.Location;
            await getRepository(User).save(user);

            return res.mobDeliver(
              {
                url: s3Response.Location
              },
              req.t('backend:success.new_image_data_saved')
            );
          }
        } else {
          throw { message: req.t('backend:error.something_went_wrong'), code: HttpStatus.INTERNAL_SERVER_ERROR };
        }
      });
    });
  } catch (error) {
    next(error);
  }
};

export const getProfileImageUrl = async (req: Request, res: Response) => {
  // @ts-ignore
  const image_url = req.user?.imageUrl;

  if (image_url !== null) {
    return res.mobDeliver({ url: image_url }, req.t('backend:success.image_found'));
  } else {
    return res.mobDeliver({ url: '' }, req.t('backend:error.image_not_found'));
  }
};

export const missedCalls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    moment.locale(req.headers['accept-language']);
    // @ts-ignore
    const user_id = req.user?.id;

    const receiverHistory = await getRepository(CallHistory)
      .createQueryBuilder('ch')
      .innerJoinAndSelect(User, 's', 'ch.senderId = s.id')
      .innerJoinAndSelect(User, 'r', '(ch.receiverId = r.id AND ch.deletedForReceiver IS NULL)')
      .select([
        `COUNT(ch.id) AS count`,
        'ch.isAnswered AS is_answered',
        's.id AS user_id',
        's.role AS role',
        's.firstName AS first_name',
        's.lastName AS last_name',
        's.imageUrl AS image_url',
        'MAX(ch.createdAt) AS received_at'
      ])
      .addSelect([
        `CASE 
          WHEN s.role = 'nurse' THEN 1
          ELSE 0
        END is_nurse`
      ])
      .withDeleted()
      .where(`ch.receiverId = ${user_id} AND ch.deletedAt IS NULL AND ch.isMissed = ${YesNo.YES}`)
      .groupBy("s.id, ch.isAnswered, date_trunc('day', ch.createdAt)")
      .orderBy('received_at', 'DESC')
      .getRawMany();

    const receiverHistoryResult = receiverHistory.map((o) => {
      return {
        ...o,
        received_at: isToday(o.received_at)
          ? `${req.t('backend:misc.today')} ${moment(o.received_at).format(timeFormat)}`
          : isYesterday(o.received_at)
          ? `${req.t('backend:misc.yesterday')} ${moment(o.received_at).format(timeFormat)}`
          : moment(o.received_at).format(dateFormat)
      };
    });

    return res.mobDeliver(receiverHistoryResult, req.t('backend:success.missed_calls'));
  } catch (error) {
    next(error);
  }
};

export const updateAppVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { version_no, build_number, device_token, platform } = req.body;

    const applicationVersion = await getRepository(ApplicationVersions).findOne({
      where: {
        versionNo: version_no,
        buildNumber: build_number,
        deviceToken: device_token,
        platform: platform
      }
    });

    if (applicationVersion) {
      throw { message: req.t('backend:error.app_version_info_exists'), code: HttpStatus.BAD_REQUEST };
    } else {
      const applicationVersion = getRepository(ApplicationVersions).create({
        versionNo: version_no,
        buildNumber: build_number,
        deviceToken: device_token,
        platform: platform
      });

      await getRepository(ApplicationVersions).save(applicationVersion);

      return res.mobDeliver({}, req.t('backend:success.new_app_version_saved'));
    }
  } catch (error) {
    next(error);
  }
};

export const latestAppVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.body;

    const latest_version = await getRepository(ApplicationVersions)
      .createQueryBuilder('av')
      .select([
        'av.versionNo AS version_no',
        `COALESCE(av.buildNumber, '') AS build_number`,
        'av.deviceToken AS device_token'
      ])
      .where(`platform = '${platform}'`)
      .orderBy('id', 'DESC')
      .getRawOne();

    return res.mobDeliver(latest_version, req.t('backend:success.latest_version'));
  } catch (error) {
    next(error);
  }
};

/* TODO: Needs to be removed */
export const notificationFirebaseCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const statusID = req.body.id;
    const accessToken = await getRepository(AccessTokens).findOne({
      where: {
        userId: statusID,
        isRevoked: YesNo.NO
      }
    });

    if (!accessToken) throw { message: req.t('backend:error.something_went_wrong'), code: 412 };

    firebase.sendNotification(accessToken.deviceToken, {
      notification: {
        title: `Video pois päältä`
      },
      data: {
        call_to: `nurse`,
        room_id: `randomRoomId`,
        sender_id: `sender_id`,
        sender_socket_id: `socket.id`,
        signal_data: JSON.stringify('signal_data'),
        db_room: `room.id`
      }
    });

    return res.mobDeliver({}, req.t('backend:success.new_app_version_saved'));
  } catch (error) {
    next(error);
  }
};
