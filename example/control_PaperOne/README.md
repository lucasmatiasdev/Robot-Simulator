# Control de Robots PaperOne - Protocolo MQTT

## Descripción general

Firmware para robots PaperOne basados en ESP32. Cada robot se conecta a WiFi, se suscribe a su propio topic MQTT y ejecuta comandos de movimiento codificados en JSON. Diseñado para uso en clase con múltiples robots operando simultáneamente.

## Estructura del código

| Archivo | Responsabilidad |
|---------|----------------|
| `config.h` | Nombre del dispositivo, dirección/puerto del broker, constantes compartidas |
| `wifi_manager.h` | Escaneo WiFi, selección de red, gestión de conexión |
| `mqtt_handler.h` | Cliente MQTT, parseo JSON, control de motores |
| `control_PaperOne.ino` | `setup()` / `loop()` — punto de entrada principal |

## Configuración MQTT

| Parámetro | Valor |
|-----------|-------|
| Broker | `168.226.218.194` |
| Puerto | `8741` |
| Keep Alive | 60 s |
| Timeout de socket | 10 s |
| Buffer de payload | 512 bytes |

El broker y el puerto se definen en `config.h`:

```cpp
#define MQTT_SERVER "168.226.218.194"
#define MQTT_PORT   8741
```

## Identidad de los robots

Cada robot se identifica con `DEVICE_NAME` en `config.h`. Cambiar este valor antes de flashear cada unidad.

| DEVICE_NAME | Color    | Topic suscrito  |
|-------------|----------|-----------------|
| `robot_1`   | Rojo     | `topic/robot_1` |
| `robot_2`   | Verde    | `topic/robot_2` |
| `robot_3`   | Rosa     | `topic/robot_3` |
| `robot_4`   | Amarillo | `topic/robot_4` |
| `robot_5`   | Azul     | `topic/robot_5` |
| `robot_6`   | Negro    | `topic/robot_6` |

## Formato de mensajes

Todos los comandos se envían como JSON al topic `topic/<DEVICE_NAME>`:

```json
{ "accion": "<accion>", "valor": <numero> }
```

- **accion** (string, requerido): acción a ejecutar
- **valor** (número, opcional): duración en milisegundos para acciones de movimiento; `0` u omitido cuando no aplica

## Comandos disponibles

| accion | valor | Descripción |
|--------|-------|-------------|
| `avanzar` | ms | Avanza y luego se detiene |
| `retroceder` | ms | Retrocede y luego se detiene |
| `izquierda` | ms | Gira a la izquierda por `valor/4` ms y se detiene |
| `derecha` | ms | Gira a la derecha por `valor/4` ms y se detiene |
| `detener` | — | Detiene los motores inmediatamente |
| `led` | `1` / `0` | Enciende/apaga el LED integrado |
| `bailar` | — | Ejecuta una secuencia de baile preprogramada (~2,5 s) |

> Los giros usan `valor/4` internamente, por lo que el mismo valor produce un arco proporcionalmente más corto que un desplazamiento recto.

## Ejemplos

```bash
# Avanzar robot_1 durante 1 segundo
mosquitto_pub -h 168.226.218.194 -p 8741 -t topic/robot_1 -m '{"accion":"avanzar","valor":1000}'

# Girar robot_2 a la derecha (500ms → 125ms de rotación real)
mosquitto_pub -h 168.226.218.194 -p 8741 -t topic/robot_2 -m '{"accion":"derecha","valor":500}'

# Hacer bailar al robot_3
mosquitto_pub -h 168.226.218.194 -p 8741 -t topic/robot_3 -m '{"accion":"bailar","valor":0}'

# Detener robot_4
mosquitto_pub -h 168.226.218.194 -p 8741 -t topic/robot_4 -m '{"accion":"detener","valor":0}'
```

## Topic de respuesta

Los robots publican confirmaciones y estado en `robots_publicando`:

```json
{ "accion": "conectado", "valor": "true" }
```

## Configuración WiFi

Las redes conocidas se definen como arrays al tope de `wifi_manager.h`:

```cpp
const char* ssids_conocidos[]     = {"LAB-ROBOTICA", "UAI-FI", "iPhoneFranco", "InnovativaLab"};
const char* passwords_conocidos[] = {"LabRoboticaUAI", "AccesosUAI", "francowifi", "franco131098"};
```

Para agregar o quitar una red, editar ambos arrays y actualizar `TOTAL_REDES_CONOCIDAS`.

### Comportamiento al arrancar

1. Escanea las redes disponibles e imprime todas en una sola línea por Serial
2. Filtra solo las redes presentes en la lista conocida
3. Cicla entre las redes conocidas detectadas hasta lograr conexión
4. Si no encuentra ninguna red conocida, re-escanea antes de rendirse

Configuración aplicada al inicio para mejorar la estabilidad con muchos dispositivos simultáneos:

```cpp
WiFi.persistent(false);       // no guardar credenciales en flash
WiFi.setAutoReconnect(false); // reconexión solo manual
WiFi.setSleep(false);         // deshabilitar ahorro de energía WiFi (reduce latencia y cortes)
```

Timeout de conexión: 10 segundos por red (40 × 250 ms).

## Indicadores LED

El LED integrado (GPIO 2) señaliza el estado de conexión sin necesidad de monitor serie:

| Patrón | Significado |
|--------|-------------|
| Apagado | Sin WiFi |
| Parpadeo lento (~2 Hz) | Conectando a WiFi |
| Parpadeo rápido (5 Hz) | WiFi ok — reconectando al broker MQTT |
| Encendido fijo | WiFi + MQTT conectados |
| 3 destellos cortos | Comando recibido y ejecutándose |

## Hardware

### Pines de motores (H-bridge)

| Señal | GPIO |
|-------|------|
| Motor 1 — A | 13 |
| Motor 1 — B | 12 |
| Motor 2 — A | 14 |
| Motor 2 — B | 27 |

Potencia PWM por defecto: **200 / 255** (`pwm_potencia` en `mqtt_handler.h`).

### Lógica de dirección

| Comando | Motor 1 | Motor 2 |
|---------|---------|---------|
| avanzar | → adelante | → adelante |
| retroceder | → atrás | → atrás |
| izquierda | → atrás | → adelante |
| derecha | → adelante | → atrás |

## Notas de arquitectura

### Callback MQTT no bloqueante

El callback MQTT (`funcionEscuchar`) solo almacena la acción recibida y activa un flag (`accion_pendiente`). Los comandos de motor se ejecutan en `loop()`, manteniendo el stack MQTT responsive mientras se ejecutan los movimientos.

### ID de cliente MQTT

Se genera como `<MAC>-<timestamp>`. Si la dirección MAC no está disponible al momento de conectar, usa `<DEVICE_NAME>-<timestamp>` como fallback.

## Códigos de error MQTT

| Código | Descripción |
|--------|-------------|
| -1 | El servidor no respondió dentro del timeout |
| -2 | Red no conectada |
| -3 | Conexión rechazada por el servidor |
| -4 | ID de cliente no válido |
| -5 | Usuario/contraseña no válidos |
| -6 | No autorizado |

## Solución de problemas

**El robot no responde**
- Verificar el estado del LED (ver tabla de indicadores)
- Confirmar que el topic coincide exactamente con `topic/<DEVICE_NAME>`
- Validar el JSON con un linter
- Abrir el monitor serie (115200 baudios) para ver los logs de conexión y el RSSI

**El robot se conecta pero se desconecta seguido**
- Revisar el RSSI en el monitor serie — por debajo de -80 dBm es poco confiable
- Reducir la distancia al access point
- Verificar que ningún otro dispositivo use el mismo ID de cliente MQTT

**Los giros no son los esperados**
- Recordar que los giros usan `valor/4`: enviar `2000` para ~500 ms de rotación real

## Autor

Franco Balich
