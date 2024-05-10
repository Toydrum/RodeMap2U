export type TComponent = {
  name: string;
  description: string;
};

const components: TComponent[] = [
  {
    name: 'pipBoy',
    description: `La interfaz de usuario basada en el juego de Fallout.
    Aquí se mostrarán las preguntas, los botones y las listas de opciones.
    `,
  },
  {
    name: 'canvaRoadMap',
    description: `El componente que se encargará de dibujar el mapa de ruta.`,
  },
  {
    name: 'roadMap-item',
    description: `Un elemento de el canva del roadMap.`,
  },
  {
    name: 'roadMap-container',
    description: `Un contenedor que contiene una elementos para el canva y maneja las relaciones entre ellos.`,
  },
  {
    name: 'input-list-item',
    description: `Un componente que es una entrada de texto para generar listas.
    Se convierte en un elemento de lista cuando se presiona Enter y se pone una caja para meter un número.`,
  },
  {
    name: 'list-container',
    description: `Un contenedor que contiene una lista de elementos.`,
  },
  {
    name: 'button',
    description: `Un botón que se puede personalizar con colores y texto.`,
  },
  {
    name: 'timer',
    description: `Un temporizador que se puede iniciar, pausar y detener.`,
  },
];
