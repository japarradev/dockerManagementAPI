import express from 'express'
import nodemailer from 'nodemailer'

const router = express.Router()

router.post('/send-email', async (req, res) => {
  const {
    SMTPHost,
    SenderName,
    SenderAddress,
    Secure,
    Port,
    Authentication,
    UserName,
    Password,
    MailRecipient,
    Subject,
    HTMLText
  } = req.body

  try {
    // Validate required fields
    if (!SMTPHost || !SenderName || !SenderAddress || !Port || !MailRecipient || !Subject || !HTMLText) {
      return res.status(400).send({ error: 'Missing required fields' })
    }

    // Create the transporter
    const transporter = nodemailer.createTransport({
      host: SMTPHost,
      port: Port,
      secure: Secure === 1, // true for secure connection, false otherwise
      auth: Authentication === 1
        ? {
            user: UserName,
            pass: Password
          }
        : undefined
    })

    // Prepare the email options
    const mailOptions = {
      from: `"${SenderName}" <${SenderAddress}>`,
      to: MailRecipient.map(recipient => `${recipient.Name} <${recipient.Address}>`).join(', '),
      subject: Subject,
      html: HTMLText
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions)

    res.status(200).send({ message: 'Email sent successfully', info })
  } catch (error) {
    res.status(500).send({ error: `Failed to send email: ${error.message}` })
  }
})

export default router
