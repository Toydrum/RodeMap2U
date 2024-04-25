type TRoadMap = {
  title: string;
  owner: string;
  goals: TGoal[];
};

type TGoal = {
  title: string;
  map: TPath[];
  priority: number;
  date: Date;
};

/* Ordenadas */
type TPath = {
  title: string;
  actions: TAction[];
  order: number;
};

/* Desordenadas */
type TAction = {
  title: string;
  description: string;
  status: "not started" | "started" | "on pause" | "finished";
  priority: number;
};
