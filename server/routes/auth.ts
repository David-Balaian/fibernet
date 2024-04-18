import express from 'express'
import { register } from '../controllers/auth/register'
import { login } from '../controllers/auth/login'

// initialize router
const router = express.Router()

// POST at route: http://localhost:8080/auth/register
router.post('/register', [], register)

// POST at path: http://localhost:8080/auth/login
router.post('/login', [], login)

export default router
