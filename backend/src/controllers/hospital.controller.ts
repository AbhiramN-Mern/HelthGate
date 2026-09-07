import { Request, Response } from 'express'
import HospitalModel from '../models/hospital.model.js'

export const getActiveHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await HospitalModel.find({ isActive: true }).sort({ name: 1 }).select('name isActive')
    return res.status(200).json({ success: true, hospitals })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch hospitals' })
  }
}

export const getAllHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await HospitalModel.find().sort({ name: 1 })
    return res.status(200).json({ success: true, hospitals })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch hospitals' })
  }
}

export const createHospital = async (req: Request, res: Response) => {
  try {
    const { name, isActive = true } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Hospital name is required' })
    }

    const hospital = await HospitalModel.create({ name: String(name).trim(), isActive: Boolean(isActive) })
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
    const { name, isActive } = req.body

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = String(name).trim()
    if (isActive !== undefined) update.isActive = Boolean(isActive)

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
