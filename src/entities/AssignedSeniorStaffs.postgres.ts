import { BaseEntity, Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import SupportStaffs from './SupportStaffs.postgres';
import User from './User.postgres';

@Entity()
export default class AssignedSeniorStaffs extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @ManyToOne(() => SupportStaffs, (supportStaff) => supportStaff.id)
  @JoinColumn({ name: 'supportStaffId' })
  supportStaffId!: number;

  @Column()
  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'seniorId' })
  seniorId!: number;

  @DeleteDateColumn()
  deletedAt!: Date;
}
