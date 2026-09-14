import { Router } from "express";
import {
  startCall,
  joinCall,
  getCallDetails,
  endCall,
  getIceServers,
} from "../controllers/videoCall.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// 1. Ice server configuration
router.get("/ice-servers", protect, getIceServers);

// 2. Doctor starts video consultation (anytime for eligible appointment)
router.post("/start", protect, authorize("doctor"), startCall);

// 3. Patient joins video consultation
router.post("/:callSessionId/join", protect, authorize("patient"), joinCall);

// 4. Consultation details & authorization check (both doctor & patient)
router.get("/:sessionIdOrApptId", protect, authorize("doctor", "patient"), getCallDetails);

// 5. End video consultation
router.post("/:sessionIdOrApptId/end", protect, authorize("doctor", "patient"), endCall);

export default router;
