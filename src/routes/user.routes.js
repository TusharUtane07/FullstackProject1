import { Router } from "express";
import {
	loginUser,
	logoutUser,
	registerUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/Multer.middleware.js";
import { verifyJWT } from "../middlewares/Auth.middleware.js";

const router = Router();

// added what to do on this particular route
router.route("/register").post(
	upload.fields([
		{
			name: "avatar",
			maxCount: 1,
		},
		{
			name: "coverImage",
			maxCount: 1,
		},
	]),
	registerUser
);

// added what to do on this particular route
router.route("/login").post(loginUser);

// Secured Routes
// added middleware to check verified user then do the functionality provided on this particular route
router.route("/logout").post(verifyJWT, logoutUser);

export default router;
