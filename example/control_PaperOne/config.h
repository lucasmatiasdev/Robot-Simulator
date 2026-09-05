#ifndef CONFIG_H
#define CONFIG_H

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Configuración del Dispositivo ---
#define DEVICE_NAME "robot_1"                   // ID del robot: "robot_1":Rojo, "robot_2":Verde, "robot_3":Rosa, "robot_4":Amarillo, "robot_5":Azul, "robot_6":Negro
#define MQTT_SERVER "168.226.218.194" // Servidor MQTT fijo para todas las redes
#define MQTT_PORT   8741               // Puerto del broker MQTT
// No definimos MQTT_TOPIC como macro, será calculado en tiempo de ejecución

// --- Variables Globales para Conexión ---
extern char char_Mac_ID[20]; // MAC address como array de char
extern String str_Mac_ID;    // MAC address como String

extern char *ssid;          // SSID de la red WiFi
extern char *password;      // Contraseña de la red WiFi
extern char *mqtt_server;   // Dirección del servidor MQTT
extern int red_nro;         // Índice para seleccionar la red WiFi
extern char mqtt_topic[50]; // Topic MQTT calculado dinámicamente

// --- Objetos WiFi y MQTT ---
extern WiFiClient espClient;
extern PubSubClient client;

// --- Constantes ---
const int MAX_RECONNECT_ATTEMPTS = 3;
const int RECONNECT_DELAY = 500;

// --- Declaraciones de funciones ---
// WiFi
void setupWifi();
void elegir_WIFI();
bool connectWiFi();

// MQTT
void setupMQTT();
void funcionEscuchar(char *topic, byte *payLoad, unsigned int length);
bool connectMQTT();
void acciones_robot();
void publicar_accion(const char *accion, const char *valor);
void publicar_mensaje(const char *mensaje);

#endif // CONFIG_H