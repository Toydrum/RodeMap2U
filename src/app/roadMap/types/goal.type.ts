import { TPath } from "./path.type";

export type TGoal = {
  title: string;
  map: TPath[];
  priority: number;
  date: Date;
};
