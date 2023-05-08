import { YesNo } from '../utils/constants';
import { BaseEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class CallHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  senderId!: number;

  @Column()
  receiverId!: number;

  @Column({ default: YesNo.NO })
  isAnswered!: number;

  @Column({ default: YesNo.NO, nullable: true })
  isMissed!: number;

  @Column({ nullable: true })
  roomId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @DeleteDateColumn()
  deletedForSender!: Date;

  @DeleteDateColumn()
  deletedForReceiver!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
