import { Platform, YesNo } from '../utils/constants';
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class AccessTokens extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  token!: string;

  @Column()
  userId!: number;

  @Column({
    default: YesNo.NO
  })
  isRevoked!: number;

  @Column({
    type: 'enum',
    enum: Platform,
    nullable: true
  })
  platform!: Platform;

  @Column({ nullable: true })
  deviceToken!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
