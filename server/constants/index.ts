require('dotenv').config()
const ORIGIN = '*'
const PORT = process.env.PORT || 8000

// for "atlas" edit MONGO_URI in -> .env file || for "community server" edit <MyDatabase>
const MONGO_URI = process.env.MONGO_URI as string
const MONGO_OPTIONS = {}

const JWT_SECRET = process.env.JWT_SECRET as string

export {
  ORIGIN,
  PORT,
  MONGO_URI,
  MONGO_OPTIONS,
  JWT_SECRET,
}
