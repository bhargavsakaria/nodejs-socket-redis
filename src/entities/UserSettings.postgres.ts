import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { YesNo } from '../utils/constants';

@Entity()
export default class UserSettings extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ default: YesNo.NO, nullable: true })
  autoAnswer!: number;
}
