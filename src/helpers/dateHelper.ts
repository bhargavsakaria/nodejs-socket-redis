import moment from 'moment';

const REFERENCE = moment();
const YESTERDAY = REFERENCE.clone().subtract(1, 'days').startOf('day');
const TODAY = REFERENCE.clone().startOf('day');

export const isToday = (datetime: string | Date) => {
  const momentDatetime = moment(datetime);

  return momentDatetime.isSame(TODAY, 'd');
};

export const isYesterday = (datetime: string | Date) => {
  const momentDatetime = moment(datetime);

  return momentDatetime.isSame(YESTERDAY, 'd');
};
