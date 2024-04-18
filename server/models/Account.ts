import mongoose, { Document, Schema } from 'mongoose';

export interface IAccount extends Document {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'user' | 'admin';
}

const accountSchema: Schema<IAccount> = new Schema<IAccount>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

const Account = mongoose.model<IAccount>('Account', accountSchema);

export default Account;
