import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import AssignedSeniorStaffs from './AssignedSeniorStaffs.postgres';
import { YesNo } from '../utils/constants';
import User from './User.postgres';

@Entity()
export default class SupportStaffs extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User)
  @JoinColumn()
  user!: User;

  @Column({
    default: YesNo.YES,
    comment: 'On No it would be IT person'
  })
  isNurse!: number;

  /* Senior would be only assigned to the Nurse */
  @OneToMany(() => AssignedSeniorStaffs, (seniorStaff) => seniorStaff.supportStaffId, { nullable: true })
  seniors!: AssignedSeniorStaffs[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
