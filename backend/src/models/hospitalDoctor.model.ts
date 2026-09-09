import mongoose, { Schema, type Document, type Types } from 'mongoose'

export type HospitalDoctorStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED'
export type RequestedBy = 'DOCTOR' | 'ADMIN'

export interface IHospitalDoctor extends Document {
  hospital: Types.ObjectId
  doctor: Types.ObjectId
  department?: string
  status: HospitalDoctorStatus
  requestedBy: RequestedBy
  approvedBy?: Types.ObjectId | null
  rejectionReason?: string
  joinedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const HospitalDoctorSchema = new Schema<IHospitalDoctor>(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'],
      default: 'PENDING',
      index: true,
    },
    requestedBy: {
      type: String,
      enum: ['DOCTOR', 'ADMIN'],
      default: 'DOCTOR',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    joinedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

// Index to quickly look up doctor's hospitals and hospital's doctors
HospitalDoctorSchema.index({ doctor: 1, hospital: 1, status: 1 })
HospitalDoctorSchema.index({ hospital: 1, status: 1 })

const HospitalDoctorModel = mongoose.model<IHospitalDoctor>('HospitalDoctor', HospitalDoctorSchema)

export default HospitalDoctorModel
