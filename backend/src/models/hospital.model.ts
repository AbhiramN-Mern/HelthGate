import mongoose, { Schema } from 'mongoose'

export interface IHospitalAddress {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface IHospitalContact {
  phone?: string
  email?: string
  website?: string
}

export interface IHospital {
  name: string
  licenseNumber?: string
  address?: IHospitalAddress
  contactInfo?: IHospitalContact
  departments?: string[]
  isActive: boolean
  verificationStatus: 'verified' | 'pending' | 'unverified'
  createdAt?: Date
  updatedAt?: Date
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    licenseNumber: { type: String, trim: true, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    departments: {
      type: [String],
      default: ['General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Emergency'],
    },
    isActive: { type: Boolean, default: true },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending', 'unverified'],
      default: 'verified',
    },
  },
  { timestamps: true },
)

HospitalSchema.index({ name: 1 }, { unique: true })

const HospitalModel = mongoose.model<IHospital>('Hospital', HospitalSchema)

export default HospitalModel
