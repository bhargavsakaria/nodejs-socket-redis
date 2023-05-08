import { NextFunction, Request, Response } from 'express';
import User from '../../entities/User.postgres';
import SupportStaffs from '../../entities/SupportStaffs.postgres';
import { Role } from '../../utils/constants';
import { HttpStatus } from '../../typings/global/http-status.enum';
import { getCustomRepository, getRepository } from 'typeorm';
import { UserRepository } from '../../repositories/user.repository';

export const getAssociatedUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { take, skip } = req.body;

    // @ts-ignore
    const user = await getCustomRepository(UserRepository).getUser({ id: req.user.id });

    if (user.role === Role.MEMBER || user.role === Role.SENIOR) {
      const userGroup = await getRepository(User)
        .createQueryBuilder('u')
        .innerJoinAndSelect('u.group', 'group')
        .where(`u.id = ${user.id}`)
        .getOne();

      if (userGroup) {
        let andWhere = userGroup.isSenior ? `u.id != ${userGroup.id}` : `u.isSenior = true`;

        let people = getRepository(User)
          .createQueryBuilder('u')
          .where(`u.groupId = ${userGroup.group.id} AND ${andWhere}`)
          .select([
            '0 AS is_nurse', // NOTE | needed for handling with static support_staff buttons on mobile
            'u.id as user_id',
            'u.username AS username',
            'u.email AS email',
            'u.firstName AS first_name',
            'u.lastName AS last_name',
            `COALESCE(u.imageUrl, '') AS image_url`,
            'u.isSenior AS is_senior',
            'u.role AS role',
            `COALESCE(u.homeCity, '') AS home_city`
          ])
          .orderBy('u.firstName', 'ASC')
          .addOrderBy('u.lastName', 'ASC');

        const count = await people.getCount();

        const result = await people.limit(take).offset(skip).getRawMany();

        return res.mobDeliver({ result, count }, req.t('backend:success.found_people'));
      } else {
        throw { message: req.t('backend:error.user_in_no_group'), code: HttpStatus.NOT_FOUND };
      }
    } else if (user.role === Role.NURSE) {
      const nurse = await getRepository(SupportStaffs)
        .createQueryBuilder('ss')
        .innerJoinAndSelect('ss.user', 'ssu')
        .leftJoinAndSelect('ss.seniors', 'su')
        .select(['ss.isNurse', 'su.seniorId'])
        .where(`ssu.id = ${user.id}`)
        .getOne();

      const seniorIds = nurse?.seniors.map((element) => {
        return element.seniorId;
      });

      if (seniorIds && seniorIds.length > 0) {
        const people = getRepository(User)
          .createQueryBuilder('u')
          .select([
            'u.id AS user_id',
            'u.username AS username',
            'u.email AS email',
            'u.firstName AS first_name',
            'u.lastName AS last_name',
            `COALESCE(u.imageUrl, '') AS image_url`,
            'u.isSenior AS is_senior',
            'u.role AS role',
            `COALESCE(u.homeCity, '') AS home_city`
          ])
          .where(`u.id IN (:...ids)`, { ids: seniorIds })
          .orderBy('u.firstName', 'ASC')
          .addOrderBy('u.lastName', 'ASC');

        const count = await people.getCount();

        const result = await people.limit(take).offset(skip).getRawMany();

        return res.mobDeliver({ result, count }, req.t('backend:success.found_people'));
      } else {
        throw { message: req.t('backend:error.staff_not_assigned'), code: HttpStatus.NOT_FOUND };
      }
    } else if (user.role === Role.IT) {
      const people = getRepository(User)
        .createQueryBuilder('u')
        .select([
          'u.id AS user_id',
          'u.username AS username',
          'u.email AS email',
          'u.firstName AS first_name',
          'u.lastName AS last_name',
          `COALESCE(u.imageUrl, '') AS image_url`,
          'u.isSenior AS is_senior',
          'u.role AS role',
          `COALESCE(u.homeCity, '') AS home_city`
        ])
        .where(`u.isSenior = true`)
        .orderBy('u.firstName', 'ASC')
        .addOrderBy('u.lastName', 'ASC');

      const count = await people.getCount();

      const result = await people.limit(take).offset(skip).getRawMany();

      return res.mobDeliver({ result, count }, req.t('backend:success.found_people'));
    }
  } catch (error: any) {
    next(error);
  }
};
