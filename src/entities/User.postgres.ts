import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

import Order from './Order.postgres';
import Group from './Group.postgres';
import AssignedSeniorStaffs from './AssignedSeniorStaffs.postgres';
import * as bcrypt from 'bcrypt';
import { YesNo } from '../utils/constants';
import SupportStaffs from './SupportStaffs.postgres';

@Entity()
export default class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  username!: string;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  mobileNumber!: string;

  @Column({ nullable: true })
  skypeEmail!: string;

  @Column({ nullable: true })
  image!: string;

  @Column({ nullable: true })
  imageUrl!: string;

  @Column({ nullable: true })
  nursingHome!: string;

  @Column({ nullable: true })
  department!: string;

  @Column({ nullable: true })
  homeAddress!: string;

  @Column({ nullable: true })
  homeCity!: string;

  @Column({ nullable: true })
  homePostalCode!: string;

  @Column()
  role!: string;

  @Column({ nullable: true })
  isSenior!: boolean;

  @Column({ default: false, nullable: true })
  isAdmin!: boolean;

  @Column({ default: false, nullable: true })
  readOnly!: boolean;

  @Column({ nullable: true, default: null })
  verificationToken!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @Column({ nullable: true, default: null })
  deletedAt!: Date;

  @Column({ nullable: true })
  customerId!: string;

  @Column({ nullable: true, type: 'character varying' })
  socketId!: string | null;

  @Column({ nullable: true, default: YesNo.YES })
  newUser!: number;

  @Column({ nullable: true })
  hasItSupport!: boolean;

  @ManyToOne(() => Group, (group) => group.members, {
    cascade: ['insert', 'remove'],
    nullable: true
  })
  group!: Group;

  @OneToMany(() => Order, (order) => order.user, {
    cascade: true
  })
  orders!: Order[];

  @OneToMany(() => AssignedSeniorStaffs, (seniorStaff) => seniorStaff.seniorId)
  assignedStaffMembers!: AssignedSeniorStaffs[];

  @OneToOne(() => SupportStaffs, (staff) => staff.user)
  @JoinColumn()
  supportStaff!: SupportStaffs;

  async validatePassword(attempt: string): Promise<boolean> {
    return await bcrypt.compare(attempt, this.password);
  }
}
