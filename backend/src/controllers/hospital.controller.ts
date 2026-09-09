import { Request, Response } from 'express'
import HospitalModel from '../models/hospital.model.js'
import HospitalDoctorModel from '../models/hospitalDoctor.model.js'

export const getActiveHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await HospitalModel.find({ isActive: true })
      .sort({ name: 1 })
      .lean()

    // Attach active doctors count
    const hospitalIds = hospitals.map((h) => h._id)
    const activeDocCounts = await HospitalDoctorModel.aggregate([
      { $match: { hospital: { $in: hospitalIds }, status: 'ACTIVE' } },
      { $group: { _id: '$hospital', count: { $sum: 1 } } },
    ])

    const countMap: Record<string, number> = {}
    activeDocCounts.forEach((c) => {
      countMap[String(c._id)] = c.count
    })

    const enrichedHospitals = hospitals.map((h) => ({
      ...h,
      activeDoctorsCount: countMap[String(h._id)] || 0,
    }))

    return res.status(200).json({ success: true, hospitals: enrichedHospitals })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch hospitals' })
  }
}

export const getAllHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await HospitalModel.find().sort({ name: 1 }).lean()

    const hospitalIds = hospitals.map((h) => h._id)
    const activeDocCounts = await HospitalDoctorModel.aggregate([
      { $match: { hospital: { $in: hospitalIds }, status: 'ACTIVE' } },
      { $group: { _id: '$hospital', count: { $sum: 1 } } },
    ])

    const countMap: Record<string, number> = {}
    activeDocCounts.forEach((c) => {
      countMap[String(c._id)] = c.count
    })

    const enrichedHospitals = hospitals.map((h) => ({
      ...h,
      activeDoctorsCount: countMap[String(h._id)] || 0,
    }))

    return res.status(200).json({ success: true, hospitals: enrichedHospitals })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch hospitals' })
  }
}

export const getHospitalById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const hospital = await HospitalModel.findById(id).lean()
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' })
    }

    // Also fetch active doctor associations
    const activeDoctors = await HospitalDoctorModel.find({
      hospital: id,
      status: 'ACTIVE',
    })
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name email role' },
      })
      .lean()

    return res.status(200).json({
      success: true,
      hospital: {
        ...hospital,
        activeDoctorsCount: activeDoctors.length,
        doctors: activeDoctors,
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch hospital' })
  }
}

export const createHospital = async (req: Request, res: Response) => {
  try {
    const {
      name,
      licenseNumber = '',
      address = {},
      contactInfo = {},
      departments = ['General Medicine'],
      isActive = true,
      verificationStatus = 'verified',
    } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Hospital name is required' })
    }

    const hospital = await HospitalModel.create({
      name: String(name).trim(),
      licenseNumber: String(licenseNumber || '').trim(),
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || '',
      },
      contactInfo: {
        phone: contactInfo.phone || '',
        email: contactInfo.email || '',
        website: contactInfo.website || '',
      },
      departments: Array.isArray(departments) && departments.length > 0
        ? departments.map((d: string) => String(d).trim()).filter(Boolean)
        : ['General Medicine'],
      isActive: Boolean(isActive),
      verificationStatus: verificationStatus || 'verified',
    })

    return res.status(201).json({ success: true, hospital })
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Hospital with this name already exists' })
    }
    return res.status(500).json({ success: false, message: 'Unable to create hospital' })
  }
}

export const updateHospitalById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      name,
      licenseNumber,
      address,
      contactInfo,
      departments,
      isActive,
      verificationStatus,
    } = req.body

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = String(name).trim()
    if (licenseNumber !== undefined) update.licenseNumber = String(licenseNumber).trim()
    if (address !== undefined) update.address = address
    if (contactInfo !== undefined) update.contactInfo = contactInfo
    if (departments !== undefined && Array.isArray(departments)) {
      update.departments = departments.map((d: string) => String(d).trim()).filter(Boolean)
    }
    if (isActive !== undefined) update.isActive = Boolean(isActive)
    if (verificationStatus !== undefined) update.verificationStatus = verificationStatus

    const hospital = await HospitalModel.findByIdAndUpdate(id, update, { new: true })
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' })

    return res.status(200).json({ success: true, hospital })
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Hospital with this name already exists' })
    }
    return res.status(500).json({ success: false, message: 'Unable to update hospital' })
  }
}

export const toggleHospitalStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const hospital = await HospitalModel.findById(id)
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' })

    hospital.isActive = !hospital.isActive
    await hospital.save()

    return res.status(200).json({
      success: true,
      message: hospital.isActive ? 'Hospital activated' : 'Hospital deactivated',
      hospital,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to update status' })
  }
}

export const verifyHospital = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status = 'verified' } = req.body
    const hospital = await HospitalModel.findByIdAndUpdate(
      id,
      { verificationStatus: status },
      { new: true }
    )
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' })

    return res.status(200).json({
      success: true,
      message: `Hospital verification status updated to ${status}`,
      hospital,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to update verification status' })
  }
}
