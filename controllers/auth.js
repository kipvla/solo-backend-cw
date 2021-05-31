const User = require('../models/user')
const bcrypt = require('bcryptjs')
const defaultConfig = require('../db/default.json')
const { validateEmail } = require('../utils/index')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const Stripe = require('stripe')
const stripe = new Stripe(defaultConfig.secretAPITestStripe, {
  apiVersion: '2020-08-27',
})

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: defaultConfig.emailProvider,
    pass: defaultConfig.emailPW,
  },
})

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(401).send('Invalid username or password!')
    const hashedUserPW = user.password
    const isMatch = await bcrypt.compare(password, hashedUserPW)
    if (!isMatch) return res.status(401).send('Invalid username or password!')
    if (!user.verified)
      return res.status(401).send('You need to verify your account!')

    const userPayload = {
      user: {
        id: user._id,
      },
    }

    jwt.sign(
      userPayload,
      defaultConfig.jwtSecret,
      { expiresIn: 3600 },
      (err, token) => {
        if (err) throw err
        res.status(200).json({ token })
      },
    )
  } catch (e) {
    res.status(500).send('Internal Server Error!')
  }
}

exports.register = async (req, res) => {
  try {
    const {
      email = email.trim().toLowerCase(),
      password,
      passwordRepeat,
    } = req.body
    // Backend validation just in case
    if (!validateEmail(email)) {
      return res.status(400).send('Email is not valid!')
    }
    const user = await User.findOne({ email })
    if (user) {
      return res.status(409).send('User already exists!')
    }
    if (password.length < 6) {
      return res
        .status(400)
        .send('Password should be at least 6 characters long!')
    }
    if (password !== passwordRepeat) {
      return res.status(400).send("Passwords don't match!")
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const customer = await stripe.customers.create({ name: email })
    const newUser = await User.create({
      email,
      password: hashedPassword,
      stripeID: customer.id,
    })

    const payload = {
      user: {
        id: newUser._id,
      },
    }

    jwt.sign(
      payload,
      defaultConfig.jwtSecret,
      { expiresIn: '9999 years' },
      async (err, token) => {
        if (err) throw err
        res.send('User created successfully!')
        const output = `
        <h2>Please click on the following link to verify your account.</h2>
        <p>${defaultConfig.serverURL}/auth/confirmation/${token}</p>
        <p><b>NOTE: </b> Link will expire in one (1) hour.</p>
        `
        await transporter.sendMail({
          to: email,
          subject: 'Account Verfication - Brand X',
          html: output,
        })
      },
    )
  } catch (e) {
    console.log(e)
    res.status(500).send('Internal Server Error!')
  }
}

exports.verifyEmail = async (req, res) => {
  try {
    const decodedJWT = jwt.verify(req.params.token, defaultConfig.jwtSecret)
    const userID = decodedJWT.user.id
    const user = await User.findById(userID)
    if (!user.verified) {
      await User.updateOne(
        { _id: userID },
        {
          $set: { verified: true },
        },
      )
      return res.status(200).send('Verified successfully!')
    }
    return res.status(200).send('User is already verified!')
  } catch (e) {
    res.status(500).send('Internal Server Error!')
  }
}

exports.forgotPW = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user)
      res.status(200).send('Email was sent (if it exists) with a code!')

    const randomNumber = Math.floor(100000 + Math.random() * 900000)
    const payload = {
      user: {
        id: user._id,
        code: randomNumber,
      },
    }
    jwt.sign(
      payload,
      defaultConfig.jwtSecret,
      { expiresIn: 60 },
      async (err, token) => {
        if (err) throw err
        await User.updateOne(
          { _id: user._id },
          {
            $set: { forgotPWToken: token },
          },
        )
        res.send('Email was sent (if it exists) with a code!')
        const output = `
        <h2>Your code to reset your password is the following: ${randomNumber}</h2>
        <p><b>NOTE: </b> The code will expire in 1 (one) minute.</p>
        `
        await transporter.sendMail({
          to: email,
          subject: 'Change password code - Brand X',
          html: output,
        })
      },
    )
  } catch (e) {
    console.log(e)
    res.status(500).send('Internal Server Error!')
  }
}

exports.verifyPWCodeChange = async (req, res) => {
  try {
    const { email, code } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(401).send('Invalid code!')
    const decodedJWTCode = jwt.verify(
      user.forgotPWToken,
      defaultConfig.jwtSecret,
    )
    if (decodedJWTCode.user.code !== code)
      return res.status(401).send('Invalid code!')

    const payload = {
      user: {
        id: user._id,
      },
    }
    // 2 minutes to change pw
    jwt.sign(
      payload,
      defaultConfig.jwtSecret,
      { expiresIn: 120 },
      async (err, token) => {
        if (err) throw err
        res.status(200).send({ token })
      },
    )
  } catch (e) {
    if (e.name) {
      console.log(e)
      return res.status(401).send('Token expired!')
    }
    res.status(500).send('Internal Server Error!')
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { password, passwordRepeat } = req.body
    if (password.length < 6) {
      return res
        .status(400)
        .send('Password should be at least 6 characters long!')
    }
    if (password !== passwordRepeat) {
      return res.status(400).send("Passwords don't match!")
    }
    const userID = req.user.id
    const salt = await bcrypt.genSalt(10)
    const newPassword = await bcrypt.hash(password, salt)
    await User.updateOne(
      { _id: userID },
      {
        $set: { password: newPassword },
      },
    )
    return res.status(200).send('Password changed succesfully!')
  } catch (e) {
    res.status(500).send({ msg: 'Internal server error!', statusCode: 500 })
  }
}
