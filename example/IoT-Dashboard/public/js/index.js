const baseUrl = "http://lrfia.uai.edu.ar:4100"
const form = document.getElementById("formLogin")
const msgLabel = document.getElementById("msg")

const onSubmitForm = async (event) => {
    event.preventDefault();
    let user = {
        username: event.srcElement[0].value,
        password: event.srcElement[1].value
    }
    const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    });
    const jsonData = await response.json();
    const msg = jsonData.msg
    localStorage.setItem('userName',jsonData.username)
    if (msg === "OK") {
        window.location.href = `./dashboard`
    }
    else {
        msgLabel.innerHTML = msg
    }

}
form.addEventListener("submit", onSubmitForm);