const plan = {
  metas: [
    {
      title: "Blog Genérico",
      caracteristicas: [
        {
          caracteristica: "Poder manipular artículos",
        },
        {
          caracteristica: "Poder configurar el sitio",
        },
      ],
      objetivos: [
        {
          objetivo: "Tener la planeación del proyecto",
          tareas: [
            {
              tarea: "Definir el objetivo del proyecto(Propuesta del proyecto)",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea: "Definir las características del proyecto",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea: "Definir los procesos del desarrollo del proyecto",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea:
                "Definir los pasos de los procesos del desarrollo del proyecto",
              hecho: true,
              etapa: "acabado",
            },
          ],
        },
        {
          objetivo: "Tener el diseño del proyecto",
          tareas: [
            {
              tarea: "Análisis de los requerimientos",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea: "Análisis de competidores",
              hecho: false,
              etapa: "cancelado",
            },
            {
              tarea: "Diseño de la base de datos",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea: "Diseño de la interfaz",
              hecho: false,
              etapa: "cancelado",
            },
            {
              tarea: "Inventario de las páginas",
              hecho: true,
              etapa: "acabado",
            },
            {
              tarea: "Matriz de pruebas",
              hecho: false,
              etapa: "no empezado",
            },
          ],
        },
        {
          objetivo: "Tener el código del proyecto",
          tareas: [
            {
              tarea: "Crear el repositorio",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea:
                "Crear la estructura del proyecto(carpetas y archivos) Frontend",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Implementar el diseño de la aplicación",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea:
                "Crear la estructura del proyecto(carpetas y archivos) Backend",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea:
                "Crear los CRUDs(Create Read Update Delete) de los modelos de las bases de datos",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Integración de la API",
              hecho: false,
              etapa: "no empezado",
            },
          ],
        },
        {
          objetivo: "Tener la configuración del servidor del proyecto",
          tareas: [
            {
              tarea: "Configurar el servidor",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Configurar la base de datos",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Cargar y lanzar la aplicación en el servidor",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Configurar el dominio (DNS, Domain, SSL)",
              hecho: false,
              etapa: "no empezado",
            },
          ],
        },
        {
          objetivo: "Hacer las pruebas del proyecto",
          tareas: [
            {
              tarea: "Ejecutar la matriz de pruebas",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Ajustes a la aplicación",
              hecho: false,
              etapa: "no empezado",
            },
            {
              tarea: "Seguimiento de la matriz de pruebas",
              hecho: false,
              etapa: "no empezado",
            },
          ],
        },
        {
          objetivo: "Lanzar el producto",
        },
      ],
    },
  ],
};

const procesoDesarrollo = [
  {
    paso: "Inicio de la aplicación Frontend",
    lugar: "Frontend",
    tareas: [
      {
        tarea: "Crear la estructura del proyecto(carpetas y archivos)",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Crear la rutas del proyecto",
        hecho: false,
        etapa: "no empezado",
      },
    ],
  },
  {
    paso: "Implementar el diseño de la aplicación",
    lugar: "Frontend",
    tareas: [
      {
        tarea: "Crear los componentes de la aplicación Principal(Home & About)",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Pasar diseño a código de la pantalla Home",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Pasar diseño a código de la pantalla About",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea:
          "Crear los componentes de la aplicación Artículo(Article & Articles)",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Pasar diseño a código de la pantalla Article",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Pasar diseño a código de la pantalla Articles",
        hecho: false,
        etapa: "no empezado",
      },
    ],
  },
  {
    paso: "Inicio de la aplicación Backend",
    lugar: "Backend",
    tareas: [
      {
        tarea: "Crear la estructura del proyecto(carpetas y archivos)",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Crear la estructura del proyecto(carpetas y archivos)",
        hecho: false,
        etapa: "no empezado",
      },
    ],
  },
  {
    paso: "Crear los CRUDs(Create Read Update Delete) de los modelos de las bases de datos",
    lugar: "Backend",
    tareas: [
      {
        tarea: "Crear el modelo de los artículos",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Crear el modelo de configuraciones principales",
        hecho: false,
        etapa: "no empezado",
      },
    ],
  },
  {
    paso: "Integración de la API",
    lugar: "Frontend",
    tareas: [
      {
        tarea: "Crear los servicios de la API",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Conectar los servicios con las páginas principales",
        hecho: false,
        etapa: "no empezado",
      },
      {
        tarea: "Conectar los servicios con las páginas de artículos",
        hecho: false,
        etapa: "no empezado",
      },
    ],
  },
];

const inventarioPaginas = [
  {
    pagina: "Inicio",
    componente: "Home",
  },
  {
    pagina: "Artículos",
    componente: "Articles",
  },
  {
    pagina: "Artículo",
    componente: "Article",
  },
  {
    pagina: "Acerca de",
    componente: "About",
  },
];

/* Meterlo en html */
const body = document.querySelector("body");
body.innerHTML = `
  <h1>Plan</h1>
  ${plan.metas
    .map(
      (meta) => `
    <h2>${meta.title}</h2>
    <h3>Características</h3>
    <ul>
      ${meta.caracteristicas
        .map(
          (caracteristica) => `
        <li>${caracteristica.caracteristica}</li>
      `
        )
        .join("")}
    </ul>
    <h3>Objetivos</h3>
    <ul>
      ${meta.objetivos
        .map(
          (objetivo) => `
        <li>
          <h4>${objetivo.objetivo}</h4>
          <ul>
            ${
              objetivo.tareas
                ? objetivo.tareas
                    .map(
                      (tarea) => `
              <li>
                ${tarea.tarea}
                <span>Realizado: ${tarea.hecho ? "Si" : "No"}</span>
                <span>Etapa: ${tarea.etapa}</span>
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
