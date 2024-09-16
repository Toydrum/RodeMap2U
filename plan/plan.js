const plan = {
  metas: [
    {
      title: "RodeMap2U",
      features: [
        {
          feature: "Goals questionary",
        },
        {
          feature: "Priority selector",
        },
        {
          feature: "Actionable map drawing",
        },
      ],
      objectives: [
        {
          objective: "Project planing",
          tasks: [
            {
              task: "Define project objective(project proposal)",
              done: true,
              stage: "done",
            },
            {
              task: "Project features",
              done: true,
              stage: "done",
            },
            {
              task: "Define development process",
              done: true,
              stage: "done",
            },
            {
              task: "Define development steps",
              done: true,
              stage: "done",
            },
          ],
        },
        {
          objective: "Project Design",
          tasks: [
            {
              task: "Requirement analysis",
              done: true,
              stage: "done",
            },
            {
              task: "Competitor analysis",
              done: true,
              stage: "done",
            },
            {
              task: "Data base design",
              done: true,
              stage: "done",
            },
            {
              task: "Interface design",
              done: false,
              stage: "cancelled",
            },
            {
              task: "Pages inventory",
              done: true,
              stage: "done",
            },
            {
              task: "Test matrix",
              done: false,
              stage: "not started",
            },
          ],
        },
        {
          objective: "Project code",
          tasks: [
            {
              task: "Create repository",
              done: true,
              stage: "done",
            },
            {
              task: "Create project structure(folders and files) Frontend",
              done: true,
              stage: "done",
            },
            {
              task: "Implement app design",
              done: false,
              stage: "in progress",
            },
            /* {
              task: "Create project structure(folders and files) Backend",
              done: false,
              stage: "not started",
            }, */
            {
              task: "Create CRUDs(Create Read Update Delete) for data base models",
              done: false,
              stage: "not started",
            },
            /* {
              task: "API Integration",
              done: false,
              stage: "not started",
            }, */
          ],
        },
        {
          objective: "Project server configuration",
          tasks: [
            {
              task: "Server configuration",
              done: false,
              stage: "not started",
            },
            {
              task: "Data base configuration",
              done: false,
              stage: "not started",
            },
            {
              task: "Deploy app",
              done: false,
              stage: "not started",
            },
            {
              task: "Domain configuration (DNS, Domain, SSL)",
              done: false,
              stage: "not started",
            },
          ],
        },
        {
          objective: "Project tests",
          tasks: [
            {
              task: "Excecute test matrix",
              done: false,
              stage: "not started",
            },
            {
              task: "App adjustments",
              done: false,
              stage: "not started",
            },
            {
              task: "Test matrix follow up",
              done: false,
              stage: "not started",
            },
          ],
        },
        {
          objective: "Launch project",
        },
      ],
    },
  ],
};

const devProcess = [
  {
    step: "Frontend app start",
    place: "Frontend",
    tasks: [
      {
        task: "Create project structure(folders and files)",
        done: false,
        stage: "not started",
      },
      {
        task: "Create project routes",
        done: false,
        stage: "not started",
      },
    ],
  },
  {
    step: "Implement app design",
    place: "Frontend",
    tasks: [
      {
        task: "Create main components (Home & About)",
        done: false,
        stage: "not started",
      },
      {
        task: "Design to code of Inicio screen",
        done: false,
        stage: "not started",
      },
      {
        task: "Design to code of About screen",
        done: false,
        stage: "not started",
      },
      {
        task: "Create RoadMap components",
        done: false,
        stage: "not started",
      },
      {
        task: "Design to code of Repositorios screen",
        done: false,
        stage: "not started",
      },
      {
        task: "Design to code of RoadMap screen",
        done: false,
        stage: "not started",
      },
    ],
  },
  {
    step: "Mockup Services",
    place: "Frontend",
    tasks: [
      {
        task: "Create the mockup services",
        done: false,
        stage: "not started",
      },
      {
        task: "Connect the services with the main pages",
        done: false,
        stage: "not started",
      },
      {
        task: "Connect the services with the road pages",
        done: false,
        stage: "not started",
      },
    ],
  },
  /* {
    step: "Backend App Start",
    place: "Backend",
    tasks: [
      {
        task: "Create the project estructure(folders and files)",
        done: false,
        stage: "not started",
      },
      {
        task: "Config the project routes",
        done: false,
        stage: "not started",
      },
    ],
  }, */
  /* {
    step: "Create the CRUDs(Create Read Update Delete) of the models in the BDD",
    place: "Backend",
    tasks: [
      {
        task: "Create Article Models",
        done: false,
        stage: "not started",
      },
      {
        task: "Create main configuration models",
        done: false,
        stage: "not started",
      },
    ],
  }, */
  /* {
    step: "API Integration",
    place: "Frontend",
    tasks: [
      {
        task: "Create the services to the API",
        done: false,
        stage: "not started",
      },
      {
        task: "Connect the services with the main pages",
        done: false,
        stage: "not started",
      },
      {
        task: "Connect the services with the road pages",
        done: false,
        stage: "not started",
      },
    ],
  }, */
];

const pageInventory = [
  {
    page: "Repository",
    component: "Home",
    description: "Its where you can see the roadmaps",
  },
  {
    page: "Roadmap",
    component: "road",
  },
  {
    page: "About",
    component: "About",
  },
];

/* Get it on html */
const body = document.querySelector("body");
body.innerHTML = `
  <h1>Plan</h1>
  ${plan.metas
    .map(
      (meta) => `
    <h2>${meta.title}</h2>
    <h3>Features</h3>
    <ul>
      ${meta.features
        .map(
          (feature) => `
        <li>${feature.feature}</li>
      `
        )
        .join("")}
    </ul>
    <h3>Objectives</h3>
    <ul>
      ${meta.objectives
        .map(
          (objective) => `
        <li>
          <h4>${objective.objective}</h4>
          <ul>
            ${
              objective.tasks
                ? objective.tasks
                    .map(
                      (task) => `
              <li style="padding: 4px; margin: 4px;${
                task.done
                  ? "border: 2px solid green;"
                  : task.stage === "in progress"
                  ? "border: 2px solid yellow"
                  : task.stage === "cancelled"
                  ? "border: 2px solid red"
                  : task.stage === "not started"
                  ? "border: 2px solid gray"
                  : ""
              }">
                ${task.task}
                <span>Finished: ${task.done ? "Si" : "No"}</span>
                <span>Step: ${task.stage}</span>
              </li>
            `
                    )
                    .join("")
                : ""
            }
          </ul>
        </li>
      `
        )
        .join("")}
    </ul>
  `
    )
    .join("")}
`;
