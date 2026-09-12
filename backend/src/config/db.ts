import mongoose from "mongoose";

const getMongoUri = () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment");
  }

  return uri;
};

export const connectDB = async () => {
  const connection = await mongoose.connect(getMongoUri(), {
    dbName: "healthgate",
  });

  console.log(`MongoDB connected: ${connection.connection.host} (DB: ${connection.connection.name})`);
};
