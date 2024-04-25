import { TGoal } from "./goal.type";

export type TRoadMap = {
  title: string;
  owner: string;
  goals: TGoal[];
};
