import { corsConfig } from './middleware/corsConfig.js'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http';
import { Server } from "socket.io";
import { mainRouter } from './routes/main.route.js'
import { loginRouter } from './routes/login.route.js'
import * as mqtt from 'mqtt'
dotenv.config()
const PORT = process.env.PORT || 4100
let topic_sub = ""
let topic_pub = ""

// Configuración del server
const app = express()
app.use(express.json())
app.use(express.static("public"));

// Configuración del server socket
const server = createServer(app);
const io = new Server(server,{
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuración del cors
app.use(corsConfig)

// Rutas
app.use('/', mainRouter);
app.use('/', loginRouter);

// Endpoints
app.use('/', (req, res) => {
  return res.status(200).json({
    msg: 'Backend IoT Dashboard'
  })
})
app.use((req, res, next) => {
  res.status(404).json({
    message: 'Endpoint not found'
  })
})/*
app.listen(PORT, () =>
  console.log(`Es servidor se esta ejecutando en el puerto:${PORT}`)
)*/

server.listen(PORT, function () {
  console.log(`Es servidor se esta ejecutando en el puerto:${PORT}`)
});
//backend

io.on("connection", function (socket) {
      console.log("Un cliente se ha conectado");
      //socket.emit("messages", "Hola desde el backend");
      // socket.emit("status_mqtt", "Connected Socket");
  /*
  socket.on("new-message", function (data) {
      console.log(data);
  });*/

  socket.on("connect_mqtt", function (data) {
    console.log("backend:" + data);
    // MQTT
    // http://www.steves-internet-guide.com/using-node-mqtt-client/
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`
    const options = {
      clientId: clientId,
      username: data.user,
      password: data.pass,
      port: data.port,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      clean: true
    };
    topic_sub = data.topic_sub
    topic_pub = data.topic_pub
 
    const client_mqtt = mqtt.connect(data.host, options)
    
    // let subscript = false
    client_mqtt.on("connect", function () {
          console.log("Mqtt connected  " + client_mqtt.connected);
          socket.emit("status_mqtt", "connected")
          // client_mqtt.subscribe(topic_sub);
          client_mqtt.subscribe([topic_sub], () => {
            console.log(`Subscribe to topic '${topic_sub}'`)
          })
        // console.log("subscripto  " + topic_sub)
        // var topic_list=["topic2","topic3","message"]
        // subscript = true
      // }
    })

    //envia los mensajes mqtt al fron end
     client_mqtt.on("message",function(topic, message, packet){
          console.log("topic is "+ topic);
          console.log("message is "+ message);
          // let myJSON = JSON.stringify(message);
          socket.emit("subscribir_mqtt", topic,message.toString())
        });

    socket.on("disconnect_mqtt", function (data) {
      // if (client_mqtt.connected===true){
        socket.emit("status_mqtt", "disconnected")
        client_mqtt.end()
        console.log("Mqtt disconnected  " + client_mqtt.connected);
        // subscript = false
      // }else{
      //   console.log("No se pudo desconectar MqTT")
      // }
    });

    socket.on('publicar_mqtt', function (topic_pub,data) {
      if (client_mqtt.connected===true){
        let myJSON = JSON.stringify(data);
        console.log("function (topic_pub,data)", topic_pub, myJSON)
        client_mqtt.publish(topic_pub, myJSON)
      }
    });
    
  });



  // client.on("error", function (error) {
  //   console.log("Can't connect" + error)
  // })

  // client.on('message',function(topic, message, packet){
  //   console.log("> message is "+ message);
  //   console.log("> topic is "+ topic);
  //   console.log("> " + JSON.stringify(packet));
  // });

});







   

  // if (client.connected==true){

  // }