import { Entity, BaseEntity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import SupportStaffs from './SupportStaffs.postgres';

@Entity()
export default class StaffAvailability extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @ManyToOne(() => SupportStaffs, (supportStaff) => supportStaff.id)
  @JoinColumn({ name: 'supportStaffId' })
  supportStaffId!: number;
}
