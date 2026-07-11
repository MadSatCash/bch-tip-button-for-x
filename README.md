# BCH Tip Button for X — 0.5.0

Extensión local para Google Chrome que agrega un botón **Tip** a los posts de X. Al usarlo, detecta al autor, permite elegir un monto y prepara la respuesta:

```text
@bchtip tip @usuario 0.001 BCH

View your BCH tip at tipbot.cash
```

Abre y publica la respuesta dentro de la pestaña actual de X, sin ventanas adicionales. La interfaz incluye inglés y español; inglés es el idioma predeterminado.

## Instalación en Chrome

1. Descomprimí el ZIP en una carpeta permanente.
2. Abrí `chrome://extensions`.
3. Activá **Modo desarrollador** arriba a la derecha.
4. Presioná **Cargar extensión sin empaquetar**.
5. Elegí la carpeta `bch-tip-button-x/app`, que contiene `manifest.json`.
6. Recargá la pestaña de X.

## Uso

1. En un post de X, presioná el nuevo botón **Tip**.
2. Elegí o escribí el monto en BCH.
3. Revisá el comando.
4. Presioná **Send tip** / **Enviar propina**.

La extensión abre el compositor de X e inserta el comando, pero no publica por su cuenta. Podés revisar la respuesta, agregar texto propio y presionar **Responder** cuando estés conforme.

## Configuración

Al presionar el ícono de la extensión en Chrome podés cambiar:

- Usuario del bot.
- Montos rápidos.
- Plantilla del comando.
- Idioma EN/ES (inglés predeterminado).

Cada respuesta incluye automáticamente el texto fijo en inglés `View your BCH tip at tipbot.cash` como segunda línea.

## Seguridad y alcance

- No maneja claves privadas, seed phrases ni fondos.
- No se conecta directamente con una wallet.
- Reutiliza la pestaña y la sesión de X que ya están abiertas.
- No abre ventanas emergentes.
- Conviene probar primero con el monto mínimo.

## Pruebas del código auxiliar

Con Node.js instalado:

```bash
node tests/core.test.js
```
