import mongoose from "mongoose";

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in the environment");
  }

  return uri;
};

export const connectDB = async () => {
  const connection = await mongoose.connect(getMongoUri());

  console.log(`MongoDB connected: ${connection.connection.host}`);
};
