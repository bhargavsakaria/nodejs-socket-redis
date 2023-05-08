import { IJSONB, YesNo } from '../utils/constants';
import { BaseEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class SocketRooms extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  room!: string;

  @Column()
  senderId!: number;

  @Column()
  receiverId!: number;

  @Column({
    type: 'jsonb',
    default: {}
  })
  roomData!: IJSONB;

  @Column({ type: 'smallint', default: YesNo.YES })
  isActive!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
