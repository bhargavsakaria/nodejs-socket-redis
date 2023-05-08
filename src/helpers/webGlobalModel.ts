import { FindUser } from '../utils/interfaces';
import User from '../entities/User.postgres';
import { IsNull } from 'typeorm';
import { NotFoundError } from './apiError';

export const getUser = async (userData: FindUser) => {
  const user = await User.findOne({
    where: {
      ...userData,
      deletedAt: IsNull()
    }
  });

  if (!user) {
    throw new NotFoundError();
  }
  return user;
};
