import mongoose, { Schema } from 'mongoose'

export interface IHospital {
  name: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

HospitalSchema.index({ name: 1 }, { unique: true })

const HospitalModel = mongoose.model<IHospital>('Hospital', HospitalSchema)

export default HospitalModel
