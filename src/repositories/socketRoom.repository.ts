import SocketRooms from '../entities/SocketRooms.postgres';
import {
  EntityRepository,
  FindManyOptions,
  FindOneOptions,
  getCustomRepository,
  getRepository,
  Repository
} from 'typeorm';
import { RoomAndSocketId, YesNo } from '../utils/constants';
import CallHistory from '../entities/CallHistory.postgres';
import { UserRepository } from './user.repository';

@EntityRepository(SocketRooms)
export class SocketRoomRepository extends Repository<SocketRooms> {
  public async deactiveSenderRooms(senderId: number) {
    let answeredRooms: Array<RoomAndSocketId> = [];
    let notAnsweredRooms: Array<RoomAndSocketId> = [];
    const rooms = await this.find({
      where: { senderId, isActive: YesNo.YES },
      select: ['id', 'senderId', 'receiverId']
    });

    for (let room of rooms) {
      await this.updateRoomStatus(room.id, {
        isActive: YesNo.NO,
        deletedAt: new Date()
      });

      let roomCallHistory = await getRepository(CallHistory).findOne({
        where: {
          roomId: room.id,
          senderId: room.senderId,
          receiverId: room.receiverId
        }
      });

      if (roomCallHistory) {
        switch (roomCallHistory.isAnswered) {
          case YesNo.YES:
            answeredRooms.push({
              room_id: room.room,
              receiverSocketId: await getCustomRepository(UserRepository).getSocketId(room.receiverId)
            });
            break;
          case YesNo.NO:
            notAnsweredRooms.push({
              room_id: room.room,
              receiverSocketId: await getCustomRepository(UserRepository).getSocketId(room.receiverId)
            });
        }
        roomCallHistory.deletedAt = new Date();
        await getRepository(CallHistory).save(roomCallHistory);
      }
    }

    return { answeredRooms, notAnsweredRooms };
  }

  public async deativateReceiverRooms(receiverId: number) {
    let answeredRooms: RoomAndSocketId[] = [];
    let notAnsweredRooms: RoomAndSocketId[] = [];

    const rooms = await this.find({
      where: { receiverId, isActive: YesNo.YES },
      select: ['id', 'senderId', 'receiverId']
    });

    for (let room of rooms) {
      await this.updateRoomStatus(room.id, {
        isActive: YesNo.NO,
        deletedAt: new Date()
      });

      let roomCallHistory = await getRepository(CallHistory).findOne({
        where: {
          roomId: room.id,
          senderId: room.senderId,
          receiverId: room.receiverId
        }
      });

      if (roomCallHistory) {
        switch (roomCallHistory.isAnswered) {
          case YesNo.YES:
            answeredRooms.push({
              room_id: room.room,
              senderSocketId: await getCustomRepository(UserRepository).getSocketId(room.senderId)
            });
            break;
          case YesNo.NO:
            notAnsweredRooms.push({
              room_id: room.room,
              senderSocketId: await getCustomRepository(UserRepository).getSocketId(room.senderId)
            });
        }
        roomCallHistory.deletedAt = new Date();
        await getRepository(CallHistory).save(roomCallHistory);
      }
    }

    return { answeredRooms, notAnsweredRooms };
  }

  public async deativateOtherStaffRooms(findOptions: FindManyOptions<SocketRooms>) {
    let notAnsweredRooms: RoomAndSocketId[] = [];

    let rooms = await this.find(findOptions);

    for (let room of rooms) {
      room.isActive = YesNo.NO;
      room.deletedAt = new Date();
      await this.save(room);

      let roomCallHistory = await getRepository(CallHistory).findOne({
        where: {
          receiverId: room.receiverId,
          roomId: room.id
        }
      });

      if (roomCallHistory) {
        roomCallHistory.isAnswered = YesNo.NO;
        roomCallHistory.isMissed = YesNo.YES;
        roomCallHistory.deletedForReceiver = new Date();
        roomCallHistory.deletedAt = new Date();

        await getRepository(CallHistory).save(roomCallHistory);

        notAnsweredRooms.push({
          room_id: room.room,
          receiverSocketId: await getCustomRepository(UserRepository).getSocketId(room.receiverId)
        });
      }
    }

    return { notAnsweredRooms };
  }

  public async updateRoomStatus(rowId: number, updateColumns: Partial<SocketRooms>): Promise<void> {
    const row: SocketRooms | undefined = await this.findOne(rowId);

    if (row) await this.save({ ...row, ...updateColumns });
  }

  public async changeAnsweredRoomStatus(findOptions: FindOneOptions<SocketRooms>) {
    const room = await this.findOne(findOptions);

    if (room) {
      let answeredRoomCallHistory = await getRepository(CallHistory).findOne({
        where: { roomId: room.id, senderId: room.senderId, receiverId: room.receiverId }
      });

      if (answeredRoomCallHistory) {
        answeredRoomCallHistory.isAnswered = YesNo.YES;
        answeredRoomCallHistory.isMissed = YesNo.NO;
        await getRepository(CallHistory).save(answeredRoomCallHistory);
      }
    }
  }

  public async isUserCallingSomeone(userId: number) {
    let room = await this.findOne({
      where: {
        senderId: userId,
        isActive: YesNo.YES
      }
    });

    if (room) return true;

    return false;
  }

  public async isUserBeingCalledBySomeone(userId: number) {
    let room = await this.findOne({
      where: {
        receiverId: userId,
        isActive: YesNo.YES
      }
    });

    if (room) return true;

    return false;
  }

  public async incomingCall(whereArguments: Partial<SocketRooms>) {
    let room = await this.findOne({
      ...whereArguments
    });

    if (room) return true;

    return false;
  }
}
