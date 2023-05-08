import { YesNo } from '../utils/constants';
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class Notifications extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  staffId!: number;

  @Column()
  message!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ default: YesNo.NO })
  isRead!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
