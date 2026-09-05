#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include "config.h"

// Variables para Comandos Recibidos
String rx_accion = "";
unsigned long rx_valor = 0;
bool accion_pendiente = false;  // flag para ejecutar la acción en loop(), no en el callback

// Instancia de PubSubClient
PubSubClient client(espClient);

// --- Configuración PWM y Motores ---
#define pin_Motor1_1 13
#define pin_Motor1_2 12
#define pin_Motor2_1 14
#define pin_Motor2_2 27

int pwm_potencia = 200;

// --- Declaraciones de funciones para MQTT ---
void publicar_accion(const char *accion, const char *valor);
void publicar_mensaje(const char *mensaje);

// 3 destellos cortos: señal visual de que se recibió y ejecuta una acción
void led_triple_destello()
{
  for (int i = 0; i < 3; i++)
  {
    digitalWrite(LED_INTERNET_PIN, LOW);
    delay(60);
    digitalWrite(LED_INTERNET_PIN, HIGH);
    delay(60);
  }
}

// --- Comandos del Robot ---
void robot_detener()
{
  Serial.println("Accion robot: detener");
  analogWrite(pin_Motor1_1, 0);
  analogWrite(pin_Motor1_2, 0);
  analogWrite(pin_Motor2_1, 0);
  analogWrite(pin_Motor2_2, 0);
}

void robot_avanzar()
{
  Serial.println("Accion robot: avanzar");
  analogWrite(pin_Motor1_1, 0);
  analogWrite(pin_Motor1_2, pwm_potencia);
  analogWrite(pin_Motor2_1, 0);
  analogWrite(pin_Motor2_2, pwm_potencia);
}

void robot_retroceder()
{
  Serial.println("Accion robot: retroceder");
  analogWrite(pin_Motor1_1, pwm_potencia);
  analogWrite(pin_Motor1_2, 0);
  analogWrite(pin_Motor2_1, pwm_potencia);
  analogWrite(pin_Motor2_2, 0);
}

void robot_izquierda()
{
  Serial.println("Accion robot: izquierda");
  analogWrite(pin_Motor1_1, pwm_potencia);
  analogWrite(pin_Motor1_2, 0);
  analogWrite(pin_Motor2_1, 0);
  analogWrite(pin_Motor2_2, pwm_potencia);
}

void robot_derecha()
{
  Serial.println("Accion robot: derecha");
  analogWrite(pin_Motor1_1, 0);
  analogWrite(pin_Motor1_2, pwm_potencia);
  analogWrite(pin_Motor2_1, pwm_potencia);
  analogWrite(pin_Motor2_2, 0);
}

void acciones_robot()
{
  Serial.print("Ejecutando acción: ");
  Serial.print(rx_accion);
  Serial.print(" con valor: ");
  Serial.println(rx_valor);

  led_triple_destello();

  if (rx_accion.equals("avanzar"))
  {
    robot_avanzar();
    delay(rx_valor);
    robot_detener();
  }
  else if (rx_accion.equals("retroceder"))
  {
    robot_retroceder();
    delay(rx_valor);
    robot_detener();
  }
  else if (rx_accion.equals("izquierda"))
  {
    robot_izquierda();
    delay(rx_valor / 4);
    robot_detener();
  }
  else if (rx_accion.equals("derecha"))
  {
    robot_derecha();
    delay(rx_valor / 4);
    robot_detener();
  }
  else if (rx_accion.equals("detener"))
  {
    robot_detener();
  }
  else if (rx_accion.equals("led"))
  {
    digitalWrite(LED_INTERNET_PIN, rx_valor == 1 ? HIGH : LOW);
  }
  else if (rx_accion.equals("bailar"))
  {
    robot_avanzar();    delay(155);
    robot_retroceder(); delay(155);
    robot_izquierda();  delay(225);
    robot_derecha();    delay(225);
    robot_avanzar();    delay(295);
    robot_izquierda();  delay(155);
    robot_avanzar();    delay(155);
    robot_derecha();    delay(155);
    robot_retroceder(); delay(295);
    robot_izquierda();  delay(225);
    robot_retroceder(); delay(225);
    robot_derecha();    delay(225);
    robot_avanzar();    delay(225);
    robot_detener();
  }
}

// Callback MQTT: solo guarda la acción, la ejecución ocurre en loop()
void funcionEscuchar(char *topic, byte *payLoad, unsigned int length)
{
  Serial.print("Mensaje recibido en [");
  Serial.print(topic);
  Serial.print("]: ");

  String payloadStr = "";
  for (unsigned int i = 0; i < length; i++)
  {
    payloadStr += (char)payLoad[i];
    Serial.print((char)payLoad[i]);
  }
  Serial.println();

  DynamicJsonDocument doc(200);
  DeserializationError error = deserializeJson(doc, payloadStr);

  if (error)
  {
    Serial.print("Error al parsear JSON: ");
    Serial.println(error.c_str());
    return;
  }

  if (doc.containsKey("accion"))
  {
    rx_accion = doc["accion"].as<String>();
    rx_valor  = doc.containsKey("valor") ? doc["valor"].as<unsigned long>() : 0;
    accion_pendiente = true;
  }
}

// --- Inicialización MQTT ---
void setupMQTT()
{
  pinMode(pin_Motor1_1, OUTPUT);
  pinMode(pin_Motor1_2, OUTPUT);
  pinMode(pin_Motor2_1, OUTPUT);
  pinMode(pin_Motor2_2, OUTPUT);

  robot_detener();

  client.setServer(mqtt_server, MQTT_PORT);
  client.setCallback(funcionEscuchar);
  client.setBufferSize(512);    // evita descarte silencioso de payloads >256 bytes
  client.setKeepAlive(60);
  client.setSocketTimeout(10);
}

// --- Publicación de mensajes MQTT ---
void publicar_mensaje(const char *mensaje)
{
  if (client.connected())
  {
    client.publish("robots_publicando", mensaje);
    Serial.print("Publicado en [robots_publicando]: ");
    Serial.println(mensaje);
  }
  else
  {
    Serial.println("No se puede publicar - MQTT no conectado");
  }
}

void publicar_accion(const char *accion, const char *valor)
{
  if (client.connected())
  {
    char mensaje[100];
    sprintf(mensaje, "{\"accion\":\"%s\",\"valor\":\"%s\"}", accion, valor);
    publicar_mensaje(mensaje);
  }
}

// --- Conexión al Broker MQTT ---
bool connectMQTT()
{
  Serial.print("Intentando conectar a MQTT broker: ");
  Serial.println(mqtt_server);

  char clientId[30];
  if (strlen(char_Mac_ID) < 10)
    snprintf(clientId, sizeof(clientId), "%s-%lu", DEVICE_NAME, millis() % 10000);
  else
    snprintf(clientId, sizeof(clientId), "%s-%lu", char_Mac_ID, millis() % 1000);

  Serial.print("ID de cliente MQTT: ");
  Serial.println(clientId);

  if (client.connect(clientId))
  {
    Serial.println("Conectado al broker MQTT!");
    client.subscribe(mqtt_topic);
    Serial.print("Suscrito a: ");
    Serial.println(mqtt_topic);
    publicar_accion("conectado", "true");
    return true;
  }
  else
  {
    Serial.print("Fallo al conectar a MQTT, código de error=");
    Serial.println(client.state());

    switch (client.state())
    {
      case -1: Serial.println("ERROR: El servidor no respondió dentro del tiempo de espera"); break;
      case -2: Serial.println("ERROR: La red no está conectada"); break;
      case -3: Serial.println("ERROR: El servidor rechazó la conexión"); break;
      case -4: Serial.println("ERROR: ID de cliente no válido"); break;
      case -5: Serial.println("ERROR: Nombre de usuario/contraseña no válidos"); break;
      case -6: Serial.println("ERROR: No autorizado"); break;
      default:  Serial.println("ERROR: Desconocido"); break;
    }

    return false;
  }
}

#endif // MQTT_HANDLER_H
