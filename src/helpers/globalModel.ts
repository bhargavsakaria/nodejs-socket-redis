import { getRepository } from 'typeorm';
import { HttpStatus } from '../typings/global/http-status.enum';
import Group from '../entities/Group.postgres';
import { FindGroup } from '../utils/interfaces';

export const getGroup = async (search: FindGroup) => {
  const group = await getRepository(Group).findOne({
    where: { ...search }
  });

  if (!group) {
    throw { message: 'backend:error.group_not_found', code: HttpStatus.NOT_FOUND };
  }
  return group;
};
