import { response } from "express"
import { readJson } from "../helpers/jsonManager.js"

export const postLogin = async (req, res = response, next) => {
  try {
    const user = req.body
    const users = await readJson('users.json')

    for (let index = 0; index < users.length; index++) {
      const dbUser = users[index];

      if (user.username === dbUser.username) {

        if (user.password === dbUser.password) {
          return res.status(200).json({
            msg: 'OK',
            username: dbUser.username
          })
        }
        // msg.value = "Alguno de los datos ingresados es incorrecto."
        return res.status(404).json({
          msg: "Uno de los datos ingresados es incorrecto."
        })
      }
    }
    return res.status(404).json({
      msg: "Uno de los datos ingresados es incorrecto."
    })
  } catch (err) {
    console.log(err)
    res.status(401).send('Error in end point')
  }
}