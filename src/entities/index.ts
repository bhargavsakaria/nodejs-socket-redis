import Order from './Order.postgres';
import Service from './Service.postgres';
import User from './User.postgres';
import Group from './Group.postgres';
import Coupon from './Coupons.postgres';
import Alert from './Alert.postgres';
import Blog from './Blog.postgres';
import BlogTopic from './BlogTopic.postgres';
import SupportStaffs from './SupportStaffs.postgres';
import AssignedSeniorStaffs from './AssignedSeniorStaffs.postgres';
import StaffAvailability from './StaffAvailability.postgres';
import CallHistory from './CallHistory.postgres';
import ApplicationVersions from './ApplicationVersions.postgres';
import UserSettings from './UserSettings.postgres';
import AccessTokens from './AccessTokens.postgres';
import Notifications from './Notifications.postgres';
import SocketRooms from './SocketRooms.postgres';
import StaffInvite from './StaffInvite.postgres';

const Entities = [
  Order,
  Service,
  User,
  Group,
  Coupon,
  Alert,
  Blog,
  BlogTopic,
  SupportStaffs,
  AssignedSeniorStaffs,
  StaffAvailability,
  CallHistory,
  ApplicationVersions,
  UserSettings,
  AccessTokens,
  Notifications,
  SocketRooms,
  StaffInvite
];
export default Entities;
