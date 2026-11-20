# Punto 10 Fútbol Tenis · Torneos

Sistema sencillo para llevar **equipos, rol de juegos, resultados y estadísticas** de los torneos de Punto 10 Fútbol Tenis (por ahora *Intersemanal* y *Sabatino*).

- **Página pública** (`index.html`): tabla de posiciones con los resultados jugados, rol de juegos por semana y equipos. Se actualiza sola cada minuto. Es el enlace que compartes.
- **Panel de administración** (`admin.html`): aquí agregas equipos, armas el rol, capturas resultados y ajustas la estadística. Al presionar **Publicar**, los cambios se guardan en GitHub y aparecen en la página pública.

Todo vive en GitHub (gratis): el sitio en **GitHub Pages** y los datos en el archivo `data/torneos.json` del mismo repositorio.

## Enlaces

- **Página pública (para compartir):** <https://javiermirelesreyna.github.io/punto-10-ponchito/>
  - Intersemanal: <https://javiermirelesreyna.github.io/punto-10-ponchito/#intersemanal>
  - Sabatino: <https://javiermirelesreyna.github.io/punto-10-ponchito/#sabatino>
- **Panel de administración:** <https://javiermirelesreyna.github.io/punto-10-ponchito/admin.html>

---

## Instalación (una sola vez)

### 1. Crea el repositorio
1. Entra a <https://github.com> (crea una cuenta si no tienes).
2. Arriba a la derecha: **+ → New repository**.
3. Nombre: por ejemplo `punto-10-ponchito`. Déjalo **Public** (GitHub Pages gratis requiere repositorio público). Clic en **Create repository**.

### 2. Sube los archivos
1. En el repositorio nuevo, clic en **uploading an existing file** (o **Add file → Upload files**).
2. Arrastra **todo el contenido** de esta carpeta: `index.html`, `admin.html`, `config.js`, `README.md` y las carpetas `assets` y `data`.
   (El archivo `logo chico.png` no hace falta; el sitio usa las versiones optimizadas de `assets/`).
3. Clic en **Commit changes**.

### 3. Activa GitHub Pages
1. En el repositorio: **Settings → Pages**.
2. En *Build and deployment* → *Source*: **Deploy from a branch**.
3. *Branch*: **main** y carpeta **/ (root)** → **Save**.
4. En 1–2 minutos tu sitio estará en:
   - Página pública: `https://javiermirelesreyna.github.io/punto-10-ponchito/`
   - Panel: `https://javiermirelesreyna.github.io/punto-10-ponchito/admin.html`

### 4. Crea tu token de acceso (la "llave" para publicar)
1. Abre <https://github.com/settings/personal-access-tokens/new> (Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*).
2. *Token name*: `Punto 10 panel`. *Expiration*: la que prefieras (por ejemplo 1 año).
3. *Repository access*: **Only select repositories** → elige tu repositorio `punto-10-ponchito`.
4. *Permissions* → *Repository permissions* → **Contents: Read and write**.
5. **Generate token** y copia el texto que empieza con `github_pat_…` (solo se muestra una vez).

### 5. Conecta el panel
1. Abre `https://javiermirelesreyna.github.io/punto-10-ponchito/admin.html`.
2. Usuario y repositorio se llenan solos. Pega el token y presiona **Conectar**.
3. Listo. En ese navegador ya no te lo vuelve a pedir. En otro celular o computadora, repite este paso con el mismo token.

> **Seguridad:** el token funciona como tu contraseña para publicar. Se guarda solo en tu navegador y nunca se sube al sitio. No lo compartas. Si lo pierdes o crees que alguien lo tiene, bórralo en GitHub (misma página del paso 4) y genera otro. Cualquiera puede abrir `admin.html`, pero sin el token no puede publicar nada.

---

## Uso diario

1. **Equipos**: agrega cada equipo con sus jugadores (o pega una lista completa). Toca un equipo para subir su **logo**, la **foto del equipo** y la **foto de cada jugador** (toca el círculo del jugador). Las imágenes se reducen solas en tu celular antes de subirse. El aro del logo es **dorado** para el primer lugar, **blanco** para el último y **azul** para los demás, y cambia solo con la tabla.
2. **Rol y resultados**:
   - En **Programar jornada** eliges el día de juego, los equipos que se enfrentan y, si quieres, la **hora** de cada partido; luego presionas **Agregar al rol**.
   - Los partidos se agrupan solos por semana: *"Semana del 16 al 20 de noviembre"*. Si todos los partidos del torneo son el mismo día (como el Sabatino), se muestra el día: *"Sábado, 21 de noviembre"*. No hay números de jornada, así un equipo puede llevar más partidos que otro.
   - Escribe los sets de cada equipo (a ganar 3 de 5, por ejemplo 3-1): el partido pasa a **Jugado** y la tabla se recalcula sola. Si el marcador no es válido (3-3, 2-1…) se marca en rojo y no cuenta hasta que lo corrijas.
   - **W.O.**: si un equipo no se presenta, elige "W.O. · gana …" en el estado; cuenta como 3-0.
   - Puedes cambiar el día, los equipos o borrar cualquier partido.
3. **Estadística**: puedes corregir cualquier número (PG, PP, SG, SP, PTS). Lo que escribas se guarda como *ajuste manual* (casilla dorada) y se respeta aunque sigas capturando resultados. Sirve para sanciones, partidos de antes del sistema, etc. La *nota pública* aparece debajo de la tabla.
4. **Información**: escribe el reglamento, premios, sede, contacto, etc. Aparece en la pestaña **Información** de la página pública con el título *"Reglamento e información del torneo"*. Formato sencillo: `# Título`, `- viñeta`, `1. lista`, `**negritas**` y enlaces https://… También puedes subir el cartel, fotos o el reglamento en PDF.
5. **Configuración**: nombre, descripción y aviso del torneo, **torneo terminado** (pasa a *Anteriores* en la página pública y muestra al campeón), puntos por ganar (3) y por perder (0), puntos por perder por W.O., sets para ganar (3), cuántos equipos clasifican (se marcan en verde) y el enlace directo para compartir.
6. **Vista previa** te muestra la página con tus cambios antes de publicarlos.
7. Presiona **Publicar** (o `Ctrl + S`). En unos segundos todos lo ven.

Los cambios sin publicar se guardan en tu dispositivo; si cierras la página, al volver te pregunta si quieres recuperarlos.

### App para el público
La página pública se puede **instalar como app** en el celular, con el ícono de Punto 10 y funcionando aunque no haya internet (muestra los últimos datos guardados):
- **Android / Chrome:** botón verde **Instalar app** en la página.
- **iPhone:** en Safari, botón **Compartir** → **Agregar a inicio** (el botón *Instalar app* muestra estos pasos).

Al subir una versión nueva del sitio, cambia el número `VERSION` en `sw.js` para que las apps instaladas se actualicen.

### Agregar más torneos
Botón **+ Torneo** en el panel. Cada torneo tiene su propio enlace, por ejemplo `https://javiermirelesreyna.github.io/punto-10-ponchito/#sabatino`.

### Respaldos
En **Configuración → Conexión y respaldo** puedes descargar un respaldo (`.json`) e importarlo después. Además, GitHub guarda el historial de cada publicación en el archivo `data/torneos.json` (pestaña *History*).

---

## Cómo se calcula la tabla

| Columna | Significado |
|---|---|
| PJ | Partidos jugados (PG + PP) |
| PG / PP | Partidos ganados / perdidos |
| SG / SP | Sets ganados / perdidos |
| DS | Diferencia de sets (SG − SP) |
| PTS | 3 por partido ganado (+ ajustes) |

Se juega a ganar 3 de 5 sets y no hay empates. Orden de la tabla: PTS → diferencia de sets → sets ganados → partidos ganados.

En la pestaña **Tabla** de la página pública solo aparecen los partidos ya jugados; los pendientes se ven en **Rol de juegos**.

---

## Probar en tu computadora (opcional)

Con Python instalado, dentro de esta carpeta:

```
python -m http.server 8080
```

Abre <http://localhost:8080/admin.html> y elige **Probar sin conectar**. En modo prueba los cambios se quedan en tu navegador y el botón **Descargar** te da el archivo `torneos.json`.

## Dominio propio (opcional)
Si usas un dominio propio en lugar de `usuario.github.io`, escribe tu usuario y repositorio en `config.js`.
