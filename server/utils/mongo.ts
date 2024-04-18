import mongoose, { ConnectOptions } from 'mongoose';
import { MONGO_URI, MONGO_OPTIONS } from '../constants';

interface IMongoDB {
  mongoose: typeof mongoose;
  isConnected: boolean;
  MONGO_URI: string;
  MONGO_OPTIONS: ConnectOptions;
  connect(): Promise<void>;
}

class MongoDB implements IMongoDB {
  mongoose: typeof mongoose;
  isConnected: boolean;
  MONGO_URI: string;
  MONGO_OPTIONS: ConnectOptions;

  constructor() {
    this.mongoose = mongoose;
    this.isConnected = false;
    this.MONGO_URI = MONGO_URI as string;
    this.MONGO_OPTIONS = MONGO_OPTIONS;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      const db = await this.mongoose.connect(this.MONGO_URI, this.MONGO_OPTIONS);
      const connection = db.connection;

      this.isConnected = connection.readyState === 1;
      if (this.isConnected) console.log('✅ MongoDB connected');

      connection.on('connected', () => console.log('✅ MongoDB connected')); // re-connected
      connection.on('disconnected', () => console.log('❌ MongoDB disconnected')); // disconnected
      connection.on('error', (error) => console.log('❌ MongoDB connection error', error)); // listen for errors during the session
    } catch (error) {
      console.log('❌ MongoDB connection error:', (error as {message: string}).message);
    }
  }
}

const mongoDB = new MongoDB();

export default mongoDB;
