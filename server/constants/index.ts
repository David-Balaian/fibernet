require('dotenv').config()
const ORIGIN = '*'
const PORT = process.env.PORT || 8000

const username: string = encodeURIComponent(process.env.MONGO_USERNAME as string);
const password: string = encodeURIComponent(process.env.MONGO_PASSWORD as string);
const clusterUrl: string = `${process.env.MONGO_HOSTNAME}:${process.env.MONGO_PORT}/${process.env.DB_NAME}?authMechanism=DEFAULT&authSource=admin`;
const MONGO_URI = `mongodb://${username}:${password}@${clusterUrl}`;
const MONGO_OPTIONS = {}

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRATION = process.env.JWT_EXPIRATION as string

export {
  ORIGIN,
  PORT,
  MONGO_URI,
  MONGO_OPTIONS,
  JWT_SECRET,
  JWT_EXPIRATION
}