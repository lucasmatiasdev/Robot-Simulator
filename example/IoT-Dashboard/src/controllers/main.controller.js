import { response } from "express"

export const getWebPage = async (req, res = response, next) => {
  try {
    res.sendFile("index.html", { root: "public" });
  } catch (err) {
    console.log(err)
    res.status(401).send('Error in end point')
  }
}

export const getTools = async (req, res = response, next) => {
  try {
    res.sendFile("tools.html", { root: "public/pages" });
  } catch (err) {
    console.log(err)
    res.status(401).send('Error in end point')
  }
}

export const getDashboard = async (req, res = response, next) => {
  try {
    res.sendFile("dashboard.html", { root: "public/pages" });
  } catch (err) {
    console.log(err)
    res.status(401).send('Error in end point')
  }
}
export const getDemo = async (req, res = response, next) => {
  try {
    let result = {
      msg: "End point is working"
    }
    res.status(200).send(result)
  } catch (err) {
    console.log(err)
    res.status(401).send('Error in end point')
  }
}
