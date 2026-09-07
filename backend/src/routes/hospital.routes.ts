import { Router } from 'express'
import { getActiveHospitals, getAllHospitals, createHospital, updateHospitalById } from '../controllers/hospital.controller.js'
import { protect, adminOnly } from '../middleware/auth.middleware.js'

const router = Router()

// Public
router.get('/active', getActiveHospitals)

// Admin
router.get('/', protect, adminOnly, getAllHospitals)
router.post('/', protect, adminOnly, createHospital)
router.put('/:id', protect, adminOnly, updateHospitalById)

export default router
