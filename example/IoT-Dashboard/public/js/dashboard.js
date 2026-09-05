const baseUrl = "http://lrfia.uai.edu.ar:4100"
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const btnConectar = document.getElementById("btnConectar");
const btnLimpiar = document.getElementById("btnLimpiar");
const status_mqtt = document.getElementById("status_mqtt");
const nameInput = document.getElementById("userName")
const userMqtt = document.getElementById('userMqtt')
const passMqtt = document.getElementById('passMqtt')
const hostMqtt = document.getElementById('hostMqtt')
const portMqtt = document.getElementById('portMqtt')
const topic_sub = document.getElementById('topic_sub')
const topic_pub = document.getElementById('topic_pub')
const text_mensaje = document.getElementById("text_mensaje")
const text_led = document.getElementById("text_led")
const text_servo = document.getElementById("text_servo")
const text_buzzer = document.getElementById("text_buzzer")
const text_motor_pap = document.getElementById("text_motor_pap")
const text_display_i2c = document.getElementById("text_display_i2c")

const sub_temperatura = document.getElementById("sub_temperatura")
const sub_humedad = document.getElementById("sub_humedad")
const sub_iluminacion = document.getElementById("sub_iluminacion")
const sub_distancia = document.getElementById("sub_distancia")
const sub_control = document.getElementById("sub_control")
const sub_mensaje = document.getElementById("sub_mensaje")

const sensor_1 = document.getElementById("sensor_1")
const sensor_2 = document.getElementById("sensor_2")
const sensor_3 = document.getElementById("sensor_3")
const sensor_4 = document.getElementById("sensor_4")

const actuador_1 = document.getElementById("actuador_1")
const actuador_2 = document.getElementById("actuador_2")
const actuador_3 = document.getElementById("actuador_3")
const actuador_4 = document.getElementById("actuador_4")

const historial_1 = document.getElementById("historial_1")
const historial_2 = document.getElementById("historial_2")
const historial_3 = document.getElementById("historial_3")
const historial_4 = document.getElementById("historial_4")

const localUsername = localStorage.getItem('userName') || 'none'


const accion_1 = document.getElementById("accion_1")
const accion_2 = document.getElementById("accion_2")
const accion_3 = document.getElementById("accion_3")
const accion_4 = document.getElementById("accion_4")
const emocion = document.getElementById("emocion")
const hablar= document.getElementById("hablar")

const text_accion_1 = document.getElementById("text_accion_1")
const text_accion_2 = document.getElementById("text_accion_2")
const text_accion_3 = document.getElementById("text_accion_3")
const text_accion_4 = document.getElementById("text_accion_4")
const text_emocion = document.getElementById("text_emocion")
const text_hablar = document.getElementById("text_hablar")

const text_ojo_izquierdo_x = document.getElementById("text_ojo_izquierdo_x")
const text_ojo_izquierdo_y = document.getElementById("text_ojo_izquierdo_y")
const text_ojo_izquierdo_p = document.getElementById("text_ojo_izquierdo_p")

const text_ojo_derecho_x = document.getElementById("text_ojo_derecho_x")
const text_ojo_derecho_y = document.getElementById("text_ojo_derecho_y")
const text_ojo_derecho_p = document.getElementById("text_ojo_derecho_p")

const text_cuello = document.getElementById("text_cuello")

function validate(evt) {
    var theEvent = evt || window.event;

    // Handle paste
    if (theEvent.type === 'paste') {
        key = event.clipboardData.getData('text/plain');
    } else {
        // Handle key press
        var key = theEvent.keyCode || theEvent.which;
        key = String.fromCharCode(key);
    }
    var regex = /[0-9]|\./;
    if (!regex.test(key)) {
        theEvent.returnValue = false;
        if (theEvent.preventDefault) theEvent.preventDefault();
    }
}

btnConectar.addEventListener("click", function () {
    //alert("Hello!");
    if (topic_pub.value !== "" && topic_sub.value !== "") {
        if (btnConectar.textContent === "Conectar") {
            if (btnConectar.textContent != "Conectando") {
                Conectar_MqTT(hostMqtt.value, portMqtt.value, userMqtt.value, passMqtt.value, topic_sub.value, topic_pub.value)
                btnConectar.textContent = "Conectando"
            }

        } else {
            socket.emit("disconnect_mqtt", "");
        }
    }
    else{
        //status_mqtt.innerText="No se pudo suscribir al topic"
        status_mqtt.innerHTML=`<p class="error">No se pudo suscribir al topic</p>`
    }
});

const socket = io.connect(baseUrl, { forceNew: true });

const setName = () => {
    if (localUsername !== "none") {
        //const username = urlParams.get('username')
        nameInput.innerText = localUsername
        topic_sub.value = localUsername + "/topic_sub"
        topic_pub.value = localUsername + "/topic_pub"
    }

}
setName()

//front end
/*
socket.on("messages", function (data) {
    console.log(data);
    socket.emit("new-message", "Hola desde el cliente");
});*/

socket.on("subscribir_mqtt", function (topic, data) {
    console.log("subscribir", topic, data);
    let json = JSON.parse(data)
    let now = new Date();
    if (json.tipo === "temperatura") {
        sub_temperatura.innerHTML = json.valor
    }
    else if (json.tipo === "humedad") {
        sub_humedad.innerHTML = json.valor
    }
    else if (json.tipo === "iluminacion") {
        sub_iluminacion.innerHTML = json.valor
    }
    else if (json.tipo === "distancia") {
        sub_distancia.innerHTML = json.valor
    }
    else if (json.tipo === "control") {
        sub_control.innerHTML = json.valor
    }
    else if (json.tipo === "mensaje") {
        sub_mensaje.innerHTML = json.valor
    }
    else if (json.tipo === "sensor_1") {
        sensor_1.value = json.valor
        historial_1.innerHTML = now.toTimeString().split(" ")[0] + "> " + json.valor + "\n" + historial_1.innerHTML
    }
    else if (json.tipo === "sensor_2") {
        sensor_2.value = json.valor
        historial_2.innerHTML = now.toTimeString().split(" ")[0] + "> " + json.valor + "\n" + historial_2.innerHTML
    }
    else if (json.tipo === "sensor_3") {
        sensor_3.value = json.valor
        historial_3.innerHTML = now.toTimeString().split(" ")[0] + "> " + json.valor + "\n" + historial_3.innerHTML
    }
    else if (json.tipo === "sensor_4") {
        sensor_4.value = json.valor
        historial_4.innerHTML = now.toTimeString().split(" ")[0] + "> " + json.valor + "\n" + historial_4.innerHTML
    }
    else if (json.tipo === "grafico_1") {
        // console.log("grafico " + json.value)
        grafico_1(json.valor)
    }
    else if (json.tipo === "grafico_2") {
        // console.log("grafico " + json.value)
        grafico_2(json.valor)
    }
});


socket.on("status_mqtt", function (data) {
    console.log(data);
    status_mqtt.innerHTML = `<p class="success">${data}</p>`
    if (data === "connected") {
        console.log("dashboard: Server MqTT conectado ok");
        btnConectar.innerHTML = "Desconectar"
        btnConectar.style.backgroundColor = "green"

    }
    else if (data === "disconnected") {
        btnConectar.innerHTML = "Conectar"
        btnConectar.style.backgroundColor = "red"
        console.log("dashboard: Server MqTT desconectado ok");
    }

});

function limpiar(data) {
    if (data === "historial_1") {
        historial_1.innerHTML = ""
    }
    else if (data === "historial_2") {
        historial_2.innerHTML = ""
    }
    else if (data === "historial_3") {
        historial_3.innerHTML = ""
    }
    else if (data === "historial_4") {
        historial_4.innerHTML = ""
    }
}
function Conectar_MqTT(host, port, user, pass, topic_sub, topic_pub) {
    data = {
        "host": host,
        "port": port,
        "user": user,
        "pass": pass,
        "topic_sub": topic_sub,
        "topic_pub": topic_pub
    }
    console.log(data)
    socket.emit("connect_mqtt", data);
}

function publicar_mqtt(data) {
    //alert(topic_pub + ", " + data)
    socket.emit("publicar_mqtt", topic_pub.value, data);
}


function publicar(tipo) {
    //alert(tipo)
    let data = ""
    if (tipo === "mensaje") {
        data = {
            "tipo": tipo,
            "valor": text_mensaje.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "led") {
        data = {
            "tipo": tipo,
            "valor": text_led.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "servo_motor") {
        data = {
            "tipo": tipo,
            "valor": text_servo.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "buzzer") {
        data = {
            "tipo": tipo,
            "valor": text_buzzer.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "motor_pap") {
        data = {
            "tipo": tipo,
            "valor": text_motor_pap.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "display_i2c") {
        data = {
            "tipo": tipo,
            "valor": text_display_i2c.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "actuador_1") {
        data = {
            "tipo": tipo,
            "valor": actuador_1.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "actuador_2") {
        data = {
            "tipo": tipo,
            "valor": actuador_2.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "actuador_3") {
        data = {
            "tipo": tipo,
            "valor": actuador_3.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "actuador_4") {
        data = {
            "tipo": tipo,
            "valor": actuador_4.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "accion_1") {
        data = {
            "tipo": "accion",
            "valor": text_accion_1.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "accion_2") {
        data = {
            "tipo": "accion",
            "valor": text_accion_2.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "accion_3") {
        data = {
            "tipo": "accion",
            "valor": text_accion_3.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "accion_4") {
        data = {
            "tipo": "accion",
            "valor": text_accion_4.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "emocion") {
        data = {
            "tipo": "emocion",
            "valor": text_emocion.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "hablar") {
        data = {
            "tipo": "hablar",
            "valor": text_hablar.value
        }
        publicar_mqtt(data)
        TexttoSpeech(text_hablar.value)
    }
    else if (tipo === "ojo_izquierdo"){
        data = {
            "tipo":"ojo_izquierdo",
            "x":text_ojo_izquierdo_x.value,
            "y":text_ojo_izquierdo_y.value,
            "p":text_ojo_izquierdo_p.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "ojo_derecho"){
        data = {
            "tipo":"ojo_derecho",
            "x":text_ojo_derecho_x.value,
            "y":text_ojo_derecho_y.value,
            "p":text_ojo_derecho_p.value
        }
        publicar_mqtt(data)
    }
    else if (tipo === "cuello") {
        data = {
            "tipo": "cuello",
            "valor": text_cuello.value
        }
        publicar_mqtt(data)
    }
}

var rndColor = function () {
    return '#' + (Math.random().toString(16) + '0000000').slice(2, 8);
};



function grafico_1(sensores) {
    // Obtener una referencia al elemento canvas del DOM
    const grafica = document.getElementById("grafico_1");
    // Las etiquetas son las que van en el eje X. 
    var etiquetas = []
    for (var i = 0; i < sensores.length; i++) {
        etiquetas[i] = i;
    }
    // Podemos tener varios conjuntos de datos. Comencemos con uno
    const datos = {
        label: "Sensores",
        data: sensores, // La data es un arreglo que debe tener la misma cantidad de valores que la cantidad de etiquetas
        backgroundColor: [rndColor(), rndColor(), rndColor(), rndColor(), rndColor(), rndColor()],
        borderWidth: 1,// Ancho del borde
        fillColor: rndColor(),
        strokeColor: rndColor(),
        highlightFill: rndColor(),
        highlightStroke: rndColor(),
    };
    new Chart(grafica, {
        type: 'bar',// Tipo de gráfica
        data: {
            labels: etiquetas,
            datasets: [
                datos,
            ]
        },
        options: {
            responsive: true,
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }],
            },
            plugins: {
                legend: false, // Hide legend
            },
        }
    });
}
grafico_1([10, 20, 100, 50])

function grafico_2(sensores) {
    var etiquetas = []
    for (var i = 0; i < sensores.length; i++) {
        etiquetas[i] = i;
    }
    var data = {
        labels: etiquetas,
        datasets: [
            {
                data: sensores,
                backgroundColor: ["red", "orange", "green", "blue", "violet"],
            }
        ]
    };
    var myChart = new Chart(document.getElementById('grafico_2'), {
        type: 'doughnut',
        data: data,
        options: {
            //cutoutPercentage: 50,
            maintainAspectRatio: true,
            responsive: true,
            legend: {
                display: false
            },
            animation: {
                animateScale: true,
                animateRotate: true
            },
        },
        plugins: [{
            id: 'total',
            beforeDraw: function (chart) {
                const width = chart.chart.width;
                const height = chart.chart.height;
                const ctx = chart.chart.ctx;
                ctx.restore();
                const fontSize = (height / 114).toFixed(2);
                ctx.font = fontSize + "em sans-serif";
                ctx.textBaseline = 'middle';
                var total = data.datasets[0].data.reduce(function (previousValue, currentValue, currentIndex, array) {
                    return previousValue + currentValue;
                });
                const text = total;
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 2;
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        }]
    });
}
grafico_2([30, 220, 100, 50])

function TexttoSpeech(text) {
    var speech = new SpeechSynthesisUtterance();

    if ("speechSynthesis" in window) {
        if (text.trim() != "") {
            speech.text = text;
            speech.rate = 1;
            speech.pitch = 10;
            speech.lang = "es-ES";
            speechSynthesis.speak(speech);
        } else {
            alert("Please Enter Text");
        }
    } else {
        // Speech Synthesis Not Supported 😣
        alert("Sorry, your browser doesn't support text to speech!");
    }
} 