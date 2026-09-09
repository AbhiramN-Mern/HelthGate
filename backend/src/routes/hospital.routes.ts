import { Router } from 'express'
import {
  getActiveHospitals,
  getAllHospitals,
  getHospitalById,
  createHospital,
  updateHospitalById,
  toggleHospitalStatus,
  verifyHospital,
} from '../controllers/hospital.controller.js'
import { protect, adminOnly } from '../middleware/auth.middleware.js'

const router = Router()

// Public - active hospitals
router.get('/active', getActiveHospitals)

// Authenticated users can list hospitals
router.get('/', protect, getAllHospitals)
router.get('/:id', protect, getHospitalById)

// Admin only actions
router.post('/', protect, adminOnly, createHospital)
router.put('/:id', protect, adminOnly, updateHospitalById)
router.patch('/:id/status', protect, adminOnly, toggleHospitalStatus)
router.patch('/:id/verify', protect, adminOnly, verifyHospital)

export default router
