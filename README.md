# ProyectoCursoInformatica

Proyecto final de curso publicado con GitHub Pages.

## Activar GitHub Pages

1. Ve a **Settings > Pages** en el repositorio.
2. En **Build and deployment**, selecciona:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (o la rama que uses) y carpeta `/ (root)`.
3. Guarda los cambios.

URL pública esperada:

https://manexlopez.github.io/ProyectoCursoInformatica/

## Estructura recomendada

- `index.html` → página principal del portafolio (carga 1 proyecto principal + 4 satélite)
- `projects/project-01/index.html`
- `projects/project-02/index.html`
- `projects/project-03/index.html`
- `projects/project-04/index.html`
- `projects/project-05/index.html`

## Añadir o reemplazar proyectos

1. Reemplaza el contenido de cada `projects/project-XX/index.html` por tu mini-proyecto.
2. Si el proyecto tiene assets, colócalos dentro de su carpeta (`projects/project-XX/assets/...`) y usa rutas relativas internas.
3. Para añadir más proyectos, crea una nueva carpeta `projects/project-XX/` con su `index.html`.
4. Edita el arreglo `proyectos` en `index.html` para registrar nombre y ruta, por ejemplo:

```js
{ id: 'project-06', nombre: '06. Mi Proyecto', ruta: './projects/project-06/' }
```
