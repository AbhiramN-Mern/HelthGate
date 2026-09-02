import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const adminSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    department: {
      type: String,
      default: "operations",
      trim: true,
    },
    permissions: {
      type: [String],
      default: ["manage_users"],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export type Admin = InferSchemaType<typeof adminSchema> & {
  user: Types.ObjectId;
};

const AdminModel = model<Admin>("Admin", adminSchema);

export default AdminModel;
