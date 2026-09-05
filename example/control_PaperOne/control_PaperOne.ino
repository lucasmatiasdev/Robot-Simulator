// Puente MQTT a Serie para Robots PaperOne XXI - Versión Modular
// Autor: Franco Balich (modificado)

#include "config.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"

// Variables globales para conexión
char char_Mac_ID[20]; // MAC address como array de char
String str_Mac_ID;    // MAC address como String

// Configuración de red WiFi
char *ssid = "";                 // SSID será seleccionado en elegir_WIFI
char *password = "";             // Password será seleccionado en elegir_WIFI
char *mqtt_server = MQTT_SERVER; // Servidor MQTT fijo para todas las redes
char mqtt_topic[50];             // Topic MQTT concatenando "topic/" + DEVICE_NAME
int red_nro = 0;                 // Índice para seleccionar la red WiFi

// Objetos para WiFi y MQTT
WiFiClient espClient;

// --- Configuración Inicial ---
void setup()
{
  Serial.begin(115200);
  Serial.println("\n\n===== Puente MQTT a Serie Simplificado - Versión Modular =====");

  // Calcular el topic MQTT concatenando "topic/" + DEVICE_NAME
  sprintf(mqtt_topic, "topic/%s", DEVICE_NAME);
  Serial.print("Topic MQTT calculado: ");
  Serial.println(mqtt_topic);

  // Inicializar WiFi
  setupWifi();

  // Inicializar MQTT
  setupMQTT();

  // Conectar
  if (connectWiFi())
  {
    connectMQTT();
  }
}

// --- Bucle Principal ---
void loop()
{
  static unsigned long ultimaReconexion = 0;
  const unsigned long tiempoEntreReconexiones = 5000; // 5 segundos entre intentos
  unsigned long ahora = millis();

  // Verificar conexión WiFi
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi desconectado. Intentando reconectar...");
    // Apagar LED cuando se pierde la conexión
    digitalWrite(LED_INTERNET_PIN, LOW);
    elegir_WIFI();
    if (!connectWiFi())
    {
      delay(RECONNECT_DELAY * 2);
      return;
    }
  }
  else
  {
    // Asegurarse de que el LED esté encendido mientras hay conexión
    digitalWrite(LED_INTERNET_PIN, HIGH);
  }

  // Verificar conexión MQTT - con límite de frecuencia para evitar saturación
  if (!client.connected() && (ahora - ultimaReconexion >= tiempoEntreReconexiones))
  {
    ultimaReconexion = ahora;
    Serial.println("MQTT desconectado. Intentando reconectar...");

    // Parpadeo rápido: WiFi ok pero MQTT reconectando
    for (int i = 0; i < 5; i++)
    {
      digitalWrite(LED_INTERNET_PIN, HIGH); delay(100);
      digitalWrite(LED_INTERNET_PIN, LOW);  delay(100);
    }

    bool reconectado = false;
    for (int i = 0; i < MAX_RECONNECT_ATTEMPTS; i++)
    {
      if (connectMQTT())
      {
        reconectado = true;
        break;
      }
      delay(RECONNECT_DELAY);
    }

    if (!reconectado)
    {
      Serial.println("No se pudo reconectar después de varios intentos. Esperando...");
    }
  }

  // Procesar mensajes MQTT si estamos conectados
  if (client.connected())
  {
    client.loop();
  }

  // Ejecutar acción pendiente en el loop principal, no en el callback MQTT
  if (accion_pendiente)
  {
    accion_pendiente = false;
    acciones_robot();
  }

  // Breve pausa para estabilidad
  delay(10);
}