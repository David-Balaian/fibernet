require('dotenv').config() 
import mongo from './utils/mongo' 
import {PORT} from './constants'
import authRoutes from './routes/auth'
import app from './utils/app'

async function bootstrap() {
  await mongo.connect()

  // app.get('/', (req: Request, res: Response) => res.status(200).json({message: 'Hello World!'}))
  // app.get('/healthz', (req, res) => res.status(200).send())
  app.use('/auth', authRoutes)

  app.listen(PORT, () => {
    console.log(`✅ Server is listening on port: ${PORT}`)
  })
}

bootstrap()
