import { NextFunction, Request, Response } from 'express';
import User from '../entities/User.postgres';
import { getManager, getRepository, In } from 'typeorm';
import AccessTokens from '../entities/AccessTokens.postgres';
import { Role, YesNo } from '../utils/constants';
import { getGroup } from '../helpers/globalModel';
import SupportStaffs from '../entities/SupportStaffs.postgres';
import { HttpStatus } from '../typings/global/http-status.enum';
import { find } from 'lodash';
import Group from '../entities/Group.postgres';

export const add_admin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connection = getManager().connection;

    // Default group
    const group = await connection.query(`SELECT * from "group" WHERE name = 'CreoleAdmin'`);
    if (!group.length) {
      await connection.query(`INSERT INTO "group" (name) VALUES ('CreoleAdmin')`);
    }
    const [grp] = await connection.query(`SELECT * from "group" WHERE name = 'CreoleAdmin'`);
    await connection.query(
      `INSERT INTO public."user" ("username", "email", "password", "firstName", "lastName", "mobileNumber", "role", "isSenior", "isAdmin", "groupId" ) VALUES ('abhijitez_admin', 'abhijityt@yopmail.com','$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C','Abhijit','ET','9999999999','customer',false,true,${grp.id})`
    );

    return res.mobDeliver({ grp }, req.t('backend:success.success'));
  } catch (error) {
    return next(error);
  }
};

export const default_users = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connection = getManager().connection;

    // Default group
    const group = await connection.query(`SELECT * from "group" WHERE name = 'Creole'`);
    if (!group.length) {
      await connection.query(`INSERT INTO "group" (name) VALUES ('Creole')`);
    }
    const [grp] = await connection.query(`SELECT * from "group" WHERE name = 'Creole'`);
    await connection.query(
      `INSERT INTO public."user" ("username", "email", "password", "firstName", "lastName", "mobileNumber", "role", "isSenior", "isAdmin", "groupId" ) VALUES ('jim_senior', 'jimsenior@yopmail.com','$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C','Jim','Senior','9999999999','senior',true,false,${grp.id})`
    );

    return res.mobDeliver({ grp }, req.t('backend:success.success'));
  } catch (error) {
    return next(error);
  }
};

export const default_relatives = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await getGroup({ name: 'Creole' });

    const connection = getManager().connection;

    await connection.query(`
      INSERT INTO public."user" ("username", "email", "password", "firstName", "lastName", "mobileNumber", "role", "isSenior", "isAdmin", "groupId") VALUES
      ('sam_relative_one', 'samrelativeone@yopmail.com','$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C','Sam','RelativeOne','9999999999','relative',false,false,${group.id}),
      ('darius_relative_two', 'dariusrelativetwo@yopmail.com','$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C','Darius','RelativeTwo','9999999999','relative',false,false,${group.id});
    `);
    return res.mobDeliver({ group }, req.t('backend:success.success'));
  } catch (error) {
    return next(error);
  }
};

export const newSeniorAndRelatives = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users: User[] = req.body.users;
    const group = req.body.group;

    const foundGroup = await getRepository(Group).findOne({ where: { name: group } });

    if (foundGroup) {
      throw { message: `${group} Group already exists!!!`, code: HttpStatus.BAD_REQUEST };
    }

    const newSenior = find(users, (user) => {
      return user.isSenior && user.role === Role.SENIOR ? user : null;
    });

    if (!newSenior) {
      throw { message: 'There should be one senior user in array!', code: HttpStatus.BAD_REQUEST };
    }

    // @ts-ignore
    const foundSenior = await getRepository(User).findOne({ where: { email: newSenior.email } });
    if (!foundSenior) {
      const connection = getManager().connection;

      await connection.query(`
      INSERT INTO "group" ("name") VALUES ('${group}')
      `);

      const newGroup = await getGroup({ name: group });

      for (let i = 0; i < users.length; i++) {
        await connection.query(`
        INSERT INTO "user" ("username", "email", "password", "firstName", "lastName", "mobileNumber", "role", "isSenior", "isAdmin", "groupId") VALUES
        ('${users[i].username}', '${users[i].email}', '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C', '${users[i].firstName}', '${users[i].lastName}', '9999999999', '${users[i].role}', '${users[i].isSenior}', false, ${newGroup.id})
      `);
      }
    }

    const newUsers = await getRepository(User).find({
      where: { email: In(users.map((u) => u.email)) }
    });

    return res.mobDeliver(newUsers, 'success');
  } catch (error) {
    console.log(error);

    next(error);
  }
};

export const default_support_users = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connection = getManager().connection;

    // new support staff users
    await connection.query(`
        INSERT INTO public."user" ("username", "email", "password", "firstName", "lastName", "mobileNumber", "role", "isSenior", "isAdmin") VALUES
        ('nurse_one', 'nurseonedh@yopmail.com', '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C', 'Nurse', 'One', '9999999999', 'nurse', false, false),
        ('nurse_two', 'nursetwodh@yopmail.com', '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C', 'Nurse', 'Two', '9999999999', 'nurse', false, false),
        ('it_support_one', 'itsupportonedh@yopmail.com', '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C', 'IT', 'Two', '9999999999', 'it_support', false, false),
        ('it_support_two', 'itsupporttwodh@yopmail.com', '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C', 'IT', 'Two', '9999999999', 'it_support', false, false);
    `);

    const nurseUsers = await getRepository(User).find({
      where: { role: 'nurse' }
    });

    // adds 2 nurse users into support_staffs
    if (nurseUsers.length > 0) {
      for (let index = 0; index < nurseUsers.length; index++) {
        await connection.query(`
          INSERT INTO public."support_staffs" ("isNurse", "userId") VALUES
          (1, ${nurseUsers[index].id})
        `);
      }
    }

    const itSupportUsers = await getRepository(User).find({
      where: { role: 'it_support' }
    });

    // add 2 it_support users into support_staffs
    if (itSupportUsers.length > 0) {
      for (let index = 0; index < itSupportUsers.length; index++) {
        await connection.query(`
          INSERT INTO public."support_staffs" ("isNurse", "userId") VALUES
          (2, ${itSupportUsers[index].id})
        `);
      }
    }

    const supportStaffs = await getRepository(SupportStaffs).find({ where: { isNurse: YesNo.YES } });

    const seniorUserJim = await getRepository(User).findOne({ where: { email: 'jimsenior@yopmail.com' } });

    // adds all support_staffs to assigned_staff_memebers with senior user (id: 1) relation
    if (supportStaffs.length > 0 && seniorUserJim) {
      for (let index = 0; index < supportStaffs.length; index++) {
        await connection.query(`
          INSERT INTO public."assigned_senior_staffs" ("supportStaffId", "seniorId") VALUES
          (${supportStaffs[index].id}, ${seniorUserJim.id})
        `);
      }
    }
    return res.mobDeliver('Support Staffs added', req.t('backend:success.success'));
  } catch (error) {
    return next(error);
  }
};

export const add_staff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstname, lastname, is_nurse } = req.body;
    const connection = getManager().connection;

    const [usrext] = await connection.query(`SELECT * from "user" WHERE email = '${email}'`);
    console.log(usrext, 'usrext');
    if (usrext) {
      throw { message: req.t('backend:error.user_exists'), code: HttpStatus.BAD_REQUEST };
    }

    const new_staff_user = await getRepository(User).save({
      username: email,
      email,
      password: '$2b$10$BDfvGr1d6x73yNj3odgzJOOFUHhYabfdXzc3ekAeF2hrc6cAr0/5C',
      firstName: firstname,
      lastName: lastname,
      mobileNumber: '9999999999',
      role: is_nurse ? Role.NURSE : Role.IT,
      isSenior: false,
      isAdmin: false
    });

    const new_support_staff = await getRepository(SupportStaffs).save({
      isNurse: is_nurse ? 1 : 0,
      user: new_staff_user
    });

    new_staff_user.supportStaff = new_support_staff;
    await getRepository(User).save(new_staff_user);

    res.mobDeliver('', req.t('backend:success.success'));
  } catch (error) {
    next(error);
  }
};

export const assign_nurse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { senior_id, staff_id } = req.body;
    const connection = getManager().connection;

    const [staff] = await connection.query(`
    SELECT * from "support_staffs" WHERE "userId" = ${staff_id}
    `);

    await connection.query(`
    INSERT INTO public."assigned_senior_staffs" ("supportStaffId", "seniorId") VALUES
    (${staff?.id}, ${senior_id})
  `);

    res.mobDeliver('', req.t('backend:success.success'));
  } catch (error) {
    next(error);
  }
};

export const revoke_all_tokens = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessTokens = await getRepository(AccessTokens).find({ where: { isRevoked: YesNo.NO } });

    accessTokens.forEach(async (element) => {
      element.isRevoked = YesNo.YES;
      await getRepository(AccessTokens).save(element);
    });

    res.mobDeliver('', req.t('backend:success.revoked_tokens'));
  } catch (error) {
    next(error);
  }
};

export const database_access_log = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql } = req.body;
    const connection = getManager().connection;
    const result = await connection.query(sql);

    res.mobDeliver(result);
  } catch (error) {
    return next(error);
  }
};

export const add_notification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staff_id, message } = req.body;

    const conneciton = getManager().connection;

    await conneciton.query(`
      INSERT INTO "notifications" ("staffId", "message") VALUES
      (${staff_id}, '${message}')
    `);

    return res.mobDeliver({}, req.t('backend:success.success'));
  } catch (error) {
    next(error);
  }
};

export const addCallHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sender_id, receiver_id, is_answered } = req.body;

    const connection = getManager().connection;

    await connection.query(`
    INSERT INTO "call_history" ("senderId", "receiverId", "isAnswered") VALUES
    (${sender_id}, ${receiver_id}, '${is_answered}')
    `);

    res.mobDeliver({}, req.t('backend:success.success'));
  } catch (error) {
    next(error);
  }
};
