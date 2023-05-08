import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from '../helpers/apiError';
import { getRepository, In, IsNull, Not, Raw } from 'typeorm';
import User from '../entities/User.postgres';
import Group from '../entities/Group.postgres';
import Order from '../entities/Order.postgres';
import Coupon from '../entities/Coupons.postgres';
import { makeID, POSTI_PASSWORD, posti_uri, POSTI_USERNAME, server_uri, stripe } from '../utils/secrets';
import Service from '../entities/Service.postgres';
import SupportStaffs from '../entities/SupportStaffs.postgres';
import StaffInvite from '../entities/StaffInvite.postgres';
import { createShipment } from './webhook';
import { transporter } from './email';
import AssignedSeniorStaffs from '../entities/AssignedSeniorStaffs.postgres';
import { Role, YesNo } from '../utils/constants';
import Notifications from '../entities/Notifications.postgres';

const SibApiV3Sdk = require('sib-api-v3-sdk');
let request = require('request');

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { info, username, email, password, firstName, lastName, role } = req.body;
    const exists = await User.findOne({
      where: { username: username }
    });

    if (exists) {
      return next(new ConflictError(`Username ${username} already exists`));
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    const newUser = getRepository(User).create({
      ...info,
      username: username,
      email: email,
      password: hashedPassword,
      firstName: firstName,
      lastName: lastName,
      role: role,
      isAdmin: false
    });

    await getRepository(User).save(newUser);

    res.deliver(201, 'Registered successfully');
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const update = req.body;
    let cur_user = req.user as User;

    if (!cur_user) {
      console.log('No current user');
      return next(new NotFoundError());
    }

    let user;
    if (cur_user.id === update.id) {
      user = cur_user;
    } else {
      if (cur_user.isAdmin && !cur_user.readOnly) {
        user = (await User.findOne(update.id)) as User;
      } else {
        console.log('Current user is not admin');
        return next(new ForbiddenError());
      }
    }

    if (update.username) {
      user.username = update.username;
    }
    if (update.email) {
      user.email = update.email;
    }
    if (update.firstName) {
      user.firstName = update.firstName;
    }
    if (update.lastName) {
      user.lastName = update.lastName;
    }
    if (update.mobileNumber) {
      user.mobileNumber = update.mobileNumber;
    }
    if (update.skypeEmail) {
      user.skypeEmail = update.skypeEmail;
    }
    if (update.nursingHome) {
      user.nursingHome = update.nursingHome;
    }
    if (update.department) {
      user.department = update.department;
    }
    if (update.homeAddress) {
      user.homeAddress = update.homeAddress;
    }
    if (typeof update.isSenior === 'boolean') {
      user.isSenior = update.isSenior;
    }
    if (update.image) {
      user.image = update.image;
    }
    if (update.group) {
      user.group = update.group;
    }

    if (update.password?.length) {
      if (update.password.length >= 11) {
        user.password = await bcrypt.hash(update.password, 8);
      } else {
        return next(new BadRequestError('Password too short'));
      }
    }

    if (cur_user.isAdmin && !cur_user.readOnly && update.role?.length && cur_user.id !== user.id) {
      user.role = update.role;
    }

    if (cur_user.isAdmin && !cur_user.readOnly && typeof update.isAdmin === 'boolean' && cur_user.id !== user.id) {
      user.isAdmin = update.isAdmin;
    }

    console.log(user.id);
    await User.save(user);

    res.deliver(200, 'Updated user', user);
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// Admin can delete user
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const exists = await User.findOne({
      where: { id: userId }
    });

    console.log('userId', userId);
    console.log('exists', exists);

    if (!exists || exists.id !== userId) {
      return next(new NotFoundError('User not found'));
    }

    await exists.remove();
    res.deliver(200, 'Removed user');
  } catch (error) {
    next(new InternalServerError());
  }
};

// Admin can get all users
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find({ relations: ['group'] });
    res.deliver(200, 'Successfully got users', users);
  } catch (error) {
    next(new NotFoundError('Users not found'));
  }
};

export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = req.body;
    const user = req.user as User;

    if (!user) {
      return next(new NotFoundError(`User ${user} not found`));
    }

    const newGroup = User.create({
      ...user,
      group: group
    });

    const savedGroup = await User.save(newGroup);
    res.deliver(201, 'Successfully created group', savedGroup);
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const addGroupMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = req.body;
    const user = req.user as User;

    const group = await Group.findOne(user.group.id);

    if (!group) {
      return next(new NotFoundError(`Group ${group} not found`));
    }

    const members = await User.find({ where: { group: { id: user.group.id }, role: member.role } });
    console.log('MEMBERS COUNT', members.length);

    if (members.length >= 5 && member.role === 'member') {
      return next(new BadRequestError(`Limit of members exceeded`));
    }

    let existed_member = await User.findOne({
      where: { group: { id: user.group.id }, email: member.email },
      relations: ['group']
    });
    console.log('EXISTED MEMBER', existed_member);

    if (existed_member && member.role !== existed_member.role) {
      return next(
        new ConflictError(`User exists. Roles does not match. Existed: ${existed_member.role}. New: ${member.role}.`)
      );
    }

    if (existed_member && member.role === 'member') {
      return next(new ConflictError(`Member ${member.email} already exists`));
    }

    let password;
    if (member.role === 'member') {
      password = require('crypto').randomBytes(36).toString('base64').slice(-12);
    } else if (member.role === 'senior') {
      password = member.password;
    }
    console.log(password);
    const hashedPassword = await bcrypt.hash(password, 8);

    console.log(hashedPassword);

    let newMember;
    if (existed_member && member.role === 'senior') {
      newMember = User.create({
        ...(member as User),
        password: hashedPassword,
        // @ts-ignore
        id: existed_member.id,
        group: { id: user.group.id }
      });
    } else {
      newMember = User.create({
        ...(member as User),
        password: hashedPassword,
        group: { id: user.group.id }
      });
    }
    console.log('NEW MEMBER', newMember);

    const updatedMember = await User.save(newMember);
    console.log('UPDATED MEMBER', updatedMember);
    group.members.push(updatedMember);

    const updatedGroup = await Group.save(group);

    if (newMember.role === 'member') {
      const key = process.env.SIB_API_KEY;

      // authentication
      const defaultClient = SibApiV3Sdk.ApiClient.instance;
      let apiKey = defaultClient.authentications['api-key'];
      apiKey.apiKey = key;

      //create content
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); // SendSmtpEmail | Values to send a transactional email
      console.log('TEMPLATE ID: ', process.env.SENDINBLUE_TEMPLATE_ID_RELATIVE_CREATE);
      sendSmtpEmail = {
        sender: {
          name: 'Digihappy',
          email: 'digihappy@mediti.fi'
        },
        to: [
          {
            email: newMember.email,
            name: `${newMember.firstName} ${newMember.lastName}`
          }
        ],
        // @ts-ignore
        templateId: parseInt(process.env.SENDINBLUE_TEMPLATE_ID_RELATIVE_CREATE),
        params: {
          password: password,
          link: server_uri
        }
      };

      // call SIB api
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('API called successfully. Returned data: ' + data);
    }

    res.deliver(200, 'New group member', updatedGroup);
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.id);
    const exists = await Group.findOne({
      where: { id: groupId }
    });

    if (!exists || exists.id !== groupId) {
      return next(new NotFoundError('Group not found'));
    }

    await exists.remove();
    res.deliver(200, 'Removed group');
  } catch (error) {
    next(new InternalServerError());
  }
};

// Order controllers
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = req.body;
    console.log('BODY', order);
    let user = req.user as User;

    console.log('order:::::', order.order);
    console.log('order.services:::::', order.order.services);

    if (!user) {
      return next(new NotFoundError(`User ${user} not found`));
    }

    const coupon_code = order.order.coupon;
    const coupon = await Coupon.findOne({
      // @ts-ignore
      where: { code: coupon_code }
    });
    if (!!coupon_code && !coupon) {
      return next(new NotFoundError(`Coupon ${order.order.coupon} not found`));
    }

    // Check shipping price
    if (order.order.price > 200) {
      order.order.shippingPrice = 16.9;
    } else {
      order.order.shippingPrice = 16.9;
    }

    // @ts-ignore: Unreachable code error
    let newOrder: Order = Order.create({ ...order.order, user: user });
    let newOrder2 = {
      ...newOrder,
      services: order.order.services
    };
    // @ts-ignore
    const savedOrder = await Order.save(newOrder2);
    console.log('SAVED', savedOrder);

    // @ts-ignore
    const order_id = savedOrder.id;
    let customer_id: string | undefined = user.customerId;

    // @ts-ignore
    const pm = savedOrder.paymentMethod;
    if (pm === 'card') {
      let items_reccuring: { price: string; quantity: number }[] = [];
      let items_one_payment: { price: string; quantity: number }[] = [];

      let order_type = 'one_time';

      // @ts-ignore
      for (const service of order.order.services) {
        if (service.stripeProductId) {
          if (service.priceType === 'recurring') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            order_type = 'recurring';
            items_reccuring.push({
              price: service.stripeProductId,
              quantity: 1
            });
          } else {
            items_one_payment.push({
              price: service.stripeProductId,
              quantity: 1
            });
          }
        }
      }

      // Update customer if exists
      let customer = null;
      const stripePaymentMethod = order.order.stripePaymentMethod;
      if (customer_id) {
        try {
          customer = await stripe.customers.retrieve(customer_id);
          const resp = await stripe.paymentMethods.attach(stripePaymentMethod, { customer: customer.id });
          console.log('ATTACH: ', resp);
        } catch {
          customer_id = undefined;
        }
      }
      if (!customer_id) {
        // .. or create a new one
        customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          payment_method: stripePaymentMethod,
          preferred_locales: ['fi-FI']
        });
      }
      // @ts-ignore
      await User.update(user.id, { customerId: customer?.id });

      const shippingMethod = await Service.findOne({
        // @ts-ignore
        where: { category: 'shipping', shippingCategory: newOrder2.shippingMethod }
      });
      if (shippingMethod) {
        items_one_payment.push({
          // @ts-ignore
          price: coupon?.data?.free_shipping
            ? shippingMethod.stripeShippingRateIdFree
            : shippingMethod.stripeShippingRateId,
          quantity: 1
        });
      }

      console.log('ITEMS: ', items_one_payment, items_reccuring);
      if (items_one_payment.length > 0) {
        let invoice_items = [];
        for (const item of items_one_payment) {
          const invoiceItem = await stripe.invoiceItems.create({
            customer: customer?.id,
            price: item.price,
            quantity: item.quantity
          });
          invoice_items.push(invoiceItem);
        }
      }
      let subscription;
      let invoice_id;
      if (items_reccuring.length > 0) {
        subscription = await stripe.subscriptions.create({
          customer: customer?.id,
          default_payment_method: stripePaymentMethod,
          items: items_reccuring,
          // @ts-ignore
          trial_period_days: coupon?.data?.period || 0
        });
        invoice_id = subscription.latest_invoice;
      } else {
        let invoice = await stripe.invoices.create({
          customer: customer?.id,
          collection_method: 'charge_automatically',
          default_payment_method: stripePaymentMethod
        });
        invoice_id = invoice.id;
        await stripe.invoices.pay(invoice_id);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let savedOrder = await Order.update(newOrder2.id, {
        subscriptionId: subscription?.id,
        invoiceId: invoice_id
      });

      const invoice = await stripe.invoices.retrieve(invoice_id);
      let payment_intent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
      console.log(payment_intent);
      if (payment_intent.status === 'requires_action') {
        payment_intent = await stripe.paymentIntents.confirm(payment_intent.id, {
          return_url: server_uri + '/user/orders?order_id=' + newOrder2.id
        });
      }

      if (newOrder2.shippingMethod === 'posti') {
        createShipment(newOrder2);
      }
      res.deliver(201, 'Successfully created order', {
        payment_type: 'card',
        invoice: invoice,
        payment_intent: payment_intent,
        order_id: newOrder2.id
      });
    } else if (pm === 'email_billing') {
      // authentication
      console.log('EMAIL TO: ', user.email);
      const key = process.env.SIB_API_KEY;
      const defaultClient = SibApiV3Sdk.ApiClient.instance;
      let apiKey = defaultClient.authentications['api-key'];
      apiKey.apiKey = key;
      let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      let sendSmtpEmail = {
        sender: {
          name: 'Digihappy',
          email: 'digihappy@mediti.fi'
        },
        to: [
          {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email
          }
        ],
        // @ts-ignore
        templateId: parseInt(process.env.SENDINBLUE_TEMPLATE_ID_INVOICE)
      };
      apiInstance.sendTransacEmail(sendSmtpEmail).then(
        function () {
          console.log('API called successfully.');
        },
        function (error: any) {
          console.error(error);
        }
      );

      if (newOrder2.shippingMethod === 'posti') {
        createShipment(newOrder2);
      }
      res.deliver(201, 'Successfully created order', {
        payment_type: 'email_billing',
        order_id: order_id
      });
    } else {
      next(new BadRequestError('Invalid payment method'));
    }
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error));
  }
};

export const pointsByZip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let data = `${POSTI_USERNAME}:${POSTI_PASSWORD}`;
    let token = Buffer.from(data).toString('base64');
    const url = `${posti_uri}/addresses/agents?&type=POSTI&country=FI&zip=${req.query.zipCode}`;
    let options = {
      method: 'GET',
      url: url,
      headers: {
        Authorization: `Basic ${token}`
      }
    };
    request(options, function (error: any, response: any) {
      if (error) throw new Error(error);
      res.deliver(200, 'Successfully get points', JSON.parse(response.body));
    });
  } catch (error) {
    console.log(error);
    next(new InternalServerError());
  }
};

// TODO: Admin can updateOrder
export const updateOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const update = req.body;
    const user = req.user as User;
    const orderId = req.body.id;
    console.log('orderId', orderId);

    const order = await Order.findOne(orderId);

    if (!order || order.user.id !== user.id) {
      return next(new NotFoundError('Order is not found'));
    }

    const updatedOrder = await Order.update(order.id, update);
    res.deliver(200, 'Updated order', updatedOrder);
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// TODO: Admin can delete orders
export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.id);
    const user = req.user as User;
    const order = await Order.findOne(orderId);

    if (!order || order.user.id !== user.id) {
      return next(new NotFoundError('Order is not found'));
    }

    await order.remove();
    res.deliver(200, 'Removed order');
  } catch (error) {
    next(new InternalServerError());
  }
};

// Admin can get all orders
export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await Order.find({ relations: ['user'] });
    res.deliver(200, 'Successfully got orders', orders);
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// Admin to on-board staff
export const staffRequestInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, username, isNurse } = req.body;
    const findUser = await getRepository(User).findOne({
      where: {
        email: Raw((alias) => `${alias} ILIKE '%${email}%'`)
      }
    });

    if (findUser) {
      return next(new ConflictError('User email already exists in the system, try different email.'));
    }

    const findStaff = await getRepository(StaffInvite).findOne({
      where: {
        email: Raw((alias) => `${alias} ILIKE '%${email}%'`)
      }
    });

    if (findStaff) {
      findStaff.deletedAt = new Date();
      // @ts-ignore
      await getRepository(User).save(findStaff);
    }

    const token = makeID(20);

    const newStaff = getRepository(StaffInvite).create({
      firstName,
      lastName,
      email,
      username,
      isNurse,
      token
    });

    const emailTemplate = staffInviteTemplate(
      { firstName, email },
      getStaffInviteURL(isNurse ? 'nurse' : 'it_support', token)
    );
    const sendEmail = () => {
      transporter.sendMail(emailTemplate, (err, info) => {
        if (err) {
          return next(new InternalServerError('Error while sending the email'));
        }
        console.log('Email sent', info.response);
      });
    };

    sendEmail();

    await getRepository(StaffInvite).save(newStaff);

    res.deliver(200, 'Successfully invited the staff', {});
  } catch (error) {
    next(new NotFoundError('Users not found'));
  }
};

export const addStaffInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, username, password, role, mobileNumber, token } = req.body;
    if (!role) {
      return next(new BadRequestError(`role should not be empty`));
    }
    if (!username) {
      return next(new BadRequestError(`username should not be empty`));
    }
    if (!token) {
      return next(new BadRequestError(`token should not be empty`));
    }
    if (!email) {
      return next(new BadRequestError(`email should not be empty`));
    }

    const existStaff = await getRepository(StaffInvite).findOne({
      where: {
        email: Raw((alias) => `${alias} ILIKE '%${email}%'`),
        token,
        deletedAt: IsNull()
      }
    });

    if (!existStaff) {
      return next(new BadRequestError(`Invalid token.`));
    }

    const userNameExists = await getRepository(User).findOne({
      where: { username: username }
    });

    if (userNameExists) {
      return next(new ConflictError(`Username ${username} already exists`));
    }

    const hashedPassword = await bcrypt.hash(password, 8);
    const newUser = getRepository(User).create({
      mobileNumber,
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      isSenior: false,
      isAdmin: false
    });

    const findStaff = await getRepository(StaffInvite).findOne({
      where: {
        email: Raw((alias) => `${alias} ILIKE '%${email}%'`)
      }
    });

    if (findStaff) {
      findStaff.deletedAt = new Date();
      // @ts-ignore
      await getRepository(StaffInvite).save(findStaff);
    }

    const newSupportStaff = getRepository(SupportStaffs).create({
      isNurse: role === 'nurse' ? 1 : 0,
      user: newUser
    });

    await getRepository(SupportStaffs).save(newSupportStaff);

    newUser.supportStaff = newSupportStaff;
    await getRepository(User).save(newUser);

    res.deliver(200, 'Successfully added the staff to system', {});
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const staffListing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.params;
    let staffs = [];
    const query = getRepository(SupportStaffs)
      .createQueryBuilder('ss')
      .innerJoinAndSelect('ss.user', 'ssu')
      .leftJoinAndSelect('ss.seniors', 'su')
      // .leftJoinAndSelect('ssu.supportStaff', 'sup')
      .select([
        'ss.isNurse',
        'su.seniorId',
        'ssu.firstName',
        'ssu.lastName',
        'ssu.email',
        'ssu.imageUrl',
        'ssu.id',
        'ssu.mobileNumber'
        // 'sup.id'
      ]);

    if (role === 'it_support') {
      staffs = await query.where(`ss.isNurse = 0 AND ssu.isAdmin = false`).getMany();
    } else {
      staffs = await query.where(`ss.isNurse = 1 AND ssu.isAdmin = false`).getMany();
    }

    res.deliver(200, '', { staffs });
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const staffInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const staffUser = await getRepository(User).findOne(id);
    if (staffUser && (staffUser.role === Role.IT || staffUser.role === Role.NURSE)) {
      const staff = await getRepository(SupportStaffs)
        .createQueryBuilder('ss')
        .innerJoinAndSelect('ss.user', 'ssu')
        .leftJoinAndSelect('ss.seniors', 'su')
        .where(`ssu.id = ${staffUser.id}`)
        .getOne();

      const seniorIds = staff?.seniors.map((element) => {
        return element.seniorId;
      });
      if (seniorIds && seniorIds.length > 0) {
        const seniors = await getRepository(User)
          .createQueryBuilder('u')
          .select([
            'u.id AS "id"',
            'u.firstName AS "firstName"',
            'u.lastName AS "lastName"',
            // 'u.email AS "email"',
            'u.mobileNumber AS "mobileNumber"',
            `COALESCE(u.homeCity, '') AS "homeCity"`,
            `COALESCE(u.imageUrl, '') AS "imageUrl"`
          ])
          .where(`u.id IN (:...ids)`, { ids: seniorIds })
          .getRawMany();

        res.deliver(200, '', {
          id: staff?.user.id,
          firstName: staff?.user.firstName,
          lastName: staff?.user.lastName,
          email: staff?.user.email,
          mobileNumber: staff?.user.mobileNumber,
          seniors
        });
      } else {
        res.deliver(200, '', {
          id: staff?.user.id,
          firstName: staff?.user.firstName,
          lastName: staff?.user.lastName,
          email: staff?.user.email,
          mobileNumber: staff?.user.mobileNumber
        });
      }
    } else {
      return next(new NotFoundError());
    }
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const assignedSeniorToStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = req.query.nurseId as unknown as number;

    const user = await getRepository(User).findOne({ id: nurseId });

    if (!user) {
      throw new NotFoundError('User not found');
    }

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

    const seniors = await getRepository(User)
      .createQueryBuilder('u')
      .select([
        'u.firstName AS "firstName"',
        'u.lastName AS "lastName"',
        'u.email AS "email"',
        'u.id AS "id"',
        `COALESCE(u.mobileNumber, '') AS "mobileNumber"`,
        `COALESCE(u.homeCity, '') AS "homeCity"`
      ])
      .where(`u.id IN (:...ids)`, { ids: seniorIds })
      .getRawMany();

    res.deliver(200, '', { seniors });
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const editNurseProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, firstName, lastName, email, username, mobileNumber } = req.body;

    const seniors: number[] = req.body.seniors;

    const nurse = await getRepository(User).findOne(id);

    if (!nurse) {
      return next(new NotFoundError());
    }

    if (nurse && nurse.role !== Role.NURSE) {
      return next(new ForbiddenError('User is not a nurse'));
    }

    if (nurse) {
      nurse.firstName = firstName;
      nurse.lastName = lastName;
      nurse.email = email;
      nurse.username = username;
      nurse.mobileNumber = mobileNumber;
      await getRepository(User).save(nurse);
    }

    const nurseStaff = await getRepository(SupportStaffs).findOne({
      where: {
        user: nurse
      },
      select: ['id']
    });

    if (nurseStaff) {
      if (seniors.length) {
        const seniorsToRemove = await getRepository(AssignedSeniorStaffs).find({
          where: { supportStaffId: nurseStaff.id, deletedAt: IsNull(), seniorId: Not(In(seniors.map((id) => id))) }
        });

        if (seniorsToRemove) {
          seniorsToRemove.forEach(async (assigned) => {
            await assigned.softRemove();
          });
        }

        seniors.forEach(async (seniorId) => {
          let seniorAssigned = await getRepository(AssignedSeniorStaffs).findOne({
            where: { supportStaffId: nurseStaff.id, seniorId: seniorId },
            withDeleted: true
          });
          if (!seniorAssigned) {
            const assignedStaff = getRepository(AssignedSeniorStaffs).create({
              seniorId,
              supportStaffId: nurseStaff.id
            });

            await getRepository(AssignedSeniorStaffs).save(assignedStaff);

            let senior = await getRepository(User).findOne(seniorId);
            if (senior) {
              const notificationToNurse = getRepository(Notifications).create({
                staffId: nurseStaff.id,
                name: `${senior.firstName} ${senior.lastName}`,
                message: `${senior.firstName} ${senior.lastName} is added to your profile.`
              });

              await getRepository(Notifications).save(notificationToNurse);
            }
          } else if (seniorAssigned.deletedAt !== null) {
            await seniorAssigned.recover();

            let senior = await getRepository(User).findOne(seniorId);
            if (senior) {
              const notificationToNurse = getRepository(Notifications).create({
                staffId: nurseStaff.id,
                name: `${senior.firstName} ${senior.lastName}`,
                message: `${senior.firstName} ${senior.lastName} is added to your profile.`
              });

              await getRepository(Notifications).save(notificationToNurse);
            }
          }
        });
      } else if (seniors.length === 0) {
        await getRepository(AssignedSeniorStaffs)
          .find({
            where: {
              supportStaffId: nurseStaff.id
            }
          })
          .then((assignedSeniors) => {
            assignedSeniors.forEach(async (assignedSenior) => {
              await assignedSenior.softRemove();
            });
          });
      }
    }

    res.deliver(200, `Successfully updated profile of nurse.`, {});
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getAllSeniors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seniors = await getRepository(User)
      .createQueryBuilder('u')
      .select([
        'u.firstName AS "firstName"',
        'u.lastName AS "lastName"',
        'u.email AS "email"',
        'u.updatedAt AS "updatedAt"',
        'u.id AS "id"',
        `COALESCE(u.mobileNumber, '') AS "mobileNumber"`,
        `COALESCE(u.homeCity, '') AS "homeCity"`,
        `COALESCE(u.imageUrl, '') AS "imageUrl"`
      ])
      .where(`u.isSenior = true`)
      .getRawMany();

    res.deliver(200, '', { seniors });
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const editMemberProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, firstName, lastName, email, username, mobileNumber } = req.body;

    const member = await getRepository(User).findOne(id);

    if (!member) {
      return next(new NotFoundError());
    }

    if (member && member.role !== Role.MEMBER) {
      return next(new ForbiddenError('User is not a member'));
    }

    if (member) {
      member.firstName = firstName;
      member.lastName = lastName;
      member.email = email;
      member.username = username;
      member.mobileNumber = mobileNumber;

      await getRepository(User).save(member);
    }
    res.deliver(200, `Successfully updated profile of relative.`, {});
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const editSeniorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      id,
      firstName,
      lastName,
      email,
      username,
      mobileNumber,
      homeAddress,
      // seniorHomeId,
      // homeId
      hasItSupport
    } = req.body;

    const nurses: number[] = req.body.nurses;

    const senior = await getRepository(User).findOne(id);

    if (!senior) {
      return next(new NotFoundError());
    }

    if (senior.role !== Role.SENIOR) {
      return next(new ForbiddenError('User is not a senior'));
    }

    if (senior) {
      senior.firstName = firstName;
      senior.lastName = lastName;
      senior.email = email;
      senior.username = username;
      senior.mobileNumber = mobileNumber;
      senior.homeAddress = homeAddress;
      senior.hasItSupport = hasItSupport === 0 ? false : true;

      await getRepository(User).save(senior);

      if (nurses.length) {
        let selectedNurseStaffIds: number[] = [];

        await getRepository(User)
          .find({ where: { id: In(nurses) }, relations: ['supportStaff'] })
          .then(async (nurses) => {
            nurses.forEach(async (nurse) => selectedNurseStaffIds.push(nurse.supportStaff.id));
          });

        if (selectedNurseStaffIds.length) {
          const nursesToRemove = await getRepository(AssignedSeniorStaffs).find({
            where: {
              seniorId: senior.id,
              deletedAt: IsNull(),
              supportStaffId: Raw((alias) => `${alias} NOT IN(${selectedNurseStaffIds})`)
            }
          });

          if (nursesToRemove) {
            nursesToRemove.forEach(async (assigned) => {
              await assigned.softRemove();
            });
          }

          nurses.forEach(async (nurseId) => {
            let nurse = await getRepository(User).findOne(nurseId, { relations: ['supportStaff'] });
            if (nurse) {
              let staffId: number = nurse.supportStaff.id as number;

              let nurseAssigned = await getRepository(AssignedSeniorStaffs).findOne({
                where: { seniorId: senior.id, supportStaffId: staffId },
                withDeleted: true
              });
              if (!nurseAssigned) {
                const assignedStaff = getRepository(AssignedSeniorStaffs).create({
                  seniorId: senior.id,
                  supportStaffId: staffId
                });

                await getRepository(AssignedSeniorStaffs).save(assignedStaff);

                const notificationToNurse = getRepository(Notifications).create({
                  staffId: staffId,
                  name: `${senior.firstName} ${senior.lastName}`,
                  message: `${senior.firstName} ${senior.lastName} is added to your profile.`
                });

                await getRepository(Notifications).save(notificationToNurse);
              } else if (nurseAssigned.deletedAt !== null) {
                await nurseAssigned.recover();

                const notificationToNurse = getRepository(Notifications).create({
                  staffId: staffId,
                  name: `${senior.firstName} ${senior.lastName}`,
                  message: `${senior.firstName} ${senior.lastName} is added to your profile.`
                });

                await getRepository(Notifications).save(notificationToNurse);
              }
            }
          });
        }
      } else if (nurses.length === 0) {
        await getRepository(AssignedSeniorStaffs)
          .find({
            where: {
              seniorId: senior.id
            }
          })
          .then((assignedNurses) => {
            assignedNurses.forEach(async (assignedNurse) => {
              await assignedNurse.softRemove();
            });
          });
      }
    }

    res.deliver(200, `Successfully updated profile of senior`, {});
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { take, skip } = req.body;
    const users = await getRepository(User)
      .createQueryBuilder('u')
      .select([
        'u.id AS id',
        'u.username AS username',
        'u.email AS email',
        'u.firstName AS "firstName"',
        'u.lastName AS "lastName"',
        'u.role AS role',
        `COALESCE(u.mobileNumber, '') AS "mobileNumber"`,
        `COALESCE(u.homeCity, '') AS "homeCity"`,
        'u.isSenior AS "isSenior"',
        'u.isAdmin AS "isAdmin"'
      ])
      .addSelect([
        `CASE 
          WHEN u.role != '${Role.SENIOR}' OR u.hasItSupport = false THEN 0
          ELSE 1
        END "hasItSupport"`
      ])
      .where(`u.role IN('${Role.MEMBER}', '${Role.SENIOR}') AND u.isAdmin = false`)
      .take(take)
      .skip(skip)
      .orderBy('id', 'ASC')
      .getRawMany();

    const count = await getRepository(User).count({
      where: {
        role: In([Role.MEMBER, Role.SENIOR]),
        isAdmin: false
      }
    });
    res.deliver(200, `All customers list`, { users, count });
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getSeniorAssignedNurses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seniorId = req.query.seniorId as unknown as number;

    const user = await getRepository(User).findOne({ id: seniorId });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.isSenior && user.role !== Role.SENIOR) {
      throw new BadRequestError('User is not a senior');
    }

    let assignedStaffs = await getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.assignedStaffMembers', 'asm')
      .where(`u.isSenior = true AND u.id = ${seniorId}`)
      .getOne();

    let assignedStaffMemberIds = assignedStaffs?.assignedStaffMembers.map((element) => {
      return element.supportStaffId;
    });

    let nurses = [];
    if (assignedStaffMemberIds && assignedStaffMemberIds.length > 0) {
      nurses = await getRepository(User)
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.supportStaff', 'ss')
        .where(`ss.isNurse = ${YesNo.YES} AND u.id != ${seniorId} AND ss.id IN (${assignedStaffMemberIds})`)
        .select(['u.id AS id'])
        .getRawMany();
    }

    res.deliver(200, '', { nurses });
  } catch (error) {
    // @ts-ignore
    return next(new InternalServerError(error.message));
  }
};

export const getCustomerData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await getRepository(User).findOne(id);

    let result;

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role === Role.SENIOR && !user.isSenior) {
      throw new ForbiddenError('User is not a senior user');
    }

    switch (user.role) {
      case Role.MEMBER:
        result = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobileNumber: user.mobileNumber,
          hasItSupport: user.hasItSupport === false ? 0 : 1,
          role: user.role
        };
        break;
      case Role.SENIOR:
        let assignedStaffs = await getRepository(User)
          .createQueryBuilder('u')
          .leftJoinAndSelect('u.assignedStaffMembers', 'asm')
          .where(`u.isSenior = true AND u.id = ${user.id}`)
          .getOne();

        let assignedStaffMemberIds = assignedStaffs?.assignedStaffMembers.map((element) => {
          return element.supportStaffId;
        });
        let nurses = [];
        if (assignedStaffMemberIds && assignedStaffMemberIds.length > 0) {
          nurses = await getRepository(User)
            .createQueryBuilder('u')
            .leftJoinAndSelect('u.supportStaff', 'ss')
            .where(`ss.isNurse = ${YesNo.YES} AND u.id != ${user.id} AND ss.id IN (${assignedStaffMemberIds})`)
            .select([
              'u.id AS "id"',
              'u.firstName AS firstName',
              'u.lastName AS lastName',
              `COALESCE(u.imageUrl, '') AS "imageUrl"`
            ])
            .getRawMany();
        }

        result = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobileNumber: user.mobileNumber,
          role: user.role,
          hasItSupport: user.hasItSupport === false ? 0 : 1,
          nurses
        };
        break;
      default:
        throw new NotFoundError('User is neither senior nor member type');
    }
    res.deliver(200, '', result);
  } catch (error) {
    // @ts-ignore
    return next(new InternalServerError(error.message));
  }
};
/* SECTION: Helper */
export const getStaffInviteURL = (type: any, token: any) => `${server_uri}/invite/staff/${type}?token=${token}`;

export const staffInviteTemplate = (user: any, url: any) => {
  const from = process.env.EMAIL_LOGIN;
  const to = user.email;
  const subject = 'Tervetuloa digihappyn henkilökunnan perehdyttämiseen';
  const html = `
  <p>Hei ${user.firstName || user.email},</p>
  <p>Napsauta linkkiä aloittaaksesi kirjautumisprosessin:</p>
  <a href=${url}>${url}</a>
  `;

  return { from, to, subject, html };
};

/* !SECTION: Helper END */
