export type TAction = {
  title: string;
  description: string;
  status: 'not started' | 'started' | 'on pause' | 'finished';
  priority: number;
  isRecurrent: boolean;
  refreshTime: number;
  time2Do: number;
};
