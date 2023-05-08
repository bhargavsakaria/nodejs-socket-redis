import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  ManyToMany,
  ManyToOne,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

import Service from './Service.postgres';
import User from './User.postgres';

@Entity()
export default class Order extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @Column({ nullable: true })
  name!: string;

  @Column()
  address!: string;

  @Column()
  postalCode!: string;

  @Column({ nullable: true })
  city!: string;

  @Column({ nullable: true })
  country!: string;

  @Column({ nullable: true })
  email!: string;

  @Column({ nullable: true })
  mobile!: string;

  @Column({ nullable: true })
  shippingMethod!: string;

  @Column({ type: 'real', nullable: true })
  shippingPrice!: number;

  @Column({ nullable: true })
  paymentResult!: string;

  @Column({ nullable: true })
  paymentMethod!: string;

  @Column({ type: 'real', nullable: true })
  taxPrice!: number;

  @Column({ type: 'real', nullable: true })
  totalPrice!: number;

  @Column({
    default: false
  })
  isPaid!: boolean;

  @Column({ nullable: true })
  paidAt!: number;

  @Column({ nullable: true })
  invoiceId!: string;

  @Column({ nullable: true })
  subscriptionId!: string;

  @Column({ nullable: true })
  shipmentId!: string;

  @Column({ default: false })
  usePickupPoint!: boolean;

  @Column({ nullable: true })
  pickupPoint!: string;

  @Column({ type: 'jsonb', nullable: true })
  pickupPointData!: object;

  @Column({ nullable: true })
  coupon!: string;

  @Column({ type: 'jsonb', nullable: true })
  couponData!: object;

  @Column({ nullable: true }) // Valmis clicked or not
  ready!: Date;

  @ManyToOne(() => User, (user) => user.orders, {
    cascade: ['insert'],
    eager: true,
    onDelete: 'CASCADE'
  })
  user!: User;

  @ManyToMany(() => Service, {
    cascade: true,
    eager: true
  })
  @JoinTable({
    name: 'service_orders_order',
    joinColumn: { name: 'orderId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'serviceId' }
  })
  services!: Service[];
}
