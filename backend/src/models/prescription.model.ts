import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const medicineItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
      default: "",
    },
    frequency: {
      type: String,
      trim: true,
      default: "",
    },
    duration: {
      type: String,
      trim: true,
      default: "",
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const prescriptionSchema = new Schema(
  {
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    medicines: {
      type: [medicineItemSchema],
      default: [],
    },
    labTests: {
      type: [String],
      default: [],
    },
    additionalAdvice: {
      type: String,
      trim: true,
      default: "",
    },
    followUpDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export type Prescription = InferSchemaType<typeof prescriptionSchema> & {
  _id: Types.ObjectId;
  appointment: Types.ObjectId;
  patient: Types.ObjectId;
  doctor: Types.ObjectId;
  labTests?: string[];
};

const PrescriptionModel = model<Prescription>("Prescription", prescriptionSchema);

export default PrescriptionModel;
