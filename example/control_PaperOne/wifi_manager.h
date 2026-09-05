#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "config.h"

#define LED_INTERNET_PIN 2

// Tabla de redes conocidas (agregar o quitar redes acá)
const char* ssids_conocidos[]     = {"LAB-ROBOTICA", "UAI-FI", "iPhoneFranco", "InnovativaLab"};
const char* passwords_conocidos[] = {"LabRoboticaUAI", "AccesosUAI", "francowifi", "franco131098"};
const int   TOTAL_REDES_CONOCIDAS = 4;

// Subconjunto de redes conocidas detectadas en el último escaneo
int redes_disponibles[4];
int total_redes_disponibles = 0;
int idx_red_actual = 0;

// --- Función para obtener MAC de forma robusta ---
bool obtenerMAC()
{
  const int MAX_INTENTOS = 5;
  const int DELAY_ENTRE_INTENTOS = 500;

  for (int intento = 0; intento < MAX_INTENTOS; intento++)
  {
    str_Mac_ID = WiFi.macAddress();

    if (str_Mac_ID != "00:00:00:00:00:00" && str_Mac_ID.length() >= 17)
    {
      str_Mac_ID.toCharArray(char_Mac_ID, sizeof(char_Mac_ID));
      Serial.print("MAC Address: ");
      Serial.println(str_Mac_ID);
      return true;
    }

    Serial.print("Intento ");
    Serial.print(intento + 1);
    Serial.print("/");
    Serial.print(MAX_INTENTOS);
    Serial.print(" - MAC inválida: ");
    Serial.println(str_Mac_ID);

    if (intento < MAX_INTENTOS - 1)
      delay(DELAY_ENTRE_INTENTOS);
  }

  Serial.println("ERROR: No se pudo obtener una MAC válida");
  return false;
}

// --- Escanea redes y filtra las que coinciden con la lista conocida ---
void escanearRedes()
{
  Serial.print("Escaneando redes WiFi... ");
  int n = WiFi.scanNetworks();
  total_redes_disponibles = 0;
  idx_red_actual = 0;

  // Imprimir todas las redes encontradas en una sola línea
  Serial.print("En el aire: ");
  for (int i = 0; i < n; i++)
  {
    if (i > 0) Serial.print(", ");
    Serial.print(WiFi.SSID(i));
  }
  Serial.println();

  // Filtrar solo las que están en nuestra tabla
  for (int k = 0; k < TOTAL_REDES_CONOCIDAS; k++)
  {
    for (int i = 0; i < n; i++)
    {
      if (WiFi.SSID(i).equals(ssids_conocidos[k]))
      {
        redes_disponibles[total_redes_disponibles++] = k;
        break;
      }
    }
  }

  // Imprimir las que vamos a intentar
  Serial.print("Conocidas disponibles: ");
  if (total_redes_disponibles == 0)
  {
    Serial.println("ninguna");
  }
  else
  {
    for (int i = 0; i < total_redes_disponibles; i++)
    {
      if (i > 0) Serial.print(", ");
      Serial.print(ssids_conocidos[redes_disponibles[i]]);
    }
    Serial.println();
  }

  WiFi.scanDelete();
}

// --- Selecciona la siguiente red disponible de forma cíclica ---
void elegir_WIFI()
{
  digitalWrite(LED_INTERNET_PIN, LOW);

  if (total_redes_disponibles == 0)
  {
    Serial.println("Sin redes conocidas en el aire. Re-escaneando...");
    escanearRedes();
    if (total_redes_disponibles == 0)
    {
      Serial.println("Ninguna red conocida detectada. Verificar entorno WiFi.");
      return;
    }
  }

  int k = redes_disponibles[idx_red_actual % total_redes_disponibles];
  ssid     = (char*)ssids_conocidos[k];
  password = (char*)passwords_conocidos[k];
  idx_red_actual = (idx_red_actual + 1) % total_redes_disponibles;

  mqtt_server = MQTT_SERVER;

  Serial.print(millis());
  Serial.print(": SSID seleccionado: ");
  Serial.println(ssid);
}

// --- Inicialización de WiFi ---
void setupWifi()
{
  pinMode(LED_INTERNET_PIN, OUTPUT);
  digitalWrite(LED_INTERNET_PIN, LOW);

  WiFi.persistent(false);       // no guardar credenciales en flash
  WiFi.setAutoReconnect(false); // la reconexión la manejamos nosotros
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);         // deshabilitar power-saving WiFi

  // Escanear redes disponibles y seleccionar la primera conocida
  escanearRedes();
  elegir_WIFI();

  delay(100);

  if (!obtenerMAC())
    Serial.println("Advertencia: MAC no obtenida en setup, se intentará después de conectar");
}

// --- Conecta a WiFi ---
bool connectWiFi()
{
  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);

  for (int i = 0; i < 3; i++)
  {
    digitalWrite(LED_INTERNET_PIN, HIGH);
    delay(100);
    digitalWrite(LED_INTERNET_PIN, LOW);
    delay(100);
  }

  WiFi.disconnect(true);
  delay(200);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40)  // ~10 segundos
  {
    digitalWrite(LED_INTERNET_PIN, !digitalRead(LED_INTERNET_PIN));
    delay(250);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println();
    Serial.print("WiFi conectado! IP: ");
    Serial.print(WiFi.localIP());
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    if (str_Mac_ID == "" || str_Mac_ID == "00:00:00:00:00:00")
    {
      Serial.println("Obteniendo MAC después de conexión exitosa...");
      obtenerMAC();
    }

    digitalWrite(LED_INTERNET_PIN, HIGH);
    return true;
  }
  else
  {
    Serial.println("\nFallo al conectar WiFi.");
    digitalWrite(LED_INTERNET_PIN, LOW);
    return false;
  }
}

#endif // WIFI_MANAGER_H
