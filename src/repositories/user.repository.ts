import User from '../entities/User.postgres';
import { EntityRepository, Repository } from 'typeorm';
import { FindUser } from '../utils/interfaces';
import { HttpStatus } from '../typings/global/http-status.enum';
import { YesNo } from '../utils/constants';

@EntityRepository(User)
export class UserRepository extends Repository<User> {
  public async getUser(userData: FindUser) {
    const user = await this.findOne({
      where: {
        ...userData
      }
    });

    if (!user) {
      throw { message: 'backend:error.user_not_found', code: HttpStatus.NOT_FOUND };
    }
    return user;
  }

  public async getUserByEmailOrUsername(email_or_username: string) {
    const user = await this.findOne({ where: [{ email: email_or_username }, { username: email_or_username }] });

    if (!user) {
      throw { message: 'backend:error.user_not_found', code: HttpStatus.NOT_FOUND };
    }
    return user;
  }

  public async getCorrectRole(user_id: number) {
    const user = await this.getUser({ id: user_id });
    return user.isSenior ? 'senior' : user.role === 'customer' ? 'member' : user.role;
  }

  public async getSocketId(user_id: number) {
    const user = await this.findOne(user_id);

    if (!user) {
      throw { message: 'backend:error.user_not_found', code: HttpStatus.NOT_FOUND };
    }
    return user.socketId;
  }

  public async getSeniorAssignedSupportStaff(senior_id: number) {
    return await this.createQueryBuilder('u')
      .leftJoinAndSelect('u.assignedStaffMembers', 'asm')
      .where(`u.isSenior = true AND u.id = ${senior_id}`)
      .getOne();
  }

  public getSeniorAssignedSupportStaffIds(assignedStaffs: User) {
    let assignedStaffMemberIds = assignedStaffs.assignedStaffMembers.map((element) => {
      return element.supportStaffId;
    });

    return assignedStaffMemberIds;
  }

  public async getAssignedNurses(senior_id: number) {
    let assignedStaffs = await this.getSeniorAssignedSupportStaff(senior_id);

    if (!assignedStaffs) {
      return [];
    }

    let assignedStaffMemberIds = this.getSeniorAssignedSupportStaffIds(assignedStaffs);

    let nurses = await this.createQueryBuilder('u')
      .leftJoinAndSelect('u.supportStaff', 'ss')
      .where(`ss.isNurse = ${YesNo.YES} AND u.id != ${senior_id} AND ss.id IN (${assignedStaffMemberIds})`)
      .select(['u.id AS id, u.socketId'])
      .getRawMany();

    return nurses;
  }
}
