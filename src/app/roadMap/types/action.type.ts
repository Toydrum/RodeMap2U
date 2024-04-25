export type TAction = {
  title: string;
  description: string;
  status: "not started" | "started" | "on pause" | "finished";
  priority: number;
};
